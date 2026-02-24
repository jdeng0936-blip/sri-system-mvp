"""
Pydantic 请求/响应模型 — schemas.py
=====================================
基于 Phase 1 models.py 的 SQLAlchemy ORM 模型，
为 FastAPI 路由层提供严格的数据校验与序列化。
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ═══════════════════════════════════════════
# 枚举类型（与 models.py 同步）
# ═══════════════════════════════════════════

class UserRoleEnum(str, Enum):
    SALES = "sales"
    TECH = "tech"
    DIRECTOR = "director"
    VP = "vp"
    FINANCE = "finance"
    ADMIN = "admin"


class ProjectStageEnum(str, Enum):
    LEAD = "lead"
    INITIAL_CONTACT = "initial_contact"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    TECH_STALEMATE = "tech_stalemate"
    CLOSING = "closing"
    LOST = "lost"
    WON = "won"


class ProjectApprovalEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONFLICT = "conflict"


class BudgetStatusEnum(str, Enum):
    FULLY_APPROVED = "fully_approved"
    PARTIAL = "partial"
    APPLYING = "applying"
    UNKNOWN = "unknown"


class CompetitivePositionEnum(str, Enum):
    LEADING = "leading"
    PARALLEL = "parallel"
    TRAILING = "trailing"
    UNKNOWN = "unknown"


class StakeholderAttitudeEnum(str, Enum):
    SUPPORT = "support"
    NEUTRAL = "neutral"
    OPPOSE = "oppose"


class DealStatusEnum(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ContractStepEnum(str, Enum):
    SALES_INIT = "1_sales_init"
    TECH_REVIEW = "2_tech_review"
    SALES_PRICING = "3_sales_pricing"
    VP_APPROVAL = "4_vp_approval"
    CONTRACT_SENT = "5_approved"
    COMMISSION = "6_commission"


class SOSStatusEnum(str, Enum):
    URGENT = "urgent"
    RESOLVED = "resolved"


class AppealStatusEnum(str, Enum):
    PENDING = "pending"
    GRANTED = "granted"
    DENIED = "denied"


# ═══════════════════════════════════════════
# Auth 认证
# ═══════════════════════════════════════════

class LoginRequest(BaseModel):
    phone: str = Field(..., min_length=1, description="手机号/登录名")
    password: str = Field(..., min_length=1, description="密码")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ═══════════════════════════════════════════
# User 用户
# ═══════════════════════════════════════════

class UserCreate(BaseModel):
    name: str = Field(..., max_length=100, description="姓名")
    phone: str = Field(..., max_length=20, description="手机号/登录名")
    password: str = Field(..., min_length=4, description="密码")
    role: UserRoleEnum = Field(default=UserRoleEnum.SALES, description="角色")
    dept: str = Field(..., max_length=100, description="所属战区/部门")


class UserOut(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    role: UserRoleEnum
    dept: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════
# Project 项目
# ═══════════════════════════════════════════

class ProjectCreate(BaseModel):
    """立项申请（销售提交）。"""
    client: str = Field(..., min_length=1, max_length=200, description="终端客户/业主")
    project_title: str = Field(..., min_length=1, max_length=200, description="项目简称")
    design_institute: Optional[str] = Field(None, max_length=200, description="设计院/总包")
    general_contractor: Optional[str] = Field(None, max_length=200, description="施工方")
    info_source: Optional[str] = Field(None, description="信息来源")
    project_driver: Optional[str] = Field(None, description="项目驱动力")
    estimated_amount: Optional[float] = Field(0, ge=0, description="预估金额(万元)")


class ProjectUpdate(BaseModel):
    """项目字段更新（销售/Owner 操作）。"""
    stage: Optional[ProjectStageEnum] = None
    budget_status: Optional[BudgetStatusEnum] = None
    competitive_position: Optional[CompetitivePositionEnum] = None
    estimated_amount: Optional[float] = Field(None, ge=0)
    expected_close_date: Optional[datetime] = None
    design_institute: Optional[str] = None
    general_contractor: Optional[str] = None
    info_source: Optional[str] = None
    project_driver: Optional[str] = None


class MEDDICUpdate(BaseModel):
    """MEDDIC 七维评分更新。服务端自动重算 win_rate。"""
    meddic_metrics: int = Field(..., ge=0, le=100, description="M — 量化指标")
    meddic_economic_buyer: int = Field(..., ge=0, le=100, description="E — 经济决策者")
    meddic_decision_criteria: int = Field(..., ge=0, le=100, description="D — 决策标准")
    meddic_decision_process: int = Field(..., ge=0, le=100, description="D — 决策流程")
    meddic_identify_pain: int = Field(..., ge=0, le=100, description="I — 核心痛点")
    meddic_champion: int = Field(..., ge=0, le=100, description="C — 内部教练")
    meddic_relationship: int = Field(..., ge=0, le=100, description="R — 利益关系")


class ProjectOut(BaseModel):
    id: int
    name: str
    client: str
    project_title: Optional[str] = None
    design_institute: Optional[str] = None
    general_contractor: Optional[str] = None
    owner_id: Optional[int] = None
    dept: Optional[str] = None
    applicant_name: Optional[str] = None
    approval_status: ProjectApprovalEnum
    stage: ProjectStageEnum
    budget_status: BudgetStatusEnum
    competitive_position: CompetitivePositionEnum
    estimated_amount: float
    expected_close_date: Optional[datetime] = None
    win_rate: float
    # MEDDIC
    meddic_metrics: int
    meddic_economic_buyer: int
    meddic_decision_criteria: int
    meddic_decision_process: int
    meddic_identify_pain: int
    meddic_champion: int
    meddic_relationship: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════
# Stakeholder 权力地图
# ═══════════════════════════════════════════

class StakeholderCreate(BaseModel):
    name: str = Field(..., max_length=100, description="姓名")
    title: Optional[str] = Field(None, max_length=100, description="职位")
    role_tags: Optional[str] = Field(None, description="角色标签(逗号分隔)")
    attitude: StakeholderAttitudeEnum = Field(
        default=StakeholderAttitudeEnum.NEUTRAL, description="态度"
    )
    influence_weight: int = Field(default=5, ge=1, le=10, description="影响力 1-10")
    reports_to: Optional[str] = Field(None, max_length=100, description="上级/汇报给")
    phone: Optional[str] = Field(None, max_length=50, description="联系方式")
    notes: Optional[str] = Field(None, description="策略备注")


class StakeholderUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, max_length=100)
    role_tags: Optional[str] = None
    attitude: Optional[StakeholderAttitudeEnum] = None
    influence_weight: Optional[int] = Field(None, ge=1, le=10)
    reports_to: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class StakeholderOut(BaseModel):
    id: int
    project_id: int
    name: str
    title: Optional[str] = None
    role_tags: Optional[str] = None
    attitude: StakeholderAttitudeEnum
    influence_weight: int
    reports_to: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════
# IntelLog 情报日志
# ═══════════════════════════════════════════

class IntelLogCreate(BaseModel):
    project_id: int
    text: str = Field(..., min_length=1, max_length=8000, description="情报原文")


class IntelLogOut(BaseModel):
    id: int
    project_id: int
    author_id: Optional[int] = None
    raw_input: Optional[str] = None
    input_type: str
    attachment_hash: Optional[str] = None
    attachment_url: Optional[str] = None
    ai_parsed_json: Optional[str] = None
    ai_model_used: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════
# DealDesk 报价底单 + BOM
# ═══════════════════════════════════════════

class BOMItemInput(BaseModel):
    """BOM 行输入。"""
    product_model: str = Field(..., min_length=1, description="产品型号")
    ai_extracted_qty: int = Field(default=0, ge=0, description="AI 提取数量")
    sales_qty: int = Field(default=0, ge=0, description="销售核定数量")
    unit_price: float = Field(default=0, ge=0, description="标准单价(元)")
    remark: Optional[str] = None


class BOMItemOut(BaseModel):
    id: int
    product_model: str
    ai_extracted_qty: int
    sales_qty: int
    unit_price: float
    subtotal: float
    remark: Optional[str] = None

    model_config = {"from_attributes": True}


class DealDeskCreate(BaseModel):
    project_id: int
    inquiry_client: Optional[str] = Field(None, description="询价客户主体")
    inquiry_contact: Optional[str] = Field(None, description="客户联系方式")
    bom_items: list[BOMItemInput] = Field(..., min_length=1, description="BOM 明细行")


class DealDeskOut(BaseModel):
    id: int
    project_id: int
    inquiry_client: Optional[str] = None
    inquiry_contact: Optional[str] = None
    status: DealStatusEnum
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    reject_reason: Optional[str] = None
    total_amount: float
    tamper_hash: Optional[str] = None
    diff_summary: Optional[str] = None
    bom_items: list[BOMItemOut] = []
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DealDeskReject(BaseModel):
    reason: str = Field(..., min_length=1, description="驳回原因")


class BOMVerifyRequest(BaseModel):
    """天眼引擎：前端 BOM 校验请求。"""
    bom_items: list[BOMItemInput]


class BOMVerifyResponse(BaseModel):
    is_valid: bool
    diff_summary: str = ""


# ═══════════════════════════════════════════
# Contract 合同联审
# ═══════════════════════════════════════════

class ContractBOMItemInput(BaseModel):
    product_model: str = Field(..., min_length=1)
    ai_extracted_qty: int = Field(default=0, ge=0)
    sales_qty: int = Field(default=0, ge=0)
    unit_price: float = Field(default=0, ge=0)
    remark: Optional[str] = None


class ContractBOMItemOut(BaseModel):
    id: int
    product_model: str
    ai_extracted_qty: int
    sales_qty: int
    tech_qty: int
    final_qty: int
    unit_price: float
    base_price: float
    overalloc_note: Optional[str] = None
    commission_ratio: float
    remark: Optional[str] = None

    model_config = {"from_attributes": True}


class ContractCreate(BaseModel):
    project_id: int
    bom_items: list[ContractBOMItemInput] = Field(..., min_length=1)


class TechReviewInput(BaseModel):
    """❷ 技术超配审查提交。"""
    items: list["TechReviewItem"]


class TechReviewItem(BaseModel):
    bom_item_id: int
    tech_qty: int = Field(..., ge=0, description="技术核定数量")
    overalloc_note: Optional[str] = Field(None, description="超配说明")


class SalesPricingInput(BaseModel):
    """❸ 销售最终定价 + 商务条款。"""
    # BOM 最终数量/单价更新
    items: list["SalesPricingItem"]
    # 商务条款
    pay_method: str = Field(..., description="支付方式")
    delivery_time: str = Field(..., min_length=1, description="货期承诺")
    warranty_period: str = Field(..., min_length=1, description="质保期限")
    ratio_advance: int = Field(..., ge=0, le=100, description="预付款%")
    ratio_delivery: int = Field(..., ge=0, le=100, description="发货款%")
    ratio_accept: int = Field(..., ge=0, le=100, description="验收款%")
    ratio_warranty: int = Field(..., ge=0, le=100, description="质保金%")
    delivery_address: str = Field(..., min_length=1, description="发货地址")
    receiver_contact: str = Field(..., min_length=1, description="收货人")

    @field_validator("ratio_warranty")
    @classmethod
    def check_ratio_sum(cls, v, info):
        """风控拦截：付款比例总和必须为 100%。"""
        data = info.data
        total = data.get("ratio_advance", 0) + data.get("ratio_delivery", 0) + \
                data.get("ratio_accept", 0) + v
        if total != 100:
            raise ValueError(
                f"🚨 财务风控拦截：付款比例总和必须为 100% (当前为 {total}%)"
            )
        return v


class SalesPricingItem(BaseModel):
    bom_item_id: int
    final_qty: int = Field(..., ge=0, description="最终报价数量")
    unit_price: float = Field(..., ge=0, description="单价(元)")


class CommissionCalcInput(BaseModel):
    """❻ 提成核算输入。"""
    commission_formula: str = Field(
        ..., description="提成公式: 毛利提成 / 全额提成"
    )
    freight_cost: float = Field(default=0, ge=0, description="运费扣减")
    items: list["CommissionItem"]


class CommissionItem(BaseModel):
    bom_item_id: int
    base_price: float = Field(..., ge=0, description="公司结算底价(元)")
    commission_ratio: float = Field(
        default=0.10, ge=0, le=1.0, description="提成比例"
    )


class ContractOut(BaseModel):
    id: int
    project_id: int
    step: ContractStepEnum
    pay_method: Optional[str] = None
    delivery_time: Optional[str] = None
    warranty_period: Optional[str] = None
    ratio_advance: int
    ratio_delivery: int
    ratio_accept: int
    ratio_warranty: int
    delivery_address: Optional[str] = None
    receiver_contact: Optional[str] = None
    commission_formula: Optional[str] = None
    freight_cost: float
    total_commission: float
    bom_snapshot_hash: Optional[str] = None
    bom_items: list[ContractBOMItemOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════
# SOSTicket 求援工单
# ═══════════════════════════════════════════

class SOSCreate(BaseModel):
    project_id: int
    client_query: str = Field(
        ..., min_length=1, max_length=4000,
        description="客户原声截取 / 前线阻击内容"
    )


class SOSResolve(BaseModel):
    expert_reply: str = Field(
        ..., min_length=1, description="专家批示 / 支援弹药"
    )


class SOSOut(BaseModel):
    id: int
    ticket_no: str
    project_id: int
    requester_id: Optional[int] = None
    client_query: str
    ai_brief: Optional[str] = None
    status: SOSStatusEnum
    expert_reply: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════
# Appeal 撞单申诉
# ═══════════════════════════════════════════

class AppealCreate(BaseModel):
    project_id: Optional[int] = Field(None, description="争议关联的原项目 ID")
    new_project_name: str = Field(..., description="申诉方拟发起的新项目名")
    conflict_with: str = Field(..., description="撞单的原项目名")
    original_owner: str = Field(..., description="原归属人")
    reason: str = Field(..., min_length=1, description="申诉核心依据")
    has_evidence: bool = Field(default=False, description="是否有实锤证据")


class AppealVerdict(BaseModel):
    verdict_note: Optional[str] = Field(None, description="裁决说明")


class AppealOut(BaseModel):
    id: int
    project_id: Optional[int] = None
    new_project_name: str
    conflict_with: str
    applicant: str
    original_owner: str
    reason: str
    has_evidence: bool
    status: AppealStatusEnum
    verdict_note: Optional[str] = None
    judged_by: Optional[str] = None
    judged_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════
# AI 能力层
# ═══════════════════════════════════════════

class AIParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000, description="待解析文本")
    llm_configs: Optional[dict[str, Any]] = Field(None, description="LLM 配置")


class AIGenerateRequest(BaseModel):
    project_id: int
    context: Optional[str] = Field(None, description="额外上下文")
    llm_configs: Optional[dict[str, Any]] = Field(None, description="LLM 配置")


class AICritiqueRequest(BaseModel):
    question: str = Field(..., description="题目")
    answer: str = Field(..., description="用户回答")
    llm_configs: Optional[dict[str, Any]] = None


class AIResponse(BaseModel):
    result: str = ""
    model_used: Optional[str] = None
    error: Optional[str] = None


# ═══════════════════════════════════════════
# 通用响应
# ═══════════════════════════════════════════

class SuccessResponse(BaseModel):
    success: bool = True
    message: str = ""


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
