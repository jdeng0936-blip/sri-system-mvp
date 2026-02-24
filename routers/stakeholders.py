"""
路由：权力地图 — routers/stakeholders.py
==========================================
支持批量覆写和单点更新，紧密校验 Project 归属权。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import Project, Stakeholder, StakeholderAttitude, User, UserRole
from schemas import StakeholderCreate, StakeholderOut, StakeholderUpdate
from utils.dependencies import get_current_user, get_db, require_role

router = APIRouter(prefix="/api/projects/{project_id}/stakeholders", tags=["Stakeholder 权力地图"])


def _get_project_checked(project_id: int, user: User, db: Session) -> Project:
    """校验项目存在性 + 归属权限。"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, f"项目 #{project_id} 不存在")
    # 写操作需 owner 或 admin
    if user.role not in (UserRole.ADMIN, UserRole.VP):
        if project.owner_id != user.id and project.dept != user.dept:
            raise HTTPException(403, "🔒 越权拦截：您无权操作该项目的关键人")
    return project


@router.get("", response_model=list[StakeholderOut])
def list_stakeholders(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Stakeholder)
        .filter(Stakeholder.project_id == project_id)
        .order_by(Stakeholder.influence_weight.desc())
        .all()
    )


@router.post("", response_model=StakeholderOut, status_code=201)
def add_stakeholder(
    project_id: int,
    body: StakeholderCreate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    _get_project_checked(project_id, user, db)
    sh = Stakeholder(
        project_id=project_id,
        name=body.name,
        title=body.title,
        role_tags=body.role_tags,
        attitude=StakeholderAttitude(body.attitude.value),
        influence_weight=body.influence_weight,
        reports_to=body.reports_to,
        phone=body.phone,
        notes=body.notes,
    )
    db.add(sh)
    db.commit()
    db.refresh(sh)
    return sh


@router.post("/batch", response_model=list[StakeholderOut], status_code=201)
def batch_upsert_stakeholders(
    project_id: int,
    items: list[StakeholderCreate],
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    批量覆写：清空现有关键人，写入新列表（AI 提取后常用）。
    """
    _get_project_checked(project_id, user, db)
    db.query(Stakeholder).filter(Stakeholder.project_id == project_id).delete()
    result = []
    for item in items:
        sh = Stakeholder(
            project_id=project_id,
            name=item.name,
            title=item.title,
            role_tags=item.role_tags,
            attitude=StakeholderAttitude(item.attitude.value),
            influence_weight=item.influence_weight,
            reports_to=item.reports_to,
            phone=item.phone,
            notes=item.notes,
        )
        db.add(sh)
        result.append(sh)
    db.commit()
    for s in result:
        db.refresh(s)
    return result


@router.patch("/{stakeholder_id}", response_model=StakeholderOut)
def update_stakeholder(
    project_id: int,
    stakeholder_id: int,
    body: StakeholderUpdate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    _get_project_checked(project_id, user, db)
    sh = db.query(Stakeholder).filter(
        Stakeholder.id == stakeholder_id,
        Stakeholder.project_id == project_id,
    ).first()
    if not sh:
        raise HTTPException(404, "关键人不存在")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sh, field, value)
    db.commit()
    db.refresh(sh)
    return sh


@router.delete("/{stakeholder_id}")
def delete_stakeholder(
    project_id: int,
    stakeholder_id: int,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    _get_project_checked(project_id, user, db)
    sh = db.query(Stakeholder).filter(
        Stakeholder.id == stakeholder_id,
        Stakeholder.project_id == project_id,
    ).first()
    if not sh:
        raise HTTPException(404, "关键人不存在")
    db.delete(sh)
    db.commit()
    return {"success": True, "message": f"已删除关键人 [{sh.name}]"}
