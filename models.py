"""
企业级 SaaS 数据模型 (SQLAlchemy ORM)
=====================================
基于原版 app.py 3602 行业务逻辑完整提炼。
保留 llm_service.py 中的 GlobalLLMRouter 不动。

核心表：
  1. User          — 用户/销售人员
  2. Project       — 作战项目（含审批、MEDDIC、赢率）
  3. Stakeholder   — 权力地图 / 关键决策链
  4. IntelLog      — 情报日志（多模态）
  5. DealDesk      — 报价底单 + VP 审批状态机
  6. BOMItem       — 报价物料明细行
  7. Contract      — 合同联审流水线（6 步状态机 + 商务条款）
  8. ContractBOMItem — 合同物料明细行
  9. SOSTicket     — 前线紧急求援工单
  10. Appeal        — 撞单申诉仲裁记录
"""

import enum
import hashlib
import json
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, CheckConstraint,
    event,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ═══════════════════════════════════════════
# 枚举类型
# ═══════════════════════════════════════════

class UserRole(str, enum.Enum):
    SALES = "sales"                # 一线销售
    TECH = "tech"                  # 技术工程师
    DIRECTOR = "director"          # 战区总监
    VP = "vp"                      # 销售副总裁
    FINANCE = "finance"            # 财务
    ADMIN = "admin"                # 系统管理员


class ProjectStage(str, enum.Enum):
    """项目阶段 — 映射自 app.py DEFAULT_CONFIGS.project_stages"""
    LEAD = "lead"                        # 线索
    INITIAL_CONTACT = "initial_contact"  # 初期接触
    PROPOSAL = "proposal"                # 方案报价
    NEGOTIATION = "negotiation"          # 商务谈判
    TECH_STALEMATE = "tech_stalemate"    # 技术僵持
    CLOSING = "closing"                  # 逼单/签约
    LOST = "lost"                        # 丢单归档
    WON = "won"                          # 赢单归档


