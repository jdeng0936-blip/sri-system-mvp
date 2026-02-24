"""
路由：合同联审 6 步流水线 — routers/contracts.py
=================================================
状态机: 1_sales_init → 2_tech_review → 3_sales_pricing
        → 4_vp_approval → 5_approved → 6_commission
每一步严格锁定角色权限，绝不允许越权流转。
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models import (
    Contract, ContractBOMItem, ContractStep,
    Project, User, UserRole,
)
from schemas import (
    CommissionCalcInput, CommissionItem,
    ContractBOMItemInput, ContractCreate, ContractOut,
    SalesPricingInput, SalesPricingItem,
    SuccessResponse, TechReviewInput, TechReviewItem,
)
from utils.dependencies import get_current_user, get_db, require_role
from utils.security import compute_bom_hash

router = APIRouter(prefix="/api/contracts", tags=["Contract 合同联审"])


# ─────────────────────────────────────────
# 辅助函数
# ─────────────────────────────────────────

def _get_contract_or_404(contract_id: int, db: Session) -> Contract:
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(404, f"合同 #{contract_id} 不存在")
    return c


def _assert_step(contract: Contract, expected: ContractStep, action_name: str):
    """校验合同当前步骤是否匹配，不匹配直接拒绝。"""
    if contract.step != expected:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"🔒 流程拦截：[{action_name}] 需要状态为 [{expected.value}]，"
            f"当前状态为 [{contract.step.value}]"
        )


# ═══════════════════════════════════════════
# POST /api/contracts — 创建合同 (❶ 销售发起)
# ═══════════════════════════════════════════

@router.post("", response_model=ContractOut, status_code=201)
def create_contract(
    body: ContractCreate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    ❶ 销售发起合同请求，录入初始 BOM。
    初始状态: 1_sales_init
    """
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(404, f"项目 #{body.project_id} 不存在")

    contract = Contract(
        project_id=body.project_id,
        step=ContractStep.SALES_INIT,
    )
    db.add(contract)
    db.flush()

    for item in body.bom_items:
        bom = ContractBOMItem(
            contract_id=contract.id,
            product_model=item.product_model,
            ai_extracted_qty=item.ai_extracted_qty,
            sales_qty=item.sales_qty,
            unit_price=item.unit_price,
            tech_qty=item.sales_qty,     # 初始值 = 销售数量
            final_qty=item.sales_qty,    # 初始值 = 销售数量
            remark=item.remark,
        )
        db.add(bom)

    db.commit()
    db.refresh(contract)
    return contract


# ═══════════════════════════════════════════
# GET /api/contracts/{id} — 合同详情
# ═══════════════════════════════════════════

@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_contract_or_404(contract_id, db)


# ═══════════════════════════════════════════
# POST /{id}/submit-to-tech — ❶→❷ 提交至技术审查
# ═══════════════════════════════════════════

