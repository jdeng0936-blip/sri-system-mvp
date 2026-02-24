"""
路由：智能报价与防篡改中心 — routers/deal_desks.py
====================================================
状态机: draft → pending → approved / rejected
天眼引擎: BOM SHA-256 防篡改校验
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models import (
    BOMItem, DealDesk, DealStatus, Project, User, UserRole,
)
from schemas import (
    BOMItemInput, BOMVerifyRequest, BOMVerifyResponse,
    DealDeskCreate, DealDeskOut, DealDeskReject, SuccessResponse,
)
from utils.dependencies import get_current_user, get_db, require_role
from utils.security import compute_bom_hash, verify_bom_integrity

router = APIRouter(prefix="/api/dealdesk", tags=["DealDesk 报价底单"])


# ─────────────────────────────────────────
# 辅助函数
# ─────────────────────────────────────────

def _get_deal_or_404(deal_id: int, db: Session) -> DealDesk:
    deal = db.query(DealDesk).filter(DealDesk.id == deal_id).first()
    if not deal:
        raise HTTPException(404, f"报价底单 #{deal_id} 不存在")
    return deal


def _calc_total(bom_items: list[BOMItem]) -> float:
    return sum((i.sales_qty or 0) * (i.unit_price or 0) for i in bom_items)


# ═══════════════════════════════════════════
# POST /api/dealdesk — 创建报价底单 (草稿)
# ═══════════════════════════════════════════

@router.post("", response_model=DealDeskOut, status_code=201)
def create_deal_desk(
    body: DealDeskCreate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    创建报价底单草稿。
    - 仅限 sales 角色
    - 自动计算每行小计与总价
    - 初始状态: draft
    """
    # 校验项目存在性
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(404, f"项目 #{body.project_id} 不存在")

    # 创建底单主表
    deal = DealDesk(
        project_id=body.project_id,
        inquiry_client=body.inquiry_client,
        inquiry_contact=body.inquiry_contact,
        status=DealStatus.DRAFT,
        submitted_by=user.name,
        total_amount=0,
    )
    db.add(deal)
    db.flush()  # 获取 deal.id

    # 创建 BOM 明细行
    for item in body.bom_items:
        subtotal = (item.sales_qty or 0) * (item.unit_price or 0)
        bom = BOMItem(
            deal_desk_id=deal.id,
            product_model=item.product_model,
            ai_extracted_qty=item.ai_extracted_qty,
            sales_qty=item.sales_qty,
            unit_price=item.unit_price,
            subtotal=subtotal,
            remark=item.remark,
        )
        db.add(bom)

    # 计算总价 & 初始防篡改哈希
    db.flush()
    deal.total_amount = _calc_total(deal.bom_items)
    deal.tamper_hash = compute_bom_hash([
        {"model": i.product_model, "qty": i.sales_qty, "price": i.unit_price}
        for i in deal.bom_items
    ])

    db.commit()
    db.refresh(deal)
    return deal


# ═══════════════════════════════════════════
# GET /api/dealdesk/{id} — 底单详情
# ═══════════════════════════════════════════