class ProjectApproval(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONFLICT = "conflict"   # 撞单待裁决


class BudgetStatus(str, enum.Enum):
    """预算状态 — 映射自 app.py DEFAULT_CONFIGS.budget_statuses"""
    FULLY_APPROVED = "fully_approved"        # 预算已全额批复
    PARTIAL = "partial"                      # 部分资金到位
    APPLYING = "applying"                    # 正在申报预算
    UNKNOWN = "unknown"                      # 资金来源不明


class CompetitivePosition(str, enum.Enum):
    """竞争卡位 — 映射自 app.py DEFAULT_CONFIGS.position_options"""
    LEADING = "leading"      # 领跑
    PARALLEL = "parallel"    # 并跑
    TRAILING = "trailing"    # 跟跑/陪跑
    UNKNOWN = "unknown"      # 未知


class StakeholderAttitude(str, enum.Enum):
    SUPPORT = "support"      # 🟢 铁杆支持
    NEUTRAL = "neutral"      # 🟡 中立/观望
    OPPOSE = "oppose"        # 🔴 反对/死敌


class DealStatus(str, enum.Enum):
    """报价底单审批状态机: draft → pending → approved / rejected"""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ContractStep(str, enum.Enum):
    """合同联审 6 步状态机 — 映射自 app.py steps 列表"""
    SALES_INIT = "1_sales_init"            # ❶ 销售发起
    TECH_REVIEW = "2_tech_review"          # ❷ 技术超配审查
    SALES_PRICING = "3_sales_pricing"      # ❸ 销售最终定价
    VP_APPROVAL = "4_vp_approval"          # ❹ VP 审批
    CONTRACT_SENT = "5_approved"           # ❺ 合同发送/生效
    COMMISSION = "6_commission"            # ❻ 提成核算


class SOSStatus(str, enum.Enum):
    URGENT = "urgent"        # 🔴 紧急待支援
    RESOLVED = "resolved"    # 🟢 支援已送达


class AppealStatus(str, enum.Enum):
    PENDING = "pending"      # ⚖️ 待裁决
    GRANTED = "granted"      # ✅ 胜诉转移
    DENIED = "denied"        # ❌ 驳回


# ═══════════════════════════════════════════
# 1. User — 用户表
# ═══════════════════════════════════════════

class User(Base):
    """
    用户 / 销售人员。
    映射自 app.py ORG_CHART + DIRECTORS + role 变量。
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="姓名")
    phone = Column(String(20), unique=True, nullable=True, comment="手机号/登录名")
    password_hash = Column(String(256), nullable=True, comment="密码哈希")
    role = Column(Enum(UserRole), nullable=False, default=UserRole.SALES, comment="系统角色")
    dept = Column(String(100), nullable=False, comment="所属战区/部门")
    is_active = Column(Boolean, default=True, comment="是否在职")
    avatar_url = Column(String(500), nullable=True, comment="头像")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 反向关联
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    intel_logs = relationship("IntelLog", back_populates="author")
    sos_tickets = relationship("SOSTicket", back_populates="requester", foreign_keys="SOSTicket.requester_id")

    def __repr__(self):
        return f"<User {self.name} [{self.dept}/{self.role.value}]>"


# ═══════════════════════════════════════════
# 2. Project — 作战项目表
# ═══════════════════════════════════════════

class Project(Base):
    """
    作战项目。
    映射自 app.py st.session_state.projects 富字典 + pending_projects 审批池。
    核心字段：客户名、设计院、总包方、预算状态、竞争卡位、MEDDIC 七维赢率。
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # ── 基本信息 ──
    name = Column(String(200), nullable=False, index=True, comment="项目全称 (客户-项目名)")
    client = Column(String(200), nullable=False, index=True, comment="终端客户/业主")
    project_title = Column(String(200), nullable=True, comment="项目简称/标段名")
    design_institute = Column(String(200), nullable=True, comment="设计院/总包")
    general_contractor = Column(String(200), nullable=True, comment="施工方/EPC 总包")

    # ── 归属与审批 ──
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, comment="项目责任人")
    dept = Column(String(100), nullable=True, comment="归属战区")
    applicant_name = Column(String(100), nullable=True, comment="提报人姓名")
    approval_status = Column(
        Enum(ProjectApproval), default=ProjectApproval.PENDING,
        comment="立项审批状态: pending→approved/rejected/conflict"
    )
    approved_at = Column(DateTime, nullable=True, comment="审批通过时间")
    approved_by = Column(String(100), nullable=True, comment="审批人")

    # ── 销售阶段与竞争态势 ──
    stage = Column(
        Enum(ProjectStage), default=ProjectStage.LEAD,
        comment="项目阶段: lead→initial_contact→proposal→negotiation→..."
    )
    budget_status = Column(Enum(BudgetStatus), default=BudgetStatus.UNKNOWN, comment="预算审批状态")
    competitive_position = Column(Enum(CompetitivePosition), default=CompetitivePosition.UNKNOWN, comment="竞争卡位")
    info_source = Column(String(200), nullable=True, comment="信息来源渠道")
    project_driver = Column(String(200), nullable=True, comment="项目驱动力")
    estimated_amount = Column(Float, default=0, comment="预估金额(万元)")
    expected_close_date = Column(DateTime, nullable=True, comment="预计签单日期")

    # ── MEDDIC 七维赢率评估 (各项 0-100 独立打分) ──
    meddic_metrics = Column(Integer, default=0, comment="M — 量化指标")
    meddic_economic_buyer = Column(Integer, default=0, comment="E — 经济决策者")
    meddic_decision_criteria = Column(Integer, default=0, comment="D — 决策标准")
    meddic_decision_process = Column(Integer, default=0, comment="D — 决策流程")
    meddic_identify_pain = Column(Integer, default=0, comment="I — 核心痛点")
    meddic_champion = Column(Integer, default=0, comment="C — 内部教练")
    meddic_relationship = Column(Integer, default=0, comment="R — 利益关系")
    win_rate = Column(Float, default=0, comment="综合赢率 (加权计算，0-100)")

    # ── 时间戳 ──
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── 关联 ──
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    stakeholders = relationship("Stakeholder", back_populates="project", cascade="all, delete-orphan")
    intel_logs = relationship("IntelLog", back_populates="project", cascade="all, delete-orphan")
    deal_desks = relationship("DealDesk", back_populates="project", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="project", cascade="all, delete-orphan")
    sos_tickets = relationship("SOSTicket", back_populates="project", cascade="all, delete-orphan")
    appeals = relationship("Appeal", back_populates="project", foreign_keys="Appeal.project_id")

    def __repr__(self):
        return f"<Project {self.name} [{self.stage.value}]>"


