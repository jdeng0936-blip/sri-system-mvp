"""
路由：AI 能力层 — routers/ai.py
==================================
接入 AIGateway (services/llm_service.py)。
7 个端点：全部走场景化路由 + 全部强制脱敏。

⚠️ 隐私安全红线：
   所有用户输入在发送给 GlobalLLMRouter 之前，
   必须通过 mask_sensitive_info() 脱敏清洗。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import IntelLog, Project, Stakeholder, User, UserRole
from schemas import (
    AICritiqueRequest, AIGenerateRequest, AIParseRequest, AIResponse,
)
from services.llm_service import AITask, build_ai_gateway
from utils.dependencies import get_current_user, get_db, require_role
from utils.security import mask_sensitive_info

router = APIRouter(prefix="/api/ai", tags=["AI 能力层"])


# ─────────────────────────────────────────
# 辅助
# ─────────────────────────────────────────

def _build_gateway(llm_configs: dict | None = None):
    return build_ai_gateway(llm_configs=llm_configs)


def _get_project_context(project_id: int, db: Session) -> str:
    """聚合项目全量情报作为 AI 上下文。"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, f"项目 #{project_id} 不存在")

    logs = (
        db.query(IntelLog)
        .filter(IntelLog.project_id == project_id)
        .order_by(IntelLog.created_at.desc())
        .limit(20)
        .all()
    )
    stakeholders = (
        db.query(Stakeholder)
        .filter(Stakeholder.project_id == project_id)
        .all()
    )

    parts = [
        f"【项目】{project.name}",
        f"【客户】{project.client}",
        f"【阶段】{project.stage.value if project.stage else 'N/A'}",
        f"【赢率】{project.win_rate}%",
    ]
    if stakeholders:
        parts.append("【关键人】")
        for s in stakeholders:
            parts.append(
                f"  - {s.name} ({s.title}) 态度={s.attitude.value} 影响力={s.influence_weight}"
            )
    if logs:
        parts.append("【近期情报】")
        for log in logs[:10]:
            parts.append(f"  [{log.created_at:%Y-%m-%d}] {(log.raw_input or '')[:300]}")

    return "\n".join(parts)


# ═══════════════════════════════════════════
# 1. POST /api/ai/parse-intel — 情报结构化
# ═══════════════════════════════════════════

@router.post("/parse-intel", response_model=AIResponse)
def parse_intel(
    body: AIParseRequest,
    user: User = Depends(require_role(UserRole.SALES)),
):
    """
    文本 → 4+1 情报结构化。
    场景: FAST_EXTRACT
    🛡️ 强制脱敏
    """
    sanitized = mask_sensitive_info(body.text)
    gw = _build_gateway(body.llm_configs)

    system_prompt = (
        "你是一名资深工业电气销售专家。请对销售拜访口述记录进行结构化情报提取。"
        "严格返回 JSON 格式（4+1 情报模型）：\n"
        '{"current_status": "...", "decision_chain": [...], '
        '"competitor_info": [...], "next_steps": "...", "gap_alerts": [...]}\n'
        "严禁输出 Markdown 标记，只返回合法 JSON。"
    )
    try:
        result = gw.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": sanitized},
            ],
            task=AITask.FAST_EXTRACT,
        )
        model_used = gw.audit_log[-1].model if gw.audit_log else None
        return AIResponse(result=result, model_used=model_used)
    except Exception as e:
        return AIResponse(error=str(e)[:300])


# ═══════════════════════════════════════════
# 2. POST /api/ai/generate-nba — NBA 报告
# ═══════════════════════════════════════════