@router.get("/{deal_id}", response_model=DealDeskOut)
def get_deal_desk(
    deal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取底单详情（含 BOM 明细 + 审批状态）。"""
    return _get_deal_or_404(deal_id, db)


# ═══════════════════════════════════════════
# PATCH /api/dealdesk/{id}/bom — 修改 BOM
# ═══════════════════════════════════════════

@router.patch("/{deal_id}/bom", response_model=DealDeskOut)
def update_bom(
    deal_id: int,
    bom_items: list[BOMItemInput],
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    修改 BOM 明细。
    ⚠️ 仅 draft / rejected 状态允许修改！
    approved 状态修改 → 天眼自动拦截并降级。
    """
    deal = _get_deal_or_404(deal_id, db)

    # 状态锁定：只有草稿/被驳回才能改
    if deal.status == DealStatus.PENDING:
        raise HTTPException(
            status.HTTP_423_LOCKED,
            "🔒 报价单已提交审批中，锁定不可修改。请等待 VP 审批结果。"
        )
    if deal.status == DealStatus.APPROVED:
        # ⚠️ 天眼核心逻辑：已获批底单被偷改 → 自动降级为 draft
        deal.status = DealStatus.DRAFT
        deal.diff_summary = "🚨 天眼侦测：销售试图修改已获批底单，已自动剥夺绿灯！"
        deal.approved_at = None
        deal.approved_by = None
        # 不 raise，允许修改但降级

    # 清空旧 BOM，写入新 BOM
    db.query(BOMItem).filter(BOMItem.deal_desk_id == deal.id).delete()
    for item in bom_items:
        subtotal = (item.sales_qty or 0) * (item.unit_price or 0)
        bom = BOMItem(
            deal_desk_id=deal.id,
            product_model=item.product_model,
            ai_extracted_qty=item.ai_extracted_qty,
            sales_qty=item.sales_qty,
            unit_price=item.unit_price,
            subtotal=subtotal,
            remark=item.remark,
        )
        db.add(bom)

    db.flush()
    deal.total_amount = _calc_total(deal.bom_items)
    deal.tamper_hash = compute_bom_hash([
        {"model": i.product_model, "qty": i.sales_qty, "price": i.unit_price}
        for i in deal.bom_items
    ])

    db.commit()
    db.refresh(deal)
    return deal


# ═══════════════════════════════════════════
# POST /api/dealdesk/{id}/submit — 销售提交审批
# ═══════════════════════════════════════════

@router.post("/{deal_id}/submit", response_model=DealDeskOut)
def submit_for_approval(
    deal_id: int,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    状态机: draft/rejected → pending
    ⚠️ 天眼风控死命令：
      1. 读取 DB 存储的原始 tamper_hash
      2. 实时计算当前 BOM 的哈希
      3. 不一致 → 403 拦截 + 降级 draft
    """
    deal = _get_deal_or_404(deal_id, db)

    # 前置状态校验
    if deal.status not in (DealStatus.DRAFT, DealStatus.REJECTED):
        raise HTTPException(400, f"当前状态为 [{deal.status.value}]，无法提交审批")

    # BOM 非空校验
    if not deal.bom_items:
        raise HTTPException(422, "⚠️ BOM 明细为空，无法提交审批")

    # ═══════════════════════════════════════
    # 🔍 天眼防篡改校验 — 风控死命令
    # ═══════════════════════════════════════
    if deal.tamper_hash:
        current_bom = [
            {"model": i.product_model, "qty": i.sales_qty, "price": i.unit_price}
            for i in deal.bom_items
        ]
        is_valid, diff_msg = verify_bom_integrity(current_bom, deal.tamper_hash)
        if not is_valid:
            # 哈希异动 → 403 拦截 + 记录变更摘要 + 降级
            deal.diff_summary = diff_msg
            deal.status = DealStatus.DRAFT
            db.commit()
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"🚨 天眼拦截：核心数据已被篡改！{diff_msg}"
            )

    # 检测总价变动（与上次存储的对比）
    current_total = _calc_total(deal.bom_items)
    if deal.total_amount > 0 and abs(current_total - deal.total_amount) > 0.01:
        diff_msg = (
            f"🚨 【财务严重变更】总价发生异动："
            f"原底单 ¥{deal.total_amount:,.2f} → 新提交 ¥{current_total:,.2f}"
        )
        deal.diff_summary = diff_msg
    else:
        deal.diff_summary = ""

    # 更新总价 & 重算哈希
    deal.total_amount = current_total
    deal.tamper_hash = compute_bom_hash([
        {"model": i.product_model, "qty": i.sales_qty, "price": i.unit_price}
        for i in deal.bom_items
    ])

    # 状态流转: → pending
    deal.status = DealStatus.PENDING
    deal.submitted_by = user.name

    db.commit()
    db.refresh(deal)
    return deal


# ═══════════════════════════════════════════
# POST /api/dealdesk/{id}/approve — VP 审批通过
# ═══════════════════════════════════════════

@router.post("/{deal_id}/approve", response_model=DealDeskOut)
def approve_deal(
    deal_id: int,
    user: User = Depends(require_role(UserRole.VP)),
    db: Session = Depends(get_db),
):
    """
    状态机: pending → approved
    仅限 VP / Admin。
    🔒 审批通过后锁定 tamper_hash，后续任何篡改均会被天眼捕获。
    """
    deal = _get_deal_or_404(deal_id, db)

    if deal.status != DealStatus.PENDING:
        raise HTTPException(400, f"当前状态为 [{deal.status.value}]，仅 pending 可审批")

    # 向 VP 展示天眼侦测报告
    if deal.diff_summary and "🚨" in deal.diff_summary:
        # 如果有变更警告，VP 仍可选择批准（已知晓风险）
        pass

    # 🔒 锁定哈希：此后任何 BOM 变动都会触发天眼
    deal.tamper_hash = compute_bom_hash([
        {"model": i.product_model, "qty": i.sales_qty, "price": i.unit_price}
        for i in deal.bom_items
    ])

    deal.status = DealStatus.APPROVED
    deal.approved_by = user.name
    deal.approved_at = datetime.now(timezone.utc)
    deal.reject_reason = None

    db.commit()
    db.refresh(deal)
    return deal


# ═══════════════════════════════════════════
# POST /api/dealdesk/{id}/reject — VP 驳回
# ═══════════════════════════════════════════

@router.post("/{deal_id}/reject", response_model=DealDeskOut)
def reject_deal(
    deal_id: int,
    body: DealDeskReject,
    user: User = Depends(require_role(UserRole.VP)),
    db: Session = Depends(get_db),
):
    """
    状态机: pending → rejected
    仅限 VP / Admin。必须附带驳回原因。
    """
    deal = _get_deal_or_404(deal_id, db)

    if deal.status != DealStatus.PENDING:
        raise HTTPException(400, f"当前状态为 [{deal.status.value}]，仅 pending 可驳回")

    deal.status = DealStatus.REJECTED
    deal.reject_reason = body.reason
    deal.approved_by = user.name

    db.commit()
    db.refresh(deal)
    return deal


# ═══════════════════════════════════════════
# POST /api/dealdesk/{id}/verify — 天眼引擎实时校验
# ═══════════════════════════════════════════

@router.post("/{deal_id}/verify", response_model=BOMVerifyResponse)
def verify_bom(
    deal_id: int,
    body: BOMVerifyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    🔍 天眼引擎：前端提交 BOM → 服务端实时比对。
    - 哈希一致 → 200 OK
    - 哈希异动 → 403 + diff_summary + 自动降级 draft
    """
    deal = _get_deal_or_404(deal_id, db)

    if not deal.tamper_hash:
        return BOMVerifyResponse(is_valid=True, diff_summary="暂无基准哈希，跳过校验")

    current_bom = [
        {"model": i.product_model, "qty": i.sales_qty, "price": i.unit_price}
        for i in body.bom_items
    ]
    is_valid, diff_msg = verify_bom_integrity(current_bom, deal.tamper_hash)

    if not is_valid:
        # 自动降级已获批的底单
        if deal.status == DealStatus.APPROVED:
            deal.status = DealStatus.DRAFT
            deal.diff_summary = diff_msg
            deal.approved_at = None
            db.commit()

        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=f"🚨 天眼拦截：BOM 数据异动！{diff_msg}"
        )

    return BOMVerifyResponse(is_valid=True, diff_summary="")