# ═══════════════════════════════════════════
# 3. Stakeholder — 权力地图 / 关键决策链
# ═══════════════════════════════════════════

class Stakeholder(Base):
    """
    权力地图中的关键人物。
    映射自 app.py st.session_state.stakeholders[proj] DataFrame 列：
    姓名, 职位, 角色(支持复选), 态度, 影响力(1-10), 上级/汇报给
    """
    __tablename__ = "stakeholders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(100), nullable=False, comment="姓名")
    title = Column(String(100), nullable=True, comment="职位")
    role_tags = Column(String(500), nullable=True,
                       comment="角色标签(逗号分隔): 决策者/使用者/影响者/教练内线/技术把关者")
    attitude = Column(
        Enum(StakeholderAttitude), default=StakeholderAttitude.NEUTRAL,
        comment="态度: support/neutral/oppose"
    )
    influence_weight = Column(Integer, default=5,
                              comment="影响力权重 1-10")
    reports_to = Column(String(100), nullable=True, comment="上级/汇报给谁")
    phone = Column(String(50), nullable=True, comment="联系方式")
    notes = Column(Text, nullable=True, comment="策略备注")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 约束
    __table_args__ = (
        CheckConstraint("influence_weight >= 1 AND influence_weight <= 10", name="ck_influence_range"),
    )

    project = relationship("Project", back_populates="stakeholders")

    def __repr__(self):
        return f"<Stakeholder {self.name} [{self.attitude.value}] w={self.influence_weight}>"


# ═══════════════════════════════════════════
# 4. IntelLog — 情报日志（多模态）
# ═══════════════════════════════════════════

class IntelLog(Base):
    """
    情报日志。
    映射自 database.py save_intelligence / get_project_data 的 (id, created_at, raw_input, ai_parsed_data)。
    扩展多模态支持：图片/音频/视频附件哈希。
    """
    __tablename__ = "intel_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True, comment="录入人")

    # ── 原始输入 ──
    raw_input = Column(Text, nullable=True, comment="原始口述/文本输入")
    input_type = Column(String(20), default="text",
                        comment="输入类型: text/image/audio/video/document")
    attachment_hash = Column(String(64), nullable=True,
                             comment="多模态附件 SHA-256 哈希 (防篡改)")
    attachment_url = Column(String(500), nullable=True, comment="附件存储路径/URL")

    # ── AI 解析结果 ──
    ai_parsed_json = Column(Text, nullable=True,
                            comment="AI 结构化解析结果 (4+1 情报模型 JSON)")
    ai_model_used = Column(String(100), nullable=True, comment="使用的 AI 模型标识")

    created_at = Column(DateTime, default=datetime.utcnow)

    # 关联
    project = relationship("Project", back_populates="intel_logs")
    author = relationship("User", back_populates="intel_logs")

    def __repr__(self):
        return f"<IntelLog #{self.id} proj={self.project_id} type={self.input_type}>"


# ═══════════════════════════════════════════
# 5. DealDesk — 报价底单 + VP 审批状态机
# ═══════════════════════════════════════════

class DealDesk(Base):
    """
    智能报价底单。
    映射自 app.py tab_deal_desk：
    - BOM 表格 → 子表 BOMItem
    - 审批状态机: draft → pending → approved / rejected
    - 防篡改校验哈希
    """
    __tablename__ = "deal_desks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    # ── 询价信息 ──
    inquiry_client = Column(String(200), nullable=True, comment="询价客户主体")
    inquiry_contact = Column(String(200), nullable=True, comment="AI 抓取的客户联系方式")

    # ── 审批状态机 ──
    status = Column(
        Enum(DealStatus), default=DealStatus.DRAFT,
        comment="审批状态: draft→pending→approved/rejected"
    )
    submitted_by = Column(String(100), nullable=True, comment="提交人")
    approved_by = Column(String(100), nullable=True, comment="VP 审批人")
    reject_reason = Column(Text, nullable=True, comment="驳回原因")

    # ── 财务数据 ──
    total_amount = Column(Float, default=0, comment="核定总金额(元)")
    tamper_hash = Column(String(64), nullable=True,
                         comment="BOM 防篡改 SHA-256 校验哈希")

    # ── 变更侦测 ──
    diff_summary = Column(Text, nullable=True, comment="天眼变更侦测摘要")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True, comment="审批通过时间")

    # 关联
    project = relationship("Project", back_populates="deal_desks")
    bom_items = relationship("BOMItem", back_populates="deal_desk", cascade="all, delete-orphan")

    def compute_tamper_hash(self) -> str:
        """基于 BOM 明细计算防篡改哈希。"""
        payload = json.dumps(
            [{"model": i.product_model, "qty": i.sales_qty, "price": i.unit_price}
             for i in sorted(self.bom_items, key=lambda x: x.id or 0)],
            ensure_ascii=False, sort_keys=True
        )
        return hashlib.sha256(payload.encode()).hexdigest()

    def __repr__(self):
        return f"<DealDesk #{self.id} status={self.status.value} ¥{self.total_amount:,.0f}>"