@router.post("/{contract_id}/submit-to-tech", response_model=ContractOut)
def submit_to_tech(
    contract_id: int,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """❶→❷ 销售将 BOM 提交至技术部进行超配审查。"""
    contract = _get_contract_or_404(contract_id, db)
    _assert_step(contract, ContractStep.SALES_INIT, "提交至技术审查")

    if not contract.bom_items:
        raise HTTPException(422, "⚠️ BOM 为空，无法提交技术审查")

    contract.step = ContractStep.TECH_REVIEW
    db.commit()
    db.refresh(contract)
    return contract


# ═══════════════════════════════════════════
# POST /{id}/tech-review — ❷→❸ 技术超配审查
# ═══════════════════════════════════════════

@router.post("/{contract_id}/tech-review", response_model=ContractOut)
def tech_review(
    contract_id: int,
    body: TechReviewInput,
    user: User = Depends(require_role(UserRole.TECH)),
    db: Session = Depends(get_db),
):
    """
    ❷→❸ 技术部填写超配核定数量和超配说明。
    🔒 仅限 tech / admin 角色调用。
    """
    contract = _get_contract_or_404(contract_id, db)
    _assert_step(contract, ContractStep.TECH_REVIEW, "技术超配审查")

    # 构建 BOM ID 索引
    bom_map = {b.id: b for b in contract.bom_items}

    for item in body.items:
        bom = bom_map.get(item.bom_item_id)
        if not bom:
            raise HTTPException(
                422,
                f"BOM 行 #{item.bom_item_id} 不属于本合同"
            )
        bom.tech_qty = item.tech_qty
        bom.overalloc_note = item.overalloc_note or ""

        # 超配预警：技术核定数量 > 销售原始数量
        if item.tech_qty > bom.sales_qty:
            if not item.overalloc_note:
                raise HTTPException(
                    422,
                    f"⚠️ 产品 [{bom.product_model}] 技术核定 {item.tech_qty}"
                    f" > 销售核定 {bom.sales_qty}，超配必须填写说明！"
                )

    # 流转: → 3_sales_pricing
    contract.step = ContractStep.SALES_PRICING
    db.commit()
    db.refresh(contract)
    return contract


# ═══════════════════════════════════════════
# POST /{id}/submit-pricing — ❸→❹ 销售最终定价
# ═══════════════════════════════════════════

@router.post("/{contract_id}/submit-pricing", response_model=ContractOut)
def submit_pricing(
    contract_id: int,
    body: SalesPricingInput,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    ❸→❹ 销售确认最终价格 + 填写商务条款，提交 VP 审批。
    🔒 仅限 sales / admin。
    ⚠️ 风控硬校验：
      - 付款比例 Σ == 100%, 否则 422
      - 货期/地址/收货人不可为空
      (以上由 Pydantic SalesPricingInput validator 拦截)
    """
    contract = _get_contract_or_404(contract_id, db)
    _assert_step(contract, ContractStep.SALES_PRICING, "销售最终定价")

    # 更新 BOM 最终数量/单价
    bom_map = {b.id: b for b in contract.bom_items}
    for item in body.items:
        bom = bom_map.get(item.bom_item_id)
        if not bom:
            raise HTTPException(422, f"BOM 行 #{item.bom_item_id} 不属于本合同")
        bom.final_qty = item.final_qty
        bom.unit_price = item.unit_price

    # 写入商务条款
    contract.pay_method = body.pay_method
    contract.delivery_time = body.delivery_time
    contract.warranty_period = body.warranty_period
    contract.ratio_advance = body.ratio_advance
    contract.ratio_delivery = body.ratio_delivery
    contract.ratio_accept = body.ratio_accept
    contract.ratio_warranty = body.ratio_warranty
    contract.delivery_address = body.delivery_address
    contract.receiver_contact = body.receiver_contact

    # 流转: → 4_vp_approval
    contract.step = ContractStep.VP_APPROVAL
    db.commit()
    db.refresh(contract)
    return contract


# ═══════════════════════════════════════════
# POST /{id}/approve — ❹→❺ VP 合同终审通过
# ═══════════════════════════════════════════

@router.post("/{contract_id}/approve", response_model=ContractOut)
def approve_contract(
    contract_id: int,
    user: User = Depends(require_role(UserRole.VP)),
    db: Session = Depends(get_db),
):
    """
    ❹→❺ VP 合同终审通过。
    🔒 仅限 VP / admin。
    🔒 审批时锁定 bom_snapshot_hash，后续防篡改。
    """
    contract = _get_contract_or_404(contract_id, db)
    _assert_step(contract, ContractStep.VP_APPROVAL, "VP 合同终审")

    # 🔒 锁定 BOM 快照哈希
    contract.bom_snapshot_hash = compute_bom_hash([
        {"model": b.product_model, "qty": b.final_qty, "price": b.unit_price}
        for b in contract.bom_items
    ])

    contract.step = ContractStep.CONTRACT_SENT
    db.commit()
    db.refresh(contract)
    return contract


# ═══════════════════════════════════════════
# POST /{id}/reject — ❹→❸ VP 驳回至销售重新定价
# ═══════════════════════════════════════════

@router.post("/{contract_id}/reject", response_model=ContractOut)
def reject_contract(
    contract_id: int,
    user: User = Depends(require_role(UserRole.VP)),
    db: Session = Depends(get_db),
):
    """
    ❹→❸ VP 驳回，合同回退至销售定价阶段。
    🔒 仅限 VP / admin。
    """
    contract = _get_contract_or_404(contract_id, db)
    _assert_step(contract, ContractStep.VP_APPROVAL, "VP 驳回")

    contract.step = ContractStep.SALES_PRICING
    db.commit()
    db.refresh(contract)
    return contract


# ═══════════════════════════════════════════
# POST /{id}/calculate-commission — ❺→❻ 提成核算
# ═══════════════════════════════════════════

@router.post("/{contract_id}/calculate-commission", response_model=ContractOut)
def calculate_commission(
    contract_id: int,
    body: CommissionCalcInput,
    user: User = Depends(require_role(UserRole.FINANCE, UserRole.VP)),
    db: Session = Depends(get_db),
):
    """
    ❺→❻ 核算销售提成。
    🔒 仅限 finance / VP / admin。
    支持两种公式：
      - 毛利提成: (单价 - 底价) × 数量 × 比例
      - 全额提成: 单价 × 数量 × 比例
    """
    contract = _get_contract_or_404(contract_id, db)
    _assert_step(contract, ContractStep.CONTRACT_SENT, "提成核算")

    bom_map = {b.id: b for b in contract.bom_items}
    total_commission = 0.0

    # 写入底价和提成比例
    for item in body.items:
        bom = bom_map.get(item.bom_item_id)
        if not bom:
            raise HTTPException(422, f"BOM 行 #{item.bom_item_id} 不属于本合同")
        bom.base_price = item.base_price
        bom.commission_ratio = item.commission_ratio

        # 计算单项提成
        if "毛利" in body.commission_formula:
            item_comm = (bom.unit_price - item.base_price) * bom.final_qty * item.commission_ratio
        else:
            item_comm = bom.unit_price * bom.final_qty * item.commission_ratio
        total_commission += item_comm

    # 扣减运费
    final_commission = total_commission - body.freight_cost

    contract.commission_formula = body.commission_formula
    contract.freight_cost = body.freight_cost
    contract.total_commission = max(final_commission, 0)  # 提成不为负

    # 流转: → 6_commission
    contract.step = ContractStep.COMMISSION
    db.commit()
    db.refresh(contract)
    return contract