@router.post("/generate-nba", response_model=AIResponse)
def generate_nba(
    body: AIGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    基于项目情报生成 NBA (Next Best Action) 报告。
    场景: HEAVY_STRATEGY
    🛡️ 强制脱敏
    """
    context = _get_project_context(body.project_id, db)
    sanitized_context = mask_sensitive_info(context)
    extra = mask_sensitive_info(body.context or "")

    gw = _build_gateway(body.llm_configs)
    prompt = (
        "你是一名狠辣的工业销售军师。基于以下项目情报，生成一份 NBA 报告：\n"
        "1. 当前局势判断（一句话）\n"
        "2. 最紧迫的 3 个行动项（含责任人和时间节点）\n"
        "3. 风险预警\n"
        "4. 胜率评估及依据\n\n"
        f"【项目情报】\n{sanitized_context}\n\n"
        f"【附加上下文】\n{extra}"
    )
    try:
        result = gw.chat(
            messages=[{"role": "user", "content": prompt}],
            task=AITask.HEAVY_STRATEGY,
        )
        model_used = gw.audit_log[-1].model if gw.audit_log else None
        return AIResponse(result=result, model_used=model_used)
    except Exception as e:
        return AIResponse(error=str(e)[:300])


# ═══════════════════════════════════════════
# 3. POST /api/ai/generate-pitch — 话术生成
# ═══════════════════════════════════════════

@router.post("/generate-pitch", response_model=AIResponse)
def generate_pitch(
    body: AIGenerateRequest,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    生成销售话术（微信/邮件/内部策略/技术方案）。
    场景: HEAVY_STRATEGY
    🛡️ 强制脱敏
    """
    context = _get_project_context(body.project_id, db)
    sanitized_context = mask_sensitive_info(context)
    extra = mask_sensitive_info(body.context or "请生成一段跟进微信话术")

    gw = _build_gateway(body.llm_configs)
    prompt = (
        "你是一名极其专业的工业大客户销售总监。\n"
        f"请根据以下项目情报，{extra}。\n"
        f"要求专业诚恳、不卑不亢，体现行业洞察力。\n\n"
        f"【项目情报】\n{sanitized_context}"
    )
    try:
        result = gw.chat(
            messages=[{"role": "user", "content": prompt}],
            task=AITask.HEAVY_STRATEGY,
        )
        model_used = gw.audit_log[-1].model if gw.audit_log else None
        return AIResponse(result=result, model_used=model_used)
    except Exception as e:
        return AIResponse(error=str(e)[:300])


# ═══════════════════════════════════════════
# 4. POST /api/ai/generate-quiz — 伴学出题
# ═══════════════════════════════════════════

@router.post("/generate-quiz", response_model=AIResponse)
def generate_quiz(
    body: AIGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    基于项目情报生成实战测验题。
    场景: QUIZ_CRITIQUE
    🛡️ 强制脱敏
    """
    context = _get_project_context(body.project_id, db)
    sanitized_context = mask_sensitive_info(context)

    gw = _build_gateway(body.llm_configs)
    prompt = (
        "你是一名严苛的工业销售教官。基于以下项目情报，"
        "生成一道三维实战情景模拟题：\n"
        "1. 设定场景（具体到人物/地点/对话）\n"
        "2. 提出挑战（客户的刁难/竞品的突袭/内部的政治博弈）\n"
        "3. 要求受训者在 3 分钟内给出应对策略\n\n"
        f"【项目情报】\n{sanitized_context}"
    )
    try:
        result = gw.chat(
            messages=[{"role": "user", "content": prompt}],
            task=AITask.QUIZ_CRITIQUE,
        )
        model_used = gw.audit_log[-1].model if gw.audit_log else None
        return AIResponse(result=result, model_used=model_used)
    except Exception as e:
        return AIResponse(error=str(e)[:300])


# ═══════════════════════════════════════════
# 5. POST /api/ai/critique — 回答评估
# ═══════════════════════════════════════════

@router.post("/critique", response_model=AIResponse)
def critique_answer(
    body: AICritiqueRequest,
    user: User = Depends(get_current_user),
):
    """
    评估销售回答（评分/点评/盲点）。
    场景: QUIZ_CRITIQUE
    🛡️ 强制脱敏
    """
    sanitized_q = mask_sensitive_info(body.question)
    sanitized_a = mask_sensitive_info(body.answer)

    gw = _build_gateway(body.llm_configs)
    prompt = (
        "你是一名极其严苛的工业销售总监。请评估以下回答。\n"
        "返回 JSON: {\"score\": 0-100, \"critique\": \"...\", "
        "\"blind_spots\": [\"...\"]}\n"
        "严禁输出 Markdown，只返回 JSON。\n\n"
        f"【题目】\n{sanitized_q}\n\n"
        f"【回答】\n{sanitized_a}"
    )
    try:
        result = gw.chat(
            messages=[{"role": "user", "content": prompt}],
            task=AITask.QUIZ_CRITIQUE,
        )
        model_used = gw.audit_log[-1].model if gw.audit_log else None
        return AIResponse(result=result, model_used=model_used)
    except Exception as e:
        return AIResponse(error=str(e)[:300])


# ═══════════════════════════════════════════
# 6. POST /api/ai/extract-stakeholders — 关键人提取
# ═══════════════════════════════════════════

@router.post("/extract-stakeholders", response_model=AIResponse)
def extract_stakeholders(
    body: AIGenerateRequest,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    从情报中批量提取关键人。
    场景: FAST_EXTRACT
    🛡️ 强制脱敏
    """
    context = _get_project_context(body.project_id, db)
    sanitized_context = mask_sensitive_info(context)

    gw = _build_gateway(body.llm_configs)
    prompt = (
        "你是一名专业的大客户销售顾问。请从以下项目情报中提取关键人物信息。\n"
        "返回 JSON 数组: [{\"name\": \"...\", \"title\": \"...\", "
        "\"attitude\": \"support/neutral/oppose\", \"influence\": 1-10, "
        "\"reports_to\": \"...\", \"tags\": [\"...\"]}, ...]\n"
        "严禁输出 Markdown，只返回 JSON 数组。\n\n"
        f"【项目情报】\n{sanitized_context}"
    )
    try:
        result = gw.chat(
            messages=[{"role": "user", "content": prompt}],
            task=AITask.FAST_EXTRACT,
        )
        model_used = gw.audit_log[-1].model if gw.audit_log else None
        return AIResponse(result=result, model_used=model_used)
    except Exception as e:
        return AIResponse(error=str(e)[:300])


# ═══════════════════════════════════════════
# 7. POST /api/ai/power-map — 权力关系图谱
# ═══════════════════════════════════════════

@router.post("/power-map", response_model=AIResponse)
def generate_power_map(
    body: AIGenerateRequest,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    生成 Mermaid 权力关系图谱 + 攻略策略。
    场景: CODE_GEN (需要强逻辑推理生成 Mermaid)
    🛡️ 强制脱敏
    """
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(404, f"项目 #{body.project_id} 不存在")

    stakeholders = (
        db.query(Stakeholder)
        .filter(Stakeholder.project_id == body.project_id)
        .all()
    )
    if not stakeholders:
        return AIResponse(result="暂无关键人数据，请先添加或 AI 提取。")

    sh_csv = "\n".join(
        f"{s.name},{s.title},{s.attitude.value},{s.influence_weight},{s.reports_to or 'N/A'}"
        for s in stakeholders
    )
    sanitized_csv = mask_sensitive_info(sh_csv)

    gw = _build_gateway(body.llm_configs)
    prompt = (
        "你是一名大客户销售的权力关系分析专家。\n"
        "基于以下关键人数据，生成：\n"
        "1. Mermaid flowchart （展示人物之间的汇报和影响关系）\n"
        "2. 攻略策略（谁是突破口、谁需要绕开、谁需要重点攻关）\n\n"
        f"【关键人数据 (姓名,职位,态度,影响力,汇报给)】\n{sanitized_csv}"
    )
    try:
        result = gw.chat(
            messages=[{"role": "user", "content": prompt}],
            task=AITask.CODE_GEN,
        )
        model_used = gw.audit_log[-1].model if gw.audit_log else None
        return AIResponse(result=result, model_used=model_used)
    except Exception as e:
        return AIResponse(error=str(e)[:300])