class BOMItem(Base):
    """报价物料明细行 (BOM)。"""
    __tablename__ = "bom_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deal_desk_id = Column(Integer, ForeignKey("deal_desks.id", ondelete="CASCADE"), nullable=False)

    product_model = Column(String(200), nullable=False, comment="产品型号")
    ai_extracted_qty = Column(Integer, default=0, comment="AI 提取数量")
    sales_qty = Column(Integer, default=0, comment="销售核定数量")
    unit_price = Column(Float, default=0, comment="标准单价(元)")
    subtotal = Column(Float, default=0, comment="小计(元)")
    remark = Column(Text, nullable=True, comment="备注")

    deal_desk = relationship("DealDesk", back_populates="bom_items")

    def __repr__(self):
        return f"<BOMItem {self.product_model} x{self.sales_qty} @¥{self.unit_price}>"


# ═══════════════════════════════════════════
# 6. Contract — 合同联审流水线 (6 步状态机)
# ═══════════════════════════════════════════

class Contract(Base):
    """
    合同联审流水线。
    映射自 app.py tab_contract，6 步状态机：
    1_sales_init → 2_tech_review → 3_sales_pricing → 4_vp_approval → 5_approved → 6_commission
    包含完整的商务条款（付款比例、货期、质保、发货地址）。
    """
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    # ── 6 步状态机 ──
    step = Column(
        Enum(ContractStep), default=ContractStep.SALES_INIT,
        comment="当前步骤: 1_sales_init→…→6_commission"
    )

    # ── 商务条款 (第三步销售填写) ──
    pay_method = Column(String(100), nullable=True,
                        comment="支付方式: 电汇T/T, 承兑汇票, 信用证")
    delivery_time = Column(String(200), nullable=True, comment="货期承诺")
    warranty_period = Column(String(200), nullable=True, comment="质保期限")

    # ── 付款节点比例 (严格风控：总和=100) ──
    ratio_advance = Column(Integer, default=30, comment="预付款 %")
    ratio_delivery = Column(Integer, default=30, comment="发货款 %")
    ratio_accept = Column(Integer, default=30, comment="验收款 %")
    ratio_warranty = Column(Integer, default=10, comment="质保金 %")

    # ── 物流交接 ──
    delivery_address = Column(Text, nullable=True, comment="发货/现场接收地址")
    receiver_contact = Column(String(200), nullable=True, comment="收货人及联系方式")

    # ── 提成核算 (第六步) ──
    commission_formula = Column(String(100), nullable=True,
                                comment="提成公式: 毛利提成 / 全额提成")
    freight_cost = Column(Float, default=0, comment="运费/杂费扣减(元)")
    total_commission = Column(Float, default=0, comment="最终应发提成(元)")

    # ── 防篡改 ──
    bom_snapshot_hash = Column(String(64), nullable=True,
                               comment="BOM 快照 SHA-256 (VP 审批时锁定)")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 约束: 付款比例之和 = 100
    __table_args__ = (
        CheckConstraint(
            "ratio_advance + ratio_delivery + ratio_accept + ratio_warranty = 100",
            name="ck_payment_ratio_sum_100"
        ),
    )

    # 关联
    project = relationship("Project", back_populates="contracts")
    bom_items = relationship("ContractBOMItem", back_populates="contract", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Contract #{self.id} step={self.step.value}>"


class ContractBOMItem(Base):
    """合同 BOM 明细行 (含技术超配字段)。"""
    __tablename__ = "contract_bom_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)

    product_model = Column(String(200), nullable=False, comment="产品型号")
    ai_extracted_qty = Column(Integer, default=0, comment="AI 提取数量")
    sales_qty = Column(Integer, default=0, comment="销售核定数量")
    tech_qty = Column(Integer, default=0, comment="技术核定数量 (超配审查)")
    final_qty = Column(Integer, default=0, comment="最终报价数量")
    unit_price = Column(Float, default=0, comment="单价(元)")
    base_price = Column(Float, default=0, comment="公司结算底价(元) — 提成计算用")
    overalloc_note = Column(Text, nullable=True, comment="超配说明")
    commission_ratio = Column(Float, default=0.10, comment="提成比例 (默认 10%)")
    remark = Column(Text, nullable=True, comment="备注")

    contract = relationship("Contract", back_populates="bom_items")

    def __repr__(self):
        return f"<ContractBOMItem {self.product_model} x{self.final_qty}>"


# ═══════════════════════════════════════════
# 7. SOSTicket — 前线紧急求援工单
# ═══════════════════════════════════════════

class SOSTicket(Base):
    """
    前线 SOS 调度中心工单。
    映射自 app.py st.session_state.sos_tickets。
    """
    __tablename__ = "sos_tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_no = Column(String(20), unique=True, nullable=False,
                       comment="工单编号 T-2026-XXXX")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=True, comment="发起求援的销售")

    # ── 核心内容 ──
    client_query = Column(Text, nullable=False, comment="客户原声截取 / 前线阻击内容")
    ai_brief = Column(Text, nullable=True, comment="AI 自动提炼的求援需求摘要")
    status = Column(
        Enum(SOSStatus), default=SOSStatus.URGENT,
        comment="工单状态: urgent→resolved"
    )

    # ── 专家批示 ──
    expert_reply = Column(Text, nullable=True, comment="专家/总监的支援弹药批示")
    resolved_by = Column(String(100), nullable=True, comment="批示人")
    resolved_at = Column(DateTime, nullable=True, comment="批示时间")

    created_at = Column(DateTime, default=datetime.utcnow)

    # 关联
    project = relationship("Project", back_populates="sos_tickets")
    requester = relationship("User", back_populates="sos_tickets", foreign_keys=[requester_id])

    def __repr__(self):
        return f"<SOSTicket {self.ticket_no} [{self.status.value}]>"


