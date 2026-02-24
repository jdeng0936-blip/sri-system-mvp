"""
路由：项目管理与撞单拦截 — routers/projects.py
=================================================
状态机: pending → approved / rejected / conflict
内置 AI 模糊查重引擎：客户名互相包含即触发 conflict。
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from models import (
    Project, ProjectApproval, ProjectStage,
    User, UserRole,
)
from schemas import (
    MEDDICUpdate, ProjectCreate, ProjectOut, ProjectUpdate,
    SuccessResponse,
)
from utils.dependencies import get_current_user, get_db, require_role

router = APIRouter(prefix="/api/projects", tags=["Project 项目管理"])


# ─────────────────────────────────────────
# 辅助函数
# ─────────────────────────────────────────

def _get_project_or_404(project_id: int, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, f"项目 #{project_id} 不存在")
    return p


def _check_collision(client: str, title: str, db: Session) -> Optional[Project]:
    """
    撞单查重引擎：检查是否存在客户名互相包含的项目。
    例如：新项目客户="万华化学"，已有项目客户="万华化学集团" → 触发。
    """
    existing = db.query(Project).filter(
        Project.approval_status.in_([
            ProjectApproval.PENDING,
            ProjectApproval.APPROVED,
        ])
    ).all()

    client_clean = client.strip().lower()
    for p in existing:
        p_client = (p.client or "").strip().lower()
        p_title = (p.project_title or "").strip().lower()
        title_clean = title.strip().lower()

        # 双向包含检测
        client_match = (client_clean in p_client) or (p_client in client_clean)
        title_match = (title_clean in p_title) or (p_title in title_clean)

        # 客户名匹配 + 项目名匹配 = 高度疑似撞单
        if client_match and title_match:
            return p
        # 客户名完全一致 = 直接预警
        if client_clean == p_client:
            return p

    return None


def _calc_win_rate(project: Project) -> float:
    """根据 MEDDIC 七维评分加权计算综合赢率。"""
    weights = {
        "metrics": 0.15,
        "economic_buyer": 0.20,
        "decision_criteria": 0.15,
        "decision_process": 0.10,
        "identify_pain": 0.15,
        "champion": 0.15,
        "relationship": 0.10,
    }
    score = (
        project.meddic_metrics * weights["metrics"]
        + project.meddic_economic_buyer * weights["economic_buyer"]
        + project.meddic_decision_criteria * weights["decision_criteria"]
        + project.meddic_decision_process * weights["decision_process"]
        + project.meddic_identify_pain * weights["identify_pain"]
        + project.meddic_champion * weights["champion"]
        + project.meddic_relationship * weights["relationship"]
    )
    return round(score, 1)


# ═══════════════════════════════════════════
# GET /api/projects — 项目列表 (数据隔离)
# ═══════════════════════════════════════════

@router.get("", response_model=list[ProjectOut])
def list_projects(
    stage: Optional[ProjectStage] = Query(None, description="按阶段筛选"),
    approval: Optional[ProjectApproval] = Query(None, description="按审批状态筛选"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    项目列表 — 按角色数据隔离：
    - sales:    仅见自己 owner 的项目
    - tech:     同战区项目 (只读)
    - director: 本战区全部
    - vp/admin: 全部
    """
    q = db.query(Project)

    # 角色数据隔离
    if user.role == UserRole.SALES:
        q = q.filter(Project.owner_id == user.id)
    elif user.role in (UserRole.TECH, UserRole.DIRECTOR):
        q = q.filter(Project.dept == user.dept)
    # VP / ADMIN / FINANCE: 不过滤

    # 可选筛选条件
    if stage:
        q = q.filter(Project.stage == stage)
    if approval:
        q = q.filter(Project.approval_status == approval)

    return q.order_by(Project.updated_at.desc()).all()


# ═══════════════════════════════════════════
# GET /api/projects/pending — 待审核列表
# ═══════════════════════════════════════════

@router.get("/pending", response_model=list[ProjectOut])
def list_pending_projects(
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP)),
    db: Session = Depends(get_db),
):
    """待审核项目列表。仅限 director / VP / admin。"""
    q = db.query(Project).filter(
        Project.approval_status == ProjectApproval.PENDING
    )

    # director 只看本战区
    if user.role == UserRole.DIRECTOR:
        q = q.filter(Project.dept == user.dept)

    return q.order_by(Project.created_at.desc()).all()


# ═══════════════════════════════════════════
# POST /api/projects — 提交立项 (含撞单检测)
# ═══════════════════════════════════════════

