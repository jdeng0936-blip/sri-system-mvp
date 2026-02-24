"""
路由：情报日志 (多模态) — routers/intel.py
============================================
原文保留原则：raw_input 存未脱敏原文（内网可见），
发给 LLM 的版本一律经过 mask_sensitive_info 脱敏。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import IntelLog, Project, User, UserRole
from schemas import IntelLogCreate, IntelLogOut
from services.llm_service import AITask, build_ai_gateway
from utils.dependencies import get_current_user, get_db, require_role
from utils.security import mask_sensitive_info

router = APIRouter(tags=["Intel 情报日志"])

# ── 4+1 情报解析 System Prompt ──
INTEL_SYSTEM_PROMPT = (
    "你是一名资深工业电气销售专家。请对销售拜访口述记录进行结构化情报提取，"
    "严格返回以下 JSON 格式（4+1 情报模型）：\n"
    '{\n'
    '  "current_status": "项目现状、预算与进度信息",\n'
    '  "decision_chain": [\n'
    '    {"name": "姓名", "title": "职务", "phone": "联系方式(若无则返回null)", '
    '"attitude": "支持/中立/反对", "soft_tags": ["标签1", "标签2"]}\n'
    '  ],\n'
    '  "competitor_info": [\n'
    '    {"name": "竞品名称", "quote": "报价(若无则返回null)", '
    '"strengths": "优势", "weaknesses": "劣势", "recent_actions": "近期动作"}\n'
    '  ],\n'
    '  "next_steps": "下一步行动计划或销售承诺",\n'
    '  "gap_alerts": ["缺口预警1", "缺口预警2"]\n'
    '}\n\n'
    "作为严苛的销售总监，请审查拜访记录并在 gap_alerts 中指出缺失的致命情报。规则：\n"
    "1. 提到人物但未提供电话或联系方式 → '⚠️ 未获取 [姓名] 的联系方式'。\n"
    "2. 未提到下一步推进时间 → '⚠️ 缺少明确的下一步推进时间点'。\n"
    "3. 未确认项目预算 → '⚠️ 未确认最终预算'。\n"
    "4. 未识别关键决策人 → '⚠️ 未识别关键决策人'。\n"
    "如果情报完美，gap_alerts 返回空数组 []。\n\n"
    "严禁输出任何 Markdown 标记或多余的解释说明，只返回合法的 JSON 字符串。"
)


# ═══════════════════════════════════════════
# GET /api/projects/{pid}/intel — 项目情报列表
# ═══════════════════════════════════════════

@router.get("/api/projects/{project_id}/intel", response_model=list[IntelLogOut])
def list_intel(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(IntelLog)
        .filter(IntelLog.project_id == project_id)
        .order_by(IntelLog.created_at.desc())
        .all()
    )


# ═══════════════════════════════════════════
# POST /api/intel/daily-log — 文字情报入库
# ═══════════════════════════════════════════

@router.post("/api/intel/daily-log", response_model=IntelLogOut, status_code=201)
def create_daily_log(
    body: IntelLogCreate,
    user: User = Depends(require_role(UserRole.SALES)),
    db: Session = Depends(get_db),
):
    """
    文字情报 → AI 结构化解析 (4+1 模型) → 入库。
    🛡️ 原文保留 + 脱敏发送。
    """
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(404, f"项目 #{body.project_id} 不存在")

    # ═══ 隐私红线：脱敏后才能发给 LLM ═══
    sanitized_text = mask_sensitive_info(body.text)

    # 调用 AI 网关 (场景: FAST_EXTRACT)
    ai_parsed = ""
    model_used = ""
    try:
        gateway = build_ai_gateway(primary_api_key="")  # 由前端 llm_configs 驱动
        ai_parsed = gateway.chat(
            messages=[
                {"role": "system", "content": INTEL_SYSTEM_PROMPT},
                {"role": "user", "content": sanitized_text},
            ],
            task=AITask.FAST_EXTRACT,
        )
        # 从审计日志获取实际使用的模型
        if gateway.audit_log:
            last = gateway.audit_log[-1]
            model_used = f"{last.provider}/{last.model}"
    except Exception as e:
        ai_parsed = f'{{"error": "{str(e)[:200]}"}}'

    # 入库：原文不脱敏（内网可见），AI 解析结果存储
    log = IntelLog(
        project_id=body.project_id,
        author_id=user.id,
        raw_input=body.text,          # ← 未脱敏原文
        input_type="text",
        ai_parsed_json=ai_parsed,
        ai_model_used=model_used,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