# ═══════════════════════════════════════════
# 8. Appeal — 撞单申诉仲裁记录
# ═══════════════════════════════════════════

class Appeal(Base):
    """
    撞单归属权争议仲裁。
    映射自 app.py st.session_state.appeals。
    """
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True,
                        comment="争议关联的原项目 ID")

    # ── 争议双方 ──
    new_project_name = Column(String(200), nullable=False, comment="申诉方提交的新项目名")
    conflict_with = Column(String(200), nullable=False, comment="原归属项目名")
    applicant = Column(String(100), nullable=False, comment="申诉人 (抢单者)")
    original_owner = Column(String(100), nullable=False, comment="原归属人 (守单者)")

    # ── 申诉内容 ──
    reason = Column(Text, nullable=False, comment="申诉核心依据")
    has_evidence = Column(Boolean, default=False, comment="是否上传实锤证据")
    evidence_url = Column(String(500), nullable=True, comment="证据附件路径")

    # ── 裁决 ──
    status = Column(
        Enum(AppealStatus), default=AppealStatus.PENDING,
        comment="仲裁状态: pending→granted/denied"
    )
    verdict_note = Column(Text, nullable=True, comment="裁决说明")
    judged_by = Column(String(100), nullable=True, comment="裁决人")
    judged_at = Column(DateTime, nullable=True, comment="裁决时间")

    created_at = Column(DateTime, default=datetime.utcnow)

    # 关联
    project = relationship("Project", back_populates="appeals", foreign_keys=[project_id])

    def __repr__(self):
        return f"<Appeal {self.applicant} vs {self.original_owner} [{self.status.value}]>"


# ═══════════════════════════════════════════
# SQLAlchemy Event: BOMItem 小计自动计算
# ═══════════════════════════════════════════

@event.listens_for(BOMItem, "before_insert")
@event.listens_for(BOMItem, "before_update")
def _calc_bom_subtotal(mapper, connection, target):
    target.subtotal = (target.sales_qty or 0) * (target.unit_price or 0)
