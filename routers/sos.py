"""
路由：SOS 前线紧急求援 — routers/sos.py
==========================================
状态机: urgent → resolved
AI 自动生成求援摘要，总监/专家批示后流转。
"""

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import Project, SOSStatus, SOSTicket, User, UserRole
from schemas import SOSCreate, SOSOut, SOSResolve
from services.llm_service import AITask, build_ai_gateway
from utils.dependencies import get_current_user, get_db, require_role
from utils.security import mask_sensitive_info

router = APIRouter(prefix="/api/sos", tags=["SOS 求援工单"])


@router.post("", response_model=SOSOut, status_code=201)
def create_sos(
    body: SOSCreate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    发起 SOS 求援。
    1. 保存客户原声
    2. 🛡️ 脱敏后调用 AI 生成求援摘要 (AITask.SOS_BRIEF)
    3. 状态 → urgent
    """
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(404, f"项目 #{body.project_id} 不存在")

    ticket_no = f"T-{datetime.now().strftime('%Y')}-{random.randint(1000, 9999)}"

    # ═══ 隐私红线：脱敏 ═══
    sanitized_query = mask_sensitive_info(body.client_query)

    # AI 生成求援摘要
    ai_brief = ""
    try:
        gw = build_ai_gateway()
        sos_prompt = (
            f"你是前线销售的 AI 战术助理。客户刚刚在现场提出了以下棘手问题：\n"
            f'"{sanitized_query}"\n'
            f"当前关联项目：【{project.name}】\n\n"
            f"请帮销售向后方的【核心技术与商务专家群】写一段极其简短、专业的求援需求（3点以内）。"
        )
        ai_brief = gw.chat(
            messages=[{"role": "user", "content": sos_prompt}],
            task=AITask.SOS_BRIEF,
        )
    except Exception as e:
        ai_brief = f"(AI 摘要生成失败: {str(e)[:100]})"

    ticket = SOSTicket(
        ticket_no=ticket_no,
        project_id=body.project_id,
        requester_id=user.id,
        client_query=body.client_query,   # 原文保留
        ai_brief=ai_brief,
        status=SOSStatus.URGENT,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("", response_model=list[SOSOut])
def list_sos(
    status_filter: SOSStatus | None = Query(None, alias="status"),
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP, UserRole.TECH)),
    db: Session = Depends(get_db),
):
    """所有工单列表。可按状态筛选。"""
    q = db.query(SOSTicket)
    if status_filter:
        q = q.filter(SOSTicket.status == status_filter)
    return q.order_by(SOSTicket.created_at.desc()).all()


@router.post("/{ticket_id}/resolve", response_model=SOSOut)
def resolve_sos(
    ticket_id: int,
    body: SOSResolve,
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP, UserRole.TECH)),
    db: Session = Depends(get_db),
):
    """
    状态机: urgent → resolved
    写入专家批示 (expert_reply)。
    """
    ticket = db.query(SOSTicket).filter(SOSTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, f"工单 #{ticket_id} 不存在")
    if ticket.status != SOSStatus.URGENT:
        raise HTTPException(400, "该工单已处理完毕，无需重复批示")

    ticket.status = SOSStatus.RESOLVED
    ticket.expert_reply = body.expert_reply
    ticket.resolved_by = user.name
    ticket.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(ticket)
    return ticket


@router.delete("/resolved")
def clear_resolved(
    user: User = Depends(require_role(UserRole.DIRECTOR)),
    db: Session = Depends(get_db),
):
    """批量销毁已处理工单。仅限总监。"""
    count = db.query(SOSTicket).filter(
        SOSTicket.status == SOSStatus.RESOLVED
    ).delete()
    db.commit()
    return {"success": True, "message": f"已销毁 {count} 个已处理工单"}
