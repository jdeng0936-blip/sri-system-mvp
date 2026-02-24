"""
路由：撞单申诉仲裁法庭 — routers/appeals.py
===============================================
状态机: pending → granted / denied
VP 裁决 (grant) 时：同一事务中强制 UPDATE Project 的 owner/applicant。
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import Appeal, AppealStatus, Project, User, UserRole
from schemas import AppealCreate, AppealOut, AppealVerdict
from utils.dependencies import get_current_user, get_db, require_role

router = APIRouter(prefix="/api/appeals", tags=["Appeal 撞单仲裁"])


@router.post("", response_model=AppealOut, status_code=201)
def create_appeal(
    body: AppealCreate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """提交撞单申诉。"""
    appeal = Appeal(
        project_id=body.project_id,
        new_project_name=body.new_project_name,
        conflict_with=body.conflict_with,
        applicant=user.name,
        original_owner=body.original_owner,
        reason=body.reason,
        has_evidence=body.has_evidence,
        status=AppealStatus.PENDING,
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return appeal


@router.get("/pending", response_model=list[AppealOut])
def list_pending(
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP)),
    db: Session = Depends(get_db),
):
    return (
        db.query(Appeal)
        .filter(Appeal.status == AppealStatus.PENDING)
        .order_by(Appeal.created_at.desc())
        .all()
    )


@router.post("/{appeal_id}/grant", response_model=AppealOut)
def grant_appeal(
    appeal_id: int,
    body: AppealVerdict | None = None,
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP)),
    db: Session = Depends(get_db),
):
    """
    仲裁裁决：pending → granted
    ⚠️ 核心事务联动：同一个 Transaction 中强行 UPDATE Project 归属权。
    """
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(404, f"申诉 #{appeal_id} 不存在")
    if appeal.status != AppealStatus.PENDING:
        raise HTTPException(400, f"该申诉已裁决 [{appeal.status.value}]")

    # ═══ 同一事务：更新申诉 + 强制转移项目归属权 ═══
    appeal.status = AppealStatus.GRANTED
    appeal.judged_by = user.name
    appeal.judged_at = datetime.now(timezone.utc)
    if body and body.verdict_note:
        appeal.verdict_note = body.verdict_note

    # 强制转移项目的 owner 和 applicant
    if appeal.project_id:
        project = db.query(Project).filter(Project.id == appeal.project_id).first()
        if project:
            project.applicant_name = appeal.applicant
            # 查找申诉人的 user_id 并更新 owner_id
            applicant_user = db.query(User).filter(User.name == appeal.applicant).first()
            if applicant_user:
                project.owner_id = applicant_user.id

    # 单次 commit 保证事务原子性
    db.commit()
    db.refresh(appeal)
    return appeal


@router.post("/{appeal_id}/deny", response_model=AppealOut)
def deny_appeal(
    appeal_id: int,
    body: AppealVerdict | None = None,
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP)),
    db: Session = Depends(get_db),
):
    """仲裁驳回：pending → denied。"""
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(404, f"申诉 #{appeal_id} 不存在")
    if appeal.status != AppealStatus.PENDING:
        raise HTTPException(400, f"该申诉已裁决 [{appeal.status.value}]")

    appeal.status = AppealStatus.DENIED
    appeal.judged_by = user.name
    appeal.judged_at = datetime.now(timezone.utc)
    if body and body.verdict_note:
        appeal.verdict_note = body.verdict_note

    db.commit()
    db.refresh(appeal)
    return appeal