@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    销售提交立项申请。
    ⚠️ 内置撞单查重引擎：
    - 客户名互相包含 → 自动标记 conflict 状态
    - 客户名完全一致 → 直接拒绝
    """
    # 组合全称: "客户 - 项目名"
    full_name = f"{body.client} - {body.project_title}"

    # ═══════════════════════════════════════
    # 🔍 撞单查重引擎
    # ═══════════════════════════════════════
    collision = _check_collision(body.client, body.project_title, db)
    if collision:
        # 客户名完全一致 + 项目名也一致 → 直接拒绝
        if (collision.client.strip().lower() == body.client.strip().lower()
            and (collision.project_title or "").strip().lower()
                == body.project_title.strip().lower()):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"🚨 撞单拦截：与现有项目 [{collision.name}] "
                f"(归属: {collision.applicant_name}) 完全重复！"
            )

        # 模糊匹配 → 创建但标记 conflict
        project = Project(
            name=full_name,
            client=body.client,
            project_title=body.project_title,
            design_institute=body.design_institute,
            general_contractor=body.general_contractor,
            info_source=body.info_source,
            project_driver=body.project_driver,
            estimated_amount=body.estimated_amount or 0,
            owner_id=user.id,
            dept=user.dept,
            applicant_name=user.name,
            approval_status=ProjectApproval.CONFLICT,
            stage=ProjectStage.LEAD,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    # 无撞单 → 正常进入 pending 审批池
    project = Project(
        name=full_name,
        client=body.client,
        project_title=body.project_title,
        design_institute=body.design_institute,
        general_contractor=body.general_contractor,
        info_source=body.info_source,
        project_driver=body.project_driver,
        estimated_amount=body.estimated_amount or 0,
        owner_id=user.id,
        dept=user.dept,
        applicant_name=user.name,
        approval_status=ProjectApproval.PENDING,
        stage=ProjectStage.LEAD,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


# ═══════════════════════════════════════════
# GET /api/projects/{id} — 项目详情
# ═══════════════════════════════════════════

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_project_or_404(project_id, db)


# ═══════════════════════════════════════════
# PATCH /api/projects/{id} — 更新项目字段
# ═══════════════════════════════════════════

@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """更新项目字段。仅限 Owner / admin。"""
    project = _get_project_or_404(project_id, db)

    # Owner 校验 (admin 跳过)
    if user.role != UserRole.ADMIN and project.owner_id != user.id:
        raise HTTPException(403, "🔒 越权拦截：您不是该项目的负责人")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


# ═══════════════════════════════════════════
# POST /api/projects/{id}/approve — 审批通过
# ═══════════════════════════════════════════

@router.post("/{project_id}/approve", response_model=ProjectOut)
def approve_project(
    project_id: int,
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP)),
    db: Session = Depends(get_db),
):
    """
    状态机: pending/conflict → approved
    仅限 director / VP / admin。
    """
    project = _get_project_or_404(project_id, db)

    if project.approval_status not in (
        ProjectApproval.PENDING, ProjectApproval.CONFLICT
    ):
        raise HTTPException(
            400,
            f"当前审批状态为 [{project.approval_status.value}]，"
            f"仅 pending/conflict 可审批"
        )

    # director 只能审批自己战区
    if user.role == UserRole.DIRECTOR and project.dept != user.dept:
        raise HTTPException(
            403,
            f"🔒 越权拦截：该项目属于 [{project.dept}]，"
            f"您只能审批 [{user.dept}]"
        )

    project.approval_status = ProjectApproval.APPROVED
    project.approved_by = user.name
    project.approved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(project)
    return project


# ═══════════════════════════════════════════
# POST /api/projects/{id}/reject — 驳回立项
# ═══════════════════════════════════════════

@router.post("/{project_id}/reject", response_model=ProjectOut)
def reject_project(
    project_id: int,
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP)),
    db: Session = Depends(get_db),
):
    """状态机: pending/conflict → rejected。"""
    project = _get_project_or_404(project_id, db)

    if project.approval_status not in (
        ProjectApproval.PENDING, ProjectApproval.CONFLICT
    ):
        raise HTTPException(
            400,
            f"当前审批状态为 [{project.approval_status.value}]，"
            f"仅 pending/conflict 可驳回"
        )

    project.approval_status = ProjectApproval.REJECTED

    db.commit()
    db.refresh(project)
    return project


# ═══════════════════════════════════════════
# POST /api/projects/{id}/meddic — MEDDIC 七维评分
# ═══════════════════════════════════════════

@router.post("/{project_id}/meddic", response_model=ProjectOut)
def update_meddic(
    project_id: int,
    body: MEDDICUpdate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    更新 MEDDIC 七维评分。
    服务端自动根据加权公式重算 win_rate（赢率）。
    """
    project = _get_project_or_404(project_id, db)

    # Owner 校验
    if user.role != UserRole.ADMIN and project.owner_id != user.id:
        raise HTTPException(403, "🔒 越权拦截：您不是该项目的负责人")

    project.meddic_metrics = body.meddic_metrics
    project.meddic_economic_buyer = body.meddic_economic_buyer
    project.meddic_decision_criteria = body.meddic_decision_criteria
    project.meddic_decision_process = body.meddic_decision_process
    project.meddic_identify_pain = body.meddic_identify_pain
    project.meddic_champion = body.meddic_champion
    project.meddic_relationship = body.meddic_relationship

    # 自动重算综合赢率
    project.win_rate = _calc_win_rate(project)

    db.commit()
    db.refresh(project)
    return project
