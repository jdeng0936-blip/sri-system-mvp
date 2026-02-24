"""
SRI 全局态势感知 — FastAPI 后端
从 sri_intel.db 读取真实业务数据，为 React leader-dashboard 提供 JSON API。

启动方式:
    uvicorn api:app --reload --port 8000
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Any

from fastapi import FastAPI, UploadFile, Form, File as FastAPIFile, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware


# ── FastAPI App ──

app = FastAPI(
    title="SRI 情报系统 API",
    description="为 leader-dashboard React 大屏提供实时业务数据",
    version="1.0.0",
)

# CORS: 允许 React dev server 跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Database Helper ──

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sri_intel.db")


@contextmanager
def get_db():
    """获取数据库连接（with 语句自动关闭）"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ── 阶段映射：将自由文本的 current_stage 归集到 4 大漏斗桶 ──

STAGE_BUCKETS = {
    "线索获取": ["线索", "初期接触", "线索获取"],
    "方案报价": ["方案报价", "技术僵持"],
    "商务谈判": ["商务谈判", "逼单/签约", "逼单"],
    "合同签约": ["合同签约", "签约", "立项", "已签约"],
}

STAGE_ORDER = ["线索获取", "方案报价", "商务谈判", "合同签约"]
STAGE_EMOJI = {
    "线索获取": "📡",
    "方案报价": "📋",
    "商务谈判": "🤝",
    "合同签约": "✅",
}


def classify_stage(raw_stage: str) -> str:
    """将数据库中的自由文本阶段归集到标准桶"""
    if not raw_stage:
        return "线索获取"
    for bucket, keywords in STAGE_BUCKETS.items():
        for kw in keywords:
            if kw in raw_stage:
                return bucket
    return "线索获取"  # fallback


# ── API Endpoints ──


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/kpi")
def get_kpi() -> list[dict[str, Any]]:
    """
    返回顶部 4 张 KPI 卡片数据。
    从真实 DB 聚合:
      1. 在跟项目总数
      2. 关键人覆盖率
      3. 本月情报录入量
      4. 高风险项目（停滞在线索阶段的占比）
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. 项目总数
        cursor.execute("SELECT COUNT(*) FROM projects")
        total_projects = cursor.fetchone()[0]

        # 2. 有关键人覆盖的项目数
        cursor.execute(
            "SELECT COUNT(DISTINCT project_id) FROM stakeholders"
        )
        projects_with_stakeholders = cursor.fetchone()[0]
        coverage_rate = (
            round(projects_with_stakeholders / total_projects * 100, 1)
            if total_projects > 0
            else 0
        )

        # 3. 情报录入量（visit_logs 总条数）
        cursor.execute("SELECT COUNT(*) FROM visit_logs")
        total_logs = cursor.fetchone()[0]

        # 4. 高风险：停留在"线索"阶段的项目数
        cursor.execute("SELECT current_stage FROM projects")
        stages = [row[0] for row in cursor.fetchall()]
        risk_count = sum(
            1 for s in stages if classify_stage(s or "") == "线索获取"
        )

    return [
        {
            "id": "projects",
            "emoji": "💰",
            "title": "在跟项目总数",
            "value": f"{total_projects} 个",
            "trend": "+3 本月新增",
            "trendUp": True,
            "accentColor": "border-l-blue-500",
            "description": "当前系统中所有活跃项目数量",
        },
        {
            "id": "coverage",
            "emoji": "🎯",
            "title": "关键人覆盖率",
            "value": f"{coverage_rate}%",
            "trend": f"{projects_with_stakeholders}/{total_projects} 项目",
            "trendUp": coverage_rate >= 50,
            "accentColor": "border-l-emerald-500",
            "description": "已建立关键人档案的项目占比",
        },
        {
            "id": "intel",
            "emoji": "📡",
            "title": "累计情报录入",
            "value": f"{total_logs} 条",
            "trend": "持续更新中",
            "trendUp": True,
            "accentColor": "border-l-amber-500",
            "description": "所有拜访日志和情报上报总条数",
        },
        {
            "id": "risk",
            "emoji": "🚨",
            "title": "高风险停滞项目",
            "value": f"{risk_count} 个",
            "trend": f"占比 {round(risk_count / total_projects * 100)}%"
            if total_projects > 0
            else "—",
            "trendUp": False,
            "accentColor": "border-l-red-500",
            "description": "仍停留在线索阶段的项目，需重点推进",
        },
    ]


@app.get("/api/pipeline")
def get_pipeline() -> list[dict[str, Any]]:
    """
    返回战区漏斗数据。
    将 projects.current_stage 归集到 4 大标准桶，
    返回各桶的项目数和归一化百分比。
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT current_stage FROM projects")
        stages = [row[0] or "" for row in cursor.fetchall()]

    # 统计各桶
    bucket_counts: dict[str, int] = {s: 0 for s in STAGE_ORDER}
    for raw in stages:
        bucket = classify_stage(raw)
        bucket_counts[bucket] += 1

    total = len(stages) or 1
    max_count = max(bucket_counts.values()) or 1

    result = []
    for stage_name in STAGE_ORDER:
        count = bucket_counts[stage_name]
        result.append(
            {
                "label": stage_name,
                "emoji": STAGE_EMOJI[stage_name],
                "count": count,
                "amount": f"{count} 个项目",
                "widthPercent": round(count / max_count * 100),
            }
        )

    return result


@app.get("/api/feed")
def get_feed() -> list[dict[str, Any]]:
    """
    返回最新 10 条情报战报流。
    从 visit_logs JOIN projects 中聚合。
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                v.log_id,
                v.project_id,
                p.project_name,
                COALESCE(p.applicant, '前线销售'),
                COALESCE(p.dept, ''),
                v.raw_input,
                v.ai_parsed_data,
                v.created_at
            FROM visit_logs v
            LEFT JOIN projects p ON v.project_id = p.project_id
            ORDER BY v.log_id DESC
            LIMIT 10
            """
        )
        rows = cursor.fetchall()

    feed_items = []
    role_map = {
        "": ("一线销售", "🛡️", "info"),
        "华南战区": ("一线销售", "🛡️", "info"),
        "华东战区": ("一线销售", "🛡️", "info"),
        "华北战区": ("一线销售", "🛡️", "info"),
    }

    for i, row in enumerate(rows):
        log_id = row[0]
        project_name = row[2] or "未知项目"
        author = row[3] or "前线销售"
        dept = row[4] or ""
        raw_input = row[5] or ""
        ai_parsed = row[6] or ""
        created_at = row[7]

        # 从 raw_input 提取简要 action 描述
        action = _extract_action(raw_input, ai_parsed)

        # 格式化时间
        timestamp = _format_timestamp(created_at)

        # 根据内容判断类型
        feed_type = _classify_feed_type(raw_input, ai_parsed)

        # 角色信息
        role_info = role_map.get(dept, ("一线销售", "🛡️", "info"))
        author_initial = author[0] if author else "?"

        feed_items.append(
            {
                "id": f"f{log_id}",
                "author": author,
                "authorInitial": author_initial,
                "role": role_info[0],
                "roleEmoji": role_info[1],
                "roleBadgeColor": role_info[2],
                "action": action,
                "project": project_name,
                "timestamp": timestamp,
                "type": feed_type,
            }
        )

    return feed_items


# ── Helper Functions ──


def _extract_action(raw_input: str, ai_parsed: str) -> str:
    """从日志内容中提取简要行动描述"""
    if not raw_input:
        return "提交了一条情报"

    # 如果包含特殊标记
    if "[立项背景基座更新]" in raw_input:
        return "更新了项目立项基座信息"

    # AI 解析数据中提取摘要
    if ai_parsed:
        try:
            parsed = json.loads(ai_parsed)
            summary = parsed.get("tl_dr") or parsed.get("summary") or ""
            if summary:
                return summary[:50] + ("..." if len(summary) > 50 else "")
        except (json.JSONDecodeError, TypeError):
            pass

    # 截取 raw_input 前 40 字符
    clean = raw_input.strip().strip('"').strip("'")
    if len(clean) > 40:
        return f"上报情报：{clean[:40]}..."
    return f"上报情报：{clean}" if clean else "提交了一条情报"


def _format_timestamp(created_at: str | None) -> str:
    """将时间戳格式化为相对时间"""
    if not created_at:
        return "较早前"
    try:
        dt = datetime.fromisoformat(created_at)
        delta = datetime.now() - dt
        if delta.days > 30:
            return f"{delta.days // 30} 个月前"
        if delta.days > 0:
            return f"{delta.days} 天前"
        hours = delta.seconds // 3600
        if hours > 0:
            return f"{hours} 小时前"
        minutes = delta.seconds // 60
        return f"{minutes} 分钟前" if minutes > 0 else "刚刚"
    except (ValueError, TypeError):
        return "较早前"


def _classify_feed_type(raw_input: str, ai_parsed: str) -> str:
    """根据内容判断战报类型"""
    combined = (raw_input or "") + (ai_parsed or "")
    if any(kw in combined for kw in ["签约", "签单", "中标", "成功"]):
        return "success"
    if any(kw in combined for kw in ["风险", "预警", "撞单", "拦截", "驳回"]):
        return "destructive"
    if any(kw in combined for kw in ["审批", "仲裁", "待", "等待"]):
        return "warning"
    return "info"


# ── CRM 项目列表 ──

STAGE_BADGE_VARIANT = {
    "线索获取": "info",
    "方案报价": "warning",
    "商务谈判": "secondary",
    "合同签约": "success",
}


@app.get("/api/crm/projects")
def get_crm_projects() -> list[dict[str, Any]]:
    """
    返回全量项目详情（CRM 表格用）。
    聚合：项目基本信息 + 关键人数量 + 最新跟进摘要。
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                p.project_id,
                p.project_name,
                COALESCE(p.current_stage, '') AS current_stage,
                COALESCE(p.client, '') AS client,
                COALESCE(p.applicant, '') AS applicant,
                COALESCE(p.dept, '') AS dept,
                (SELECT COUNT(*) FROM stakeholders s
                 WHERE s.project_id = p.project_id) AS stakeholder_count,
                (SELECT SUBSTR(COALESCE(v.raw_input, ''), 1, 60)
                 FROM visit_logs v
                 WHERE v.project_id = p.project_id
                 ORDER BY v.log_id DESC LIMIT 1) AS latest_log,
                (SELECT v.created_at
                 FROM visit_logs v
                 WHERE v.project_id = p.project_id
                 ORDER BY v.log_id DESC LIMIT 1) AS latest_log_time
            FROM projects p
            ORDER BY p.project_id DESC
            """
        )
        rows = cursor.fetchall()

    result = []
    for row in rows:
        raw_stage = row[2]
        bucket = classify_stage(raw_stage)
        latest_log_raw = (row[7] or "").strip().strip('"').strip("'")

        result.append(
            {
                "id": row[0],
                "name": row[1] or f"项目_{row[0]}",
                "stage": bucket,
                "rawStage": raw_stage,
                "client": row[3] or "—",
                "applicant": row[4] or "—",
                "dept": row[5] or "—",
                "stakeholderCount": row[6],
                "latestLog": latest_log_raw[:60] if latest_log_raw else "暂无跟进记录",
                "latestLogTime": _format_timestamp(row[8]),
                "stageColor": STAGE_BADGE_VARIANT.get(bucket, "info"),
            }
        )

    return result


# ── 入口 ──


@app.get("/api/projects")
def get_projects_list() -> list[dict[str, Any]]:
    """返回项目列表（供前端下拉框使用），包含客户/设计院/提报人/战区"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT project_id, project_name, "
            "COALESCE(current_stage, '') as stage, "
            "COALESCE(client, '') as client, "
            "COALESCE(design_institute, '') as design_institute, "
            "COALESCE(applicant, '') as applicant, "
            "COALESCE(dept, '') as dept "
            "FROM projects ORDER BY project_id"
        )
        rows = cursor.fetchall()

    return [
        {
            "id": row[0],
            "name": row[1] or f"项目_{row[0]}",
            "stage": row[2],
            "client": row[3],
            "design_institute": row[4],
            "applicant": row[5],
            "dept": row[6],
        }
        for row in rows
    ]

# ── 新建项目审批流 (复刻 app.py L540-668) ──

# 内存级审核池 & 申诉池
_pending_projects: list[dict] = []
_appeals: list[dict] = []
_next_pending_id = 1


@app.post("/api/projects/create")
async def create_project(request: Request):
    """新建项目，含查重（保留兼容）。"""
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        return JSONResponse(content={"error": "项目名称不能为空"}, status_code=400)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT project_id FROM projects WHERE project_name = ?", (name,))
        existing = cursor.fetchone()
    if existing:
        return JSONResponse(
            content={"error": f"项目【{name}】已存在 (ID: {existing[0]})，请换一个名称。"},
            status_code=409,
        )

    from database import add_project
    new_id = add_project(
        project_name=name,
        current_stage=body.get("stage", "线索"),
        client=body.get("client", ""),
        design_institute=body.get("design_institute", ""),
        general_contractor=body.get("general_contractor", ""),
        applicant=body.get("applicant", ""),
        dept=body.get("dept", ""),
    )
    return {"success": True, "project_id": new_id, "message": f"项目【{name}】创建成功！"}


@app.post("/api/projects/submit")
async def submit_project(request: Request):
    """
    提交立项申请 (不直接入库)。
    执行 AI 模糊撞单检查：客户名互相包含即视为高危撞单。
    """
    global _next_pending_id
    body = await request.json()
    client = body.get("client", "").strip()
    name = body.get("name", "").strip()
    if not name or not client:
        return JSONResponse(content={"error": "客户名和项目名不能为空"}, status_code=400)

    # ── 1. 精确查重：同名项目 ──
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT project_id FROM projects WHERE project_name = ?", (name,))
        exact = cursor.fetchone()
    if exact:
        return JSONResponse(
            content={"error": f"项目【{name}】已存在 (ID: {exact[0]})。"},
            status_code=409,
        )

    # ── 2. AI 模糊撞单引擎：客户名互相包含 ──
    conflict_found = None
    conflict_type = ""
    conflict_owner = "未知销售"

    # 2a. 正式项目库
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT project_name, COALESCE(client, '') as client, "
            "COALESCE(applicant, '历史归属人') as applicant FROM projects"
        )
        for row in cursor.fetchall():
            existing_client = row[1]
            if existing_client and (client in existing_client or existing_client in client):
                conflict_found = row[0]
                conflict_type = "正式项目库"
                conflict_owner = row[2]
                break

    # 2b. 审核池排队中
    if not conflict_found:
        for p in _pending_projects:
            existing_client = p.get("client", "")
            if existing_client and (client in existing_client or existing_client in client):
                conflict_found = p.get("project_name", "")
                conflict_type = "审核池排队中"
                conflict_owner = p.get("applicant", "其他销售")
                break

    # ── 3. 拦截分流 ──
    if conflict_found:
        return {
            "success": False,
            "conflict": True,
            "conflictProject": conflict_found,
            "conflictType": conflict_type,
            "conflictOwner": conflict_owner,
        }

    # ── 4. 绿灯放行 → 推入审核池 ──
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pending_item = {
        "id": _next_pending_id,
        "client": client,
        "project_name": name,
        "design_institute": body.get("design_institute", ""),
        "general_contractor": body.get("general_contractor", ""),
        "applicant": body.get("applicant", "未知"),
        "dept": body.get("dept", "未知战区"),
        "stage": body.get("stage", "线索"),
        "time": timestamp,
    }
    _pending_projects.append(pending_item)
    _next_pending_id += 1

    return {
        "success": True,
        "pending": True,
        "message": f"提报成功！项目【{name}】已推送至总监审核池。",
    }


@app.post("/api/projects/appeal")
async def appeal_project(request: Request):
    """提交撞单归属权复核申诉。"""
    body = await request.json()
    reason = body.get("reason", "").strip()
    if not reason:
        return JSONResponse(content={"error": "请必须填写申诉依据！"}, status_code=400)

    _appeals.append({
        "id": len(_appeals) + 1,
        "new_project": body.get("new_project", ""),
        "conflict_with": body.get("conflict_with", ""),
        "original_owner": body.get("original_owner", ""),
        "applicant": body.get("applicant", "未知"),
        "reason": reason,
        "has_evidence": body.get("has_evidence", False),
        "status": "⚖️ 待裁决",
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })
    return {
        "success": True,
        "message": "申诉已提交至 VP！原归属人将被通知。请等待法庭裁决。",
    }


@app.get("/api/projects/pending")
def get_pending_projects():
    """获取待审核项目列表。"""
    return {"pending": _pending_projects, "appeals": _appeals}


@app.post("/api/projects/approve")
async def approve_project(request: Request):
    """审核通过：从审核池移除并写入正式数据库。"""
    body = await request.json()
    pending_id = body.get("id")

    target = None
    for p in _pending_projects:
        if p["id"] == pending_id:
            target = p
            break
    if not target:
        return JSONResponse(content={"error": "未找到该待审项目"}, status_code=404)

    # 写入数据库
    from database import add_project
    new_id = add_project(
        project_name=target["project_name"],
        current_stage=target.get("stage", "线索"),
        client=target.get("client", ""),
        design_institute=target.get("design_institute", ""),
        general_contractor=target.get("general_contractor", ""),
        applicant=target.get("applicant", ""),
        dept=target.get("dept", ""),
    )

    _pending_projects.remove(target)
    return {
        "success": True,
        "project_id": new_id,
        "message": f"审核通过！项目【{target['project_name']}】已写入数据库。",
    }


@app.post("/api/projects/reject")
async def reject_project(request: Request):
    """驳回：从审核池移除。"""
    body = await request.json()
    pending_id = body.get("id")

    target = None
    for p in _pending_projects:
        if p["id"] == pending_id:
            target = p
            break
    if not target:
        return JSONResponse(content={"error": "未找到该待审项目"}, status_code=404)

    _pending_projects.remove(target)
    return {"success": True, "message": f"已驳回项目【{target['project_name']}】。"}


# ── 日常推进动态 & 图片情报 ──


@app.post("/api/intel/daily_log")
async def daily_log(request: Request):
    """
    接收日常推进文本，调用 AI 解析为 4+1 结构化情报并存入数据库。
    """
    body = await request.json()
    project_id = body.get("project_id")
    raw_text = body.get("text", "").strip()
    llm_configs = body.get("llm_configs", None)
    api_key = request.headers.get("X-API-Key", "").strip()
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY", "")
    # 如果 llm_configs 中有任何有效 key，也可以不要求顶层 apiKey
    has_any_key = bool(api_key)
    if llm_configs:
        for p in ["openai", "gemini", "anthropic", "xai"]:
            if llm_configs.get(p, {}).get("enabled") and llm_configs.get(p, {}).get("apiKey"):
                has_any_key = True
                break

    if not project_id:
        return JSONResponse(content={"error": "缺少 project_id"}, status_code=400)
    if not raw_text:
        return JSONResponse(content={"error": "请输入推进内容"}, status_code=400)
    if not has_any_key:
        return JSONResponse(content={"error": "请先在右上角 ⚙️ 系统设置中输入有效的 API Key"}, status_code=401)

    try:
        from llm_service import build_llm_router
        router = build_llm_router(primary_api_key=api_key, llm_configs=llm_configs)
        from llm_service import SYSTEM_PROMPT
        parsed_json_str = router.chat(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": raw_text[:4000]},
            ],
            temperature=0.2,
        )
    except Exception as e:
        return {"success": False, "error": f"AI 解析失败: {str(e)}"}

    # 存入数据库
    try:
        from database import save_intelligence
        save_intelligence(project_id, raw_text[:2000], parsed_json_str)
    except Exception as e:
        print(f"⚠️ 数据库存储失败: {e}")

    # 解析返回
    try:
        intelligence = json.loads(parsed_json_str)
    except (json.JSONDecodeError, TypeError):
        intelligence = {"raw_response": parsed_json_str}

    return {"success": True, "intelligence": intelligence, "message": "✅ 日常推进情报已入库！"}


@app.post("/api/intel/upload_image")
async def upload_image(
    request: Request,
    file: UploadFile = FastAPIFile(...),
    project_id: int = Form(1),
):
    """
    接收现场照片 (JPG/PNG)，调用 GPT-4o-mini 多模态视觉解析，
    提取品牌、型号、关键参数，并给出销售建议。
    """
    import base64 as _b64

    api_key = request.headers.get("X-API-Key", "").strip()
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return {"success": False, "error": "请先配置 API Key"}

    filename = file.filename or "unknown"
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix not in ("jpg", "jpeg", "png"):
        return {"success": False, "error": f"不支持的图片类型: .{suffix}。仅支持 JPG/PNG"}

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        return {"success": False, "error": "文件内容为空"}

    try:
        b64_img = _b64.b64encode(file_bytes).decode("utf-8")
        vision_prompt = "请提取这张业务照片中的品牌、型号、关键参数，并给出销售建议。"

        if api_key.startswith("sk-ant-"):
            # Anthropic Claude 视觉 API
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2000,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": f"image/{suffix}", "data": b64_img}},
                        {"type": "text", "text": vision_prompt},
                    ],
                }],
            )
            parsed_intel = response.content[0].text
        else:
            # OpenAI GPT-4o 视觉 API
            from openai import OpenAI as _OpenAI_img
            client = _OpenAI_img(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": vision_prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/{suffix};base64,{b64_img}"}},
                    ],
                }],
            )
            parsed_intel = response.choices[0].message.content or ""
    except Exception as e:
        return {"success": False, "error": f"图片解析失败: {str(e)}"}

    # 存入数据库
    full_text = f"【🚨 深度文档/视觉情报提取】\n{parsed_intel}"
    try:
        from database import save_intelligence
        save_intelligence(project_id, f"[图片情报] {filename}", full_text)
    except Exception as e:
        print(f"⚠️ 数据库存储失败: {e}")

    return {
        "success": True,
        "filename": filename,
        "parsed_intel": parsed_intel,
        "message": "✅ 现场图片情报已解析并入库！",
    }


@app.post("/api/intel/upload_media")
async def upload_media(
    request: Request,
    file: UploadFile = FastAPIFile(...),
    project_id: int = Form(1),
):
    """
    接收音频/视频文件 (MP3/WAV/M4A/MP4/MOV)，
    使用 Whisper 转文字，再调用 AI 解析为结构化情报。
    """
    api_key = request.headers.get("X-API-Key", "").strip()
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return {"success": False, "error": "请先配置 API Key"}

    filename = file.filename or "unknown"
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed = ("mp3", "wav", "m4a", "mp4", "mov", "webm", "ogg", "flac")
    if suffix not in allowed:
        return {"success": False, "error": f"不支持的媒体类型: .{suffix}。支持 {', '.join(allowed)}"}

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        return {"success": False, "error": "文件内容为空"}

    # Step 1: Whisper 转录（需要 OpenAI Key）
    import tempfile
    whisper_key = api_key
    if api_key.startswith("sk-ant-"):
        # Anthropic Key 不能用 Whisper，尝试从环境变量获取 OpenAI Key
        whisper_key = os.environ.get("OPENAI_API_KEY", "")
        if not whisper_key or whisper_key.startswith("sk-ant-"):
            return {"success": False, "error": "音频转录需要 OpenAI API Key（Whisper 服务）。请设置环境变量 OPENAI_API_KEY，或使用 OpenAI 密钥。"}
    try:
        from openai import OpenAI as _OpenAI_media
        client = _OpenAI_media(api_key=whisper_key)

        # 写入临时文件（Whisper API 需要文件对象）
        with tempfile.NamedTemporaryFile(suffix=f".{suffix}", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="zh",
            )
        transcribed_text = transcript.text
        os.unlink(tmp_path)
    except Exception as e:
        return {"success": False, "error": f"音频转录失败: {str(e)}"}

    if not transcribed_text.strip():
        return {"success": False, "error": "转录结果为空，未识别到有效语音内容"}

    # Step 2: AI 解析转录文本
    try:
        from llm_service import parse_visit_log
        parsed_json_str = parse_visit_log(api_key, transcribed_text[:4000])
    except Exception as e:
        parsed_json_str = f"转录成功但 AI 解析失败: {str(e)}"

    # Step 3: 存入数据库
    try:
        from database import save_intelligence
        save_intelligence(project_id, transcribed_text[:2000], parsed_json_str)
    except Exception as e:
        print(f"⚠️ 数据库存储失败: {e}")

    # 解析返回
    try:
        intelligence = json.loads(parsed_json_str)
    except (json.JSONDecodeError, TypeError):
        intelligence = {"raw_response": parsed_json_str}

    return {
        "success": True,
        "filename": filename,
        "transcribed_text": transcribed_text,
        "intelligence": intelligence,
        "message": f"✅ 音频/视频转录完成（{len(transcribed_text)}字），情报已入库！",
    }

# ── 战役立项基座 (原版 app.py L745-800) ──


@app.post("/api/intel/save_baseline")
async def save_baseline(request: Request):
    """
    保存项目战役立项基座(硬性背景指标)，作为高权重情报注入数据库。
    """
    from database import save_intelligence
    body = await request.json()
    project_id = body.get("project_id")
    info_source = body.get("info_source", "")
    project_driver = body.get("project_driver", "")
    position = body.get("position", "")
    budget_status = body.get("budget_status", "")

    if not project_id:
        return JSONResponse(content={"error": "缺少 project_id"}, status_code=400)

    baseline_intel = (
        f"【🚨 系统标记：核心立项背景基座】\n"
        f"- 信息来源：{info_source}\n"
        f"- 核心驱动力：{project_driver}\n"
        f"- 我方当前身位：{position}\n"
        f"- 预算状态：{budget_status}\n"
        f"（AI参谋请注意：此为项目底层硬性约束，"
        f"后续所有策略分析必须基于此背景！）"
    )

    try:
        save_intelligence(project_id, "[立项背景基座更新]", baseline_intel)
        position_tag = position.split(" ")[0] if position else "未知"
        return {"success": True, "message": f"战役基座已锁定！AI 已感知我方当前处于【{position_tag}】状态。"}
    except Exception as e:
        return JSONResponse(content={"error": f"保存失败: {str(e)}"}, status_code=500)


@app.post("/api/upload_and_analyze")
async def upload_and_analyze(
    request: Request,
    file: UploadFile = FastAPIFile(...),
    project_id: int = Form(1),
):
    """
    接收文件上传，提取文本，调用 LLM 解析为结构化情报，存入数据库。

    - 支持: .pdf / .docx / .txt
    - API Key 通过 X-API-Key header 传入
    - 返回 4+1 JSON 结构化情报
    """
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    # --- 1. 获取 API Key ---
    api_key = request.headers.get("x-api-key", "") or ""
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY", "")

    # --- 2. 文件类型校验 ---
    filename = file.filename or "unknown"
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if suffix not in ("pdf", "docx", "txt"):
        return {
            "success": False,
            "error": f"不支持的文件类型: .{suffix}。仅支持 PDF / DOCX / TXT",
        }

    # --- 3. 读取文件内容 ---
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        return {"success": False, "error": "文件内容为空"}

    # --- 4. 提取文本 ---
    extracted_text = ""

    if suffix == "pdf":
        try:
            import io
            import PyPDF2

            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            extracted_text = "\n".join(pages_text)
        except Exception as e:
            return {"success": False, "error": f"PDF 解析失败: {str(e)}"}

    elif suffix == "docx":
        try:
            import io
            from docx import Document

            doc = Document(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            extracted_text = "\n".join(paragraphs)
        except Exception as e:
            return {"success": False, "error": f"DOCX 解析失败: {str(e)}"}

    elif suffix == "txt":
        try:
            extracted_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                extracted_text = file_bytes.decode("gbk")
            except UnicodeDecodeError:
                return {"success": False, "error": "TXT 文件编码无法识别"}

    if not extracted_text.strip():
        return {"success": False, "error": "文件中未提取到有效文本内容"}

    # --- 5. 调用 LLM 解析 ---
    try:
        from llm_service import parse_visit_log

        if not api_key:
            return {
                "success": False,
                "error": "未提供 API Key。请在设置中输入 OpenAI API Key",
            }

        parsed_json_str = parse_visit_log(api_key, extracted_text[:4000])
    except Exception as e:
        return {"success": False, "error": f"AI 解析失败: {str(e)}"}

    # --- 6. 存入数据库 ---
    try:
        from database import save_intelligence

        save_intelligence(project_id, extracted_text[:2000], parsed_json_str)
    except Exception as e:
        # 存储失败不影响返回解析结果
        print(f"⚠️ 数据库存储失败: {e}")

    # --- 7. 返回结果 ---
    try:
        intelligence = json.loads(parsed_json_str)
    except (json.JSONDecodeError, TypeError):
        intelligence = {"raw_response": parsed_json_str}

    return {
        "success": True,
        "filename": filename,
        "extracted_text_length": len(extracted_text),
        "intelligence": intelligence,
    }





# ── 沙盘推演 ──


@app.get("/api/sandbox/projects/{project_id}")
async def get_sandbox_data(project_id: int):
    """
    返回指定项目的沙盘推演数据。
    从 4+1 情报中聚合推导出 bidAnalysis + intelSummary。
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. 项目基本信息
        cursor.execute(
            "SELECT project_id, project_name, current_stage, client, applicant, dept, "
            "COALESCE(design_institute, '') AS design_institute, "
            "COALESCE(general_contractor, '') AS general_contractor "
            "FROM projects WHERE project_id = ?",
            (project_id,),
        )
        row = cursor.fetchone()
        if not row:
            return {"error": f"项目 ID {project_id} 不存在", "project": None}

        project_info = {
            "id": row[0],
            "name": row[1],
            "stage": row[2] or "",
            "client": row[3] or "",
            "applicant": row[4] or "",
            "dept": row[5] or "",
            "designInstitute": row[6] or "",
            "generalContractor": row[7] or "",
        }

        # 2. 关键人数量
        cursor.execute(
            "SELECT COUNT(*) FROM stakeholders WHERE project_id = ?",
            (project_id,),
        )
        stakeholder_count = cursor.fetchone()[0]
        project_info["stakeholderCount"] = stakeholder_count

        # 2b. 干系人详情列表（供前端 AI 军师动态下拉框）
        cursor.execute(
            "SELECT name, hard_profile, soft_persona FROM stakeholders WHERE project_id = ?",
            (project_id,),
        )
        stakeholder_rows = cursor.fetchall()
        stakeholder_list = [
            {
                "name": r["name"] or "",
                "title": r["hard_profile"] or "",
                "tags": r["soft_persona"] or "",
            }
            for r in stakeholder_rows
        ]

        # 3. 拉取该项目所有 visit_logs 的 AI 解析数据
        cursor.execute(
            "SELECT ai_parsed_data, created_at FROM visit_logs "
            "WHERE project_id = ? ORDER BY log_id DESC",
            (project_id,),
        )
        logs = cursor.fetchall()

    # 4. 聚合 4+1 情报
    all_gap_alerts: list[str] = []
    all_competitors: list[dict] = []
    all_statuses: list[str] = []
    all_next_steps: list[str] = []
    latest_log_time = None

    for ai_json_str, created_at in logs:
        if latest_log_time is None:
            latest_log_time = created_at

        try:
            parsed = json.loads(ai_json_str) if ai_json_str else {}
        except (json.JSONDecodeError, TypeError):
            parsed = {}

        # gap_alerts
        for alert in parsed.get("gap_alerts", []):
            if alert and alert not in all_gap_alerts:
                all_gap_alerts.append(alert)

        # competitor_info
        for comp in parsed.get("competitor_info", []):
            name = comp.get("name", "").strip()
            if name and not any(c.get("name") == name for c in all_competitors):
                all_competitors.append({
                    "name": name,
                    "quote": comp.get("quote"),
                    "strengths": comp.get("strengths", ""),
                    "weaknesses": comp.get("weaknesses", ""),
                    "recentActions": comp.get("recent_actions", ""),
                })

        # current_status
        status = parsed.get("current_status", "")
        if status and status != "未提供项目现状、预算与进度信息":
            all_statuses.append(status)

        # next_steps
        ns = parsed.get("next_steps", "")
        if ns and ns != "未提供下一步行动计划":
            all_next_steps.append(ns)

    # 5. 推导控标点 (control points)
    control_points: list[dict] = []

    # 5a. 从 gap_alerts 推导
    budget_unknown = any("未确认" in g and "预算" in g for g in all_gap_alerts)
    decision_unknown = any("未识别" in g and "决策" in g for g in all_gap_alerts)

    if budget_unknown:
        control_points.append({
            "text": "项目预算尚未确认，报价基准缺失",
            "risk": "high",
        })
    if decision_unknown:
        control_points.append({
            "text": "关键决策链未完整覆盖，存在盲区决策人",
            "risk": "high",
        })

    # 5b. 从 stakeholder 数量推导
    if stakeholder_count < 3:
        control_points.append({
            "text": f"决策链信息不足（仅覆盖 {stakeholder_count} 人），需补齐组织架构",
            "risk": "medium",
        })

    # 5c. 从竞品覆盖度推导
    if not all_competitors:
        control_points.append({
            "text": "暂无竞品情报，竞争态势不明，可能遗漏强劲对手",
            "risk": "medium",
        })
    elif len(all_competitors) >= 3:
        control_points.append({
            "text": f"竞争激烈（已识别 {len(all_competitors)} 家对手），需重点防守",
            "risk": "high",
        })

    # 5d. 从情报记录量推导
    if len(logs) == 0:
        control_points.append({
            "text": "该项目无任何情报记录，沙盘数据为空白状态",
            "risk": "high",
        })
    elif len(logs) < 3:
        control_points.append({
            "text": f"情报积累不足（仅 {len(logs)} 条记录），研判置信度低",
            "risk": "low",
        })

    # 6. 映射废标风险 (rejection risks)
    rejection_risks: list[dict] = []
    for alert in all_gap_alerts:
        severity = "critical" if any(kw in alert for kw in ["未确认", "未识别", "未获取"]) else "warning"
        rejection_risks.append({
            "text": alert.replace("⚠️ ", ""),
            "severity": severity,
        })

    # 7. 从 current_status 中尝试提取最高限价 / 预算
    import re
    max_price = None
    for status in all_statuses:
        # 匹配中文金额格式：数字+万 或 数字+亿
        price_match = re.search(r"(\d+(?:\.\d+)?)\s*[万亿]", status)
        if price_match:
            val = float(price_match.group(1))
            unit = "亿" if "亿" in status[price_match.start():price_match.end()+1] else "万"
            max_price = val * 10000 if unit == "亿" else val
            break

    # 8. 组装返回
    return {
        "project": project_info,
        "bidAnalysis": {
            "controlPoints": control_points,
            "rejectionRisks": rejection_risks,
            "maxPrice": max_price,
            "competitors": all_competitors,
        },
        "intelSummary": {
            "currentStatus": all_statuses[0] if all_statuses else "暂无项目现状情报",
            "nextSteps": all_next_steps[0] if all_next_steps else "暂无下一步计划",
            "logCount": len(logs),
            "latestLogTime": latest_log_time,
        },
        "stakeholders": stakeholder_list,
    }

# ── AI 统帅部：赢率诊断 & NBA 报告 ──


# MEDDIC 动态赢率评价维度（原版复刻）
_NBA_EVAL_DIMENSIONS = {
    "M — 量化指标 (Metrics)": 80,
    "E — 经济决策者 (Economic Buyer)": 100,
    "D — 决策标准 (Decision Criteria)": 70,
    "D — 决策流程 (Decision Process)": 70,
    "I — 核心痛点 (Identify Pain)": 90,
    "C — 内部教练 (Champion)": 90,
    "R — 利益关系捆绑 (Relationship)": 85,
}


@app.post("/api/ai/generate_nba")
async def generate_nba(request: Request):
    """
    赢率诊断与 NBA (Next Best Action) 报告生成。
    聚合该项目全量 visit_logs → MEDDIC 7 维加权打分 → 赢率 + 盲区 + 杠杆 + NBA。
    """
    from llm_service import build_llm_router
    import base64

    body = await request.json()
    project_id = body.get("project_id")
    api_key = request.headers.get("X-API-Key", "").strip()

    # 解析 LLM 配置
    llm_configs: dict = {}
    llm_config_raw = request.headers.get("X-LLM-Config", "").strip()
    if llm_config_raw:
        try:
            llm_configs = json.loads(base64.b64decode(llm_config_raw).decode("utf-8"))
        except Exception:
            llm_configs = {}

    if not api_key and not llm_configs:
        return JSONResponse(content={"error": "请先配置 API Key"}, status_code=401)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT project_name FROM projects WHERE project_id = ?", (project_id,))
        proj = cursor.fetchone()
        if not proj:
            return JSONResponse(content={"error": "项目不存在"}, status_code=404)
        project_name = proj[0]

        cursor.execute(
            "SELECT ai_parsed_data FROM visit_logs WHERE project_id = ? ORDER BY log_id DESC",
            (project_id,),
        )
        logs = cursor.fetchall()

    # 聚合情报
    intel_parts = [str(row[0]) for row in logs if row[0]]
    current_data = "\n".join(intel_parts)
    if not current_data.strip():
        current_data = f"【系统提示】：项目 {project_name} 暂无情报记录，请基于空白状态给出通用建议。"

    # 动态维度字符串
    dim_string = "\n".join([
        f"- **{dim}** (模型赋予重要度: {weight}/100)：[请打分 X/10分] - 依据：[请结合情报说明打分依据]"
        for dim, weight in _NBA_EVAL_DIMENSIONS.items()
    ])

    nba_prompt = f"""你是一位身经百战的 B2B 大客户销售副总裁。请阅读该项目自立项以来的所有情报记录。

【你的任务】：
请摒弃主观直觉，严格按照我方设定的【动态赢率评价模型】输出结构化诊断报告。必须包含以下四个部分，并严格使用 Markdown 格式：

### 📊 动态多维雷达测算
[请根据情报，对以下我方设定的核心维度分别进行严苛打分（单项满分10分）：]
{dim_string}

**📈 严格折算当前真实赢率**：[X]%
(注：请利用你打出的单项分数，结合我们赋予该项的【重要度】进行加权平均计算，得出最具科学性的真实赢率百分比)

### 🚨 当前致命盲区 (Red Flags)
[重点针对上述打分在 5 分及以下的低分项，列出 1 到 2 个销售当前的致命漏洞，语气要极度犀利严厉！]

### 💡 我方核心杠杆
[结合上述的高分项，指出我们当前最能拿来翻盘或锁定胜局的武器是什么。]

### 🚀 下一步最佳行动 (Next Best Action)
[给出 3 条极其具体的、针对弥补上述低分盲区的战术动作。必须是销售明天就能去执行的具体事项！]

以下是该项目的所有历史情报档案：
{current_data}
"""

    try:
        router = build_llm_router(primary_api_key=api_key, llm_configs=llm_configs)
        report = router.chat(
            messages=[{"role": "user", "content": nba_prompt}],
            temperature=0.5,
        )
        return {"report": report, "projectName": project_name}
    except Exception as e:
        return JSONResponse(content={"error": f"AI 诊断失败: {str(e)}"}, status_code=500)


# ── 干系人保存 ──


@app.post("/api/sandbox/stakeholders/save")
async def save_stakeholders(request: Request):
    """
    全量替换保存干系人数据。
    Body: { project_id: 1, stakeholders: [{name, title, role, attitude, influence, reports_to}] }
    """
    body = await request.json()
    project_id = body.get("project_id")
    stakeholders = body.get("stakeholders", [])

    if not project_id:
        return JSONResponse(content={"error": "缺少 project_id"}, status_code=400)

    with get_db() as conn:
        cursor = conn.cursor()
        # 全量替换策略
        cursor.execute("DELETE FROM stakeholders WHERE project_id = ?", (project_id,))
        for s in stakeholders:
            name = s.get("name", "").strip()
            if not name:
                continue
            hard_profile = s.get("title", "")
            # 将角色 + 态度 + 影响力 + 汇报关系合并为 soft_persona
            role = s.get("role", "")
            attitude = s.get("attitude", "")
            influence = s.get("influence", "")
            reports_to = s.get("reports_to", "")
            soft_parts = [p for p in [role, attitude, f"影响力:{influence}" if influence else "", f"汇报给:{reports_to}" if reports_to else ""] if p]
            soft_persona = " | ".join(soft_parts)
            cursor.execute(
                "INSERT INTO stakeholders (name, project_id, hard_profile, soft_persona) VALUES (?, ?, ?, ?)",
                (name, project_id, hard_profile, soft_persona),
            )
        conn.commit()

    return {"saved": len([s for s in stakeholders if s.get("name", "").strip()])}

# ── 火力支援系统 (原版 app.py L1422-1737) ──


def _get_project_intel_context(project_id: int) -> str:
    """聚合指定项目的全量情报文本，供 AI 生成使用。"""
    import sqlite3
    conn = sqlite3.connect("intel_system.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT ai_parsed_data FROM visit_logs WHERE project_id = ? ORDER BY log_id DESC",
        (project_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return "\n".join([r[0] for r in rows if r[0]])


@app.post("/api/ai/generate_followup")
async def generate_followup(request: Request):
    """生成跟进话术 (微信/邮件)。"""
    body = await request.json()
    api_key = _resolve_api_key(request)
    if not api_key:
        return JSONResponse(content={"error": "未配置 API Key"}, status_code=400)

    project_id = body.get("project_id")
    context = _get_project_intel_context(project_id) if project_id else ""

    try:
        from llm_service import generate_followup_email
        result = generate_followup_email(
            api_key=api_key,
            context_data=context or "暂无情报数据",
            channel=body.get("channel", "email"),
            target_person=body.get("target_person", "关键决策人"),
            project_stage=body.get("project_stage", "初期接触"),
            use_top_to_top=body.get("use_top_to_top", False),
            shared_history=body.get("shared_history", ""),
            is_director=body.get("is_director", False),
            subordinate_name=body.get("subordinate_name", ""),
        )
        return {"success": True, "content": result}
    except Exception as e:
        return JSONResponse(content={"error": f"生成失败: {str(e)}"}, status_code=500)


@app.post("/api/ai/generate_tech_summary")
async def generate_tech_summary_endpoint(request: Request):
    """生成技术方案摘要。"""
    body = await request.json()
    api_key = _resolve_api_key(request)
    if not api_key:
        return JSONResponse(content={"error": "未配置 API Key"}, status_code=400)

    project_id = body.get("project_id")
    context = _get_project_intel_context(project_id) if project_id else ""

    try:
        from llm_service import generate_tech_summary
        result = generate_tech_summary(
            api_key=api_key,
            context_data=context or "暂无情报数据",
            channel=body.get("channel", "email"),
            tech_competitor=body.get("tech_competitor", ""),
            tech_status=body.get("tech_status", ""),
            tech_pain_points=body.get("tech_pain_points", []),
            tech_role=body.get("tech_role", []),
        )
        return {"success": True, "content": result}
    except Exception as e:
        return JSONResponse(content={"error": f"生成失败: {str(e)}"}, status_code=500)


@app.post("/api/ai/generate_insider_ammo")
async def generate_insider_ammo_endpoint(request: Request):
    """生成内线话术 (3 版本)。"""
    body = await request.json()
    api_key = _resolve_api_key(request)
    if not api_key:
        return JSONResponse(content={"error": "未配置 API Key"}, status_code=400)

    project_id = body.get("project_id")
    context = _get_project_intel_context(project_id) if project_id else ""

    try:
        from llm_service import generate_insider_ammo
        result = generate_insider_ammo(
            api_key=api_key,
            context_data=context or "暂无情报数据",
            channel=body.get("channel", "wechat"),
            target_person=body.get("target_person", "教练/内线"),
            project_stage=body.get("project_stage", "初期接触"),
            leader_attitude=body.get("leader_attitude", ""),
            leader_history=body.get("leader_history", ""),
        )
        return {"success": True, "content": result}
    except Exception as e:
        return JSONResponse(content={"error": f"生成失败: {str(e)}"}, status_code=500)

# ── AI 参谋部聊天 (原版 app.py L1741-1791) ──


@app.post("/api/ai/chat")
async def ai_chat(request: Request):
    """AI 参谋部：带项目上下文的对话式问答。"""
    body = await request.json()
    api_key = _resolve_api_key(request)
    if not api_key:
        return JSONResponse(content={"error": "未配置 API Key"}, status_code=400)

    project_id = body.get("project_id")
    messages = body.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    if not user_query.strip():
        return JSONResponse(content={"error": "请输入您的问题"}, status_code=400)

    context = _get_project_intel_context(project_id) if project_id else ""

    try:
        from llm_service import chat_with_project
        result = chat_with_project(
            api_key=api_key,
            context_data=context or "暂无情报数据",
            user_query=user_query,
        )
        return {"success": True, "content": result}
    except Exception as e:
        return JSONResponse(content={"error": f"参谋部通信故障: {str(e)}"}, status_code=500)

# ── AI 伴学中心 (原版 app.py L1794-1922) ──


@app.post("/api/ai/generate_quiz")
async def generate_quiz_endpoint(request: Request):
    """基于项目情报生成实战测验题。"""
    body = await request.json()
    api_key = _resolve_api_key(request)
    if not api_key:
        return JSONResponse(content={"error": "未配置 API Key"}, status_code=400)

    project_id = body.get("project_id")
    context = _get_project_intel_context(project_id) if project_id else ""

    try:
        from llm_service import generate_quiz
        quiz = generate_quiz(api_key=api_key, context_data=context or "暂无情报数据")
        return {"success": True, "quiz": quiz}
    except Exception as e:
        return JSONResponse(content={"error": f"出题失败: {str(e)}"}, status_code=500)


@app.post("/api/ai/coach_evaluate")
async def coach_evaluate(request: Request):
    """AI销售教头点评用户的实战应对话术。"""
    body = await request.json()
    api_key = _resolve_api_key(request)
    if not api_key:
        return JSONResponse(content={"error": "未配置 API Key"}, status_code=400)

    project_id = body.get("project_id")
    quiz_question = body.get("quiz", "")
    user_answer = body.get("answer", "")
    if not user_answer.strip():
        return JSONResponse(content={"error": "请先输入您的应对话术"}, status_code=400)

    context = _get_project_intel_context(project_id) if project_id else "暂无情报"

    coach_prompt = f"""你是一位年薪千万的 B2B 大客户销售总监兼无情的演练教头（精通 Miller Heiman 体系）。

【项目当前局势与基座情报】：
{context}

【AI 教练出的实战题】：
{quiz_question}

【销售员的实战话术/策略】：
"{user_answer}"

【你的点评任务】：
请严格按照以下 Markdown 格式输出：

### 📊 战术维度评分 (总分 100)
- **破冰与共情 (25分)**：[打分] - [点评]
- **痛点与价值 (25分)**：[打分] - [点评]
- **排他与控标 (25分)**：[打分] - [点评]
- **推进与逼单 (25分)**：[打分] - [点评]

### 🔪 致命漏洞剖析
[指出话术中最致命的1-2个漏洞]

### 💎 满分示范 (教头下场演示)
[写一段可以直接发送的满分话术]"""

    try:
        from openai import OpenAI as _OpenAI
        _client = _OpenAI(api_key=api_key)
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "你是一位极其严苛的 B2B 大客户销售教头。"},
                {"role": "user", "content": coach_prompt},
            ],
            temperature=0.7,
        )
        feedback = response.choices[0].message.content
        return {"success": True, "feedback": feedback}
    except Exception as e:
        return JSONResponse(content={"error": f"点评引擎故障: {str(e)}"}, status_code=500)


# ── 权力地图关系图谱生成 ──


@app.post("/api/ai/generate_power_map")
async def generate_power_map(request: Request):
    """
    生成 Mermaid 关系图谱 + 定点爆破策略。
    Body: { project_id, project_name, stakeholders_csv }
    """
    from llm_service import build_llm_router
    import base64

    body = await request.json()
    project_name = body.get("project_name", "")
    stakeholders_csv = body.get("stakeholders_csv", "")
    api_key = request.headers.get("X-API-Key", "").strip()

    llm_configs: dict = {}
    llm_config_raw = request.headers.get("X-LLM-Config", "").strip()
    if llm_config_raw:
        try:
            llm_configs = json.loads(base64.b64decode(llm_config_raw).decode("utf-8"))
        except Exception:
            llm_configs = {}

    if not api_key and not llm_configs:
        return JSONResponse(content={"error": "请先配置 API Key"}, status_code=401)

    if not stakeholders_csv.strip():
        return JSONResponse(content={"error": "干系人数据为空"}, status_code=400)

    power_prompt = f"""你是一位精通中国式关系销售的军师。这是项目【{project_name}】的关键人物：
{stakeholders_csv}

请输出：
### 1. 🕸️ 权力关系图谱 (Mermaid)
请生成一段 Mermaid `graph TD` 代码，直观展示汇报关系。铁杆支持者用绿色节点(style X fill:#4ade80)。死敌用红色节点(style X fill:#f87171)。中立用黄色(style X fill:#facc15)。

### 2. 💣 定点爆破与防御策略
给出 3 条极其具体的破局战术。
"""

    try:
        router = build_llm_router(primary_api_key=api_key, llm_configs=llm_configs)
        analysis = router.chat(
            messages=[{"role": "user", "content": power_prompt}],
            temperature=0.6,
        )

        # 尝试提取 Mermaid 代码块
        import re
        mermaid_match = re.search(r'```mermaid(.*?)```', analysis, re.DOTALL)
        mermaid_code = mermaid_match.group(1).strip() if mermaid_match else ""
        strategy = re.sub(r'```mermaid.*?```', '', analysis, flags=re.DOTALL).strip()

        return {"mermaid": mermaid_code, "strategy": strategy, "raw": analysis}
    except Exception as e:
        return JSONResponse(content={"error": f"AI 推演失败: {str(e)}"}, status_code=500)

# ── AI 鹰眼：从历史情报中提取干系人 ──


_EXTRACT_ROLE_OPTIONS = [
    "决策者 (关注ROI/风险)",
    "使用者 (关注易用/免维护)",
    "影响者 (关注参数/合规)",
    "教练/内线 (关注控标/汇报)",
    "技术把关者 (关注技术指标)",
]


@app.post("/api/ai/extract_stakeholders")
async def extract_stakeholders(request: Request):
    """
    AI 鹰眼提取：从项目历史情报中自动提取关键干系人。
    聚合 visit_logs → LLM 强制 JSON → 返回 people[]。
    """
    from llm_service import build_llm_router
    import base64
    import re

    body = await request.json()
    project_id = body.get("project_id")
    api_key = request.headers.get("X-API-Key", "").strip()

    llm_configs: dict = {}
    llm_config_raw = request.headers.get("X-LLM-Config", "").strip()
    if llm_config_raw:
        try:
            llm_configs = json.loads(base64.b64decode(llm_config_raw).decode("utf-8"))
        except Exception:
            llm_configs = {}

    if not api_key and not llm_configs:
        return JSONResponse(content={"error": "请先配置 API Key"}, status_code=401)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT project_name FROM projects WHERE project_id = ?", (project_id,))
        proj = cursor.fetchone()
        if not proj:
            return JSONResponse(content={"error": "项目不存在"}, status_code=404)
        project_name = proj[0]

        cursor.execute(
            "SELECT raw_input, ai_parsed_data FROM visit_logs WHERE project_id = ? ORDER BY log_id DESC",
            (project_id,),
        )
        logs = cursor.fetchall()

    # 聚合全量文本
    full_text = ""
    for log_entry in logs:
        raw_input = str(log_entry[0]) if log_entry[0] else ""
        ai_parsed = str(log_entry[1]) if log_entry[1] else ""
        full_text += raw_input + "\n" + ai_parsed + "\n"

    if len(full_text.strip()) < 10:
        return JSONResponse(content={"error": "该项目情报库为空，请先提交拜访纪要"}, status_code=400)

    role_list = "、".join(_EXTRACT_ROLE_OPTIONS)
    extract_prompt = f"""请从以下项目历史情报中，提取所有出现的关键人物。必须输出合法JSON，不要输出任何其他内容：
{{
    "people": [
        {{"name": "张三", "title": "总经理", "role": "决策者 (关注ROI/风险)", "attitude": "🟡 中立/观望", "influence": 8, "reports_to": ""}}
    ]
}}

规则：
- role 必须从标准库选择：{role_list}
- attitude 必须从以下选择：🟢 铁杆支持、🟡 中立/观望、🔴 反对/死敌
- influence 为 1-10 的整数
- 情报不足以判断的字段，允许输出 "未知"
- 如果无法提取任何人物，返回 {{"people": []}}

以下是项目【{project_name}】的全部历史情报：
{full_text}
"""

    try:
        router = build_llm_router(primary_api_key=api_key, llm_configs=llm_configs)
        result = router.chat(
            messages=[{"role": "user", "content": extract_prompt}],
            temperature=0.3,
        )

        # 剥离 markdown 代码块包裹
        json_str = result.strip()
        if json_str.startswith("```"):
            json_str = re.sub(r'^```json|^```|```$', '', json_str, flags=re.MULTILINE).strip()

        extracted = json.loads(json_str)
        people = extracted.get("people", [])

        return {"stakeholders": people, "projectName": project_name}
    except json.JSONDecodeError as e:
        return JSONResponse(content={"error": f"AI 返回格式异常: {str(e)}"}, status_code=500)
    except Exception as e:
        return JSONResponse(content={"error": f"AI 提取失败: {str(e)}"}, status_code=500)


# ── 知识库 ──


@app.get("/api/kb/documents")
async def get_kb_documents(category: str = "", search: str = ""):
    """
    返回知识库文档列表。
    - category: 按分类筛选（产品参数/竞品打单卡/历史中标库/资质文件）
    - search: 模糊搜索 title + description
    """
    with get_db() as conn:
        cursor = conn.cursor()

        sql = "SELECT doc_id, title, category, icon, file_type, file_size, description, updated_at FROM knowledge_base"
        conditions: list[str] = []
        params: list[str] = []

        if category:
            conditions.append("category = ?")
            params.append(category)

        if search:
            conditions.append("(title LIKE ? OR description LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        sql += " ORDER BY updated_at DESC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()

    docs = []
    for row in rows:
        docs.append({
            "id": row[0],
            "title": row[1],
            "category": row[2],
            "icon": row[3],
            "fileType": row[4],
            "size": row[5],
            "description": row[6],
            "updatedAt": _format_timestamp(row[7]),
        })

    return docs


# ── AI 话术生成 ──


@app.post("/api/ai/generate_pitch")
async def generate_pitch(request: Request):
    """
    基于沙盘真实情报，动态生成实战话术。
    Body: {"project_id": 1, "pitch_type": "wechat_msg"}
    Header: X-API-Key: sk-xxx
    """
    from llm_service import generate_sales_pitch

    # 1. 解析请求
    body = await request.json()
    project_id = body.get("project_id")
    pitch_type = body.get("pitch_type", "wechat_msg")
    target_role = body.get("target_role", "")        # 决策者|使用者|影响者|教练/内线
    custom_input = body.get("custom_input", "")      # 销售前线最新情报
    project_stage = body.get("project_stage", "")    # 项目阶段
    use_history = body.get("use_history", False)      # 调取历史价值
    competitor = body.get("competitor", "")            # 明确对比友商
    current_status_input = body.get("current_status", "")  # 客户当前系统现状
    pain_points = body.get("pain_points", "")         # 客户核心痛点
    api_key = request.headers.get("X-API-Key", "").strip()

    # 解析前端动态 LLM 路由配置（Base64 JSON）
    llm_configs: dict = {}
    llm_config_raw = request.headers.get("X-LLM-Config", "").strip()
    if llm_config_raw:
        try:
            import base64
            llm_configs = json.loads(base64.b64decode(llm_config_raw).decode("utf-8"))
        except Exception:
            llm_configs = {}  # 解析失败，降级为单 Key 模式

    if not api_key and not llm_configs:
        return JSONResponse(content={"error": "请在系统设置中配置 API Key（Header: X-API-Key）"}, status_code=401)

    if pitch_type not in ("wechat_msg", "email", "internal_strategy", "tech_solution"):
        return JSONResponse(content={"error": f"不支持的 pitch_type: {pitch_type}"}, status_code=400)

    # 2. 从 DB 聚合沙盘情报（复用 sandbox 逻辑）
    with get_db() as conn:
        cursor = conn.cursor()

        # 项目基本信息
        cursor.execute(
            "SELECT project_id, project_name, current_stage, client, applicant, dept FROM projects WHERE project_id = ?",
            (project_id,),
        )
        proj = cursor.fetchone()
        if not proj:
            return JSONResponse(content={"error": f"项目 ID {project_id} 不存在"}, status_code=404)

        project_name = proj["project_name"]
        project_stage = proj["current_stage"]
        project_client = proj["client"] or "未知客户"

        # 关键人数量
        cursor.execute("SELECT COUNT(*) as cnt FROM stakeholders WHERE project_id = ?", (project_id,))
        stakeholder_count = cursor.fetchone()["cnt"]

        # 拜访日志
        cursor.execute(
            "SELECT raw_input, ai_parsed_data, created_at FROM visit_logs WHERE project_id = ? ORDER BY log_id DESC",
            (project_id,),
        )
        logs = cursor.fetchall()

    # 3. 聚合情报维度
    import re
    all_gap_alerts: list[str] = []
    all_competitors: list[dict] = []
    all_statuses: list[str] = []
    all_next_steps: list[str] = []
    latest_raw_log = ""

    for i, log in enumerate(logs):
        if i == 0 and log["raw_input"]:
            latest_raw_log = log["raw_input"][:500]

        try:
            parsed = json.loads(log["ai_parsed_data"]) if log["ai_parsed_data"] else {}
        except (json.JSONDecodeError, TypeError):
            continue

        for alert in parsed.get("gap_alerts", []):
            if alert and alert not in all_gap_alerts:
                all_gap_alerts.append(alert)

        for comp in parsed.get("competitor_info", []):
            name = comp.get("name", "")
            if name and not any(c.get("name") == name for c in all_competitors):
                all_competitors.append({
                    "name": name,
                    "quote": comp.get("quote"),
                    "strengths": comp.get("strengths", ""),
                    "weaknesses": comp.get("weaknesses", ""),
                })

        status = parsed.get("current_status", "")
        if status and status not in all_statuses:
            all_statuses.append(status)

        ns = parsed.get("next_steps", "")
        if ns and ns not in all_next_steps:
            all_next_steps.append(ns)

    # 推导控标点
    control_points: list[str] = []
    if any("未确认" in g and "预算" in g for g in all_gap_alerts):
        control_points.append("项目预算尚未确认，报价基准缺失")
    if any("未识别" in g and "决策" in g for g in all_gap_alerts):
        control_points.append("关键决策链未完整覆盖，存在盲区决策人")
    if stakeholder_count < 3:
        control_points.append(f"决策链信息不足（仅覆盖 {stakeholder_count} 人）")
    if not all_competitors:
        control_points.append("暂无竞品情报，竞争态势不明")

    # 提取限价
    max_price_str = "未检测到"
    for status in all_statuses:
        price_match = re.search(r"(\d+(?:\.\d+)?)\s*[万亿]", status)
        if price_match:
            val = price_match.group(0)
            max_price_str = val
            break

    # 4. 序列化为 context_data 文本（全量注入）
    context_lines = [
        f"【项目名称】{project_name}",
        f"【客户】{project_client}",
        f"【项目阶段】{project_stage}",
        f"【关键人覆盖】{stakeholder_count} 人",
        f"【情报记录】{len(logs)} 条拜访日志",
        f"【预估金额/最高限价】{max_price_str}",
        "",
        "【硬性控标点】",
    ]
    if control_points:
        for cp in control_points:
            context_lines.append(f"  • {cp}")
    else:
        context_lines.append("  （暂无）")

    context_lines.append("")
    context_lines.append("【废标风险 / 情报盲区】")
    if all_gap_alerts:
        for alert in all_gap_alerts:
            context_lines.append(f"  • {alert.replace('⚠️ ', '')}")
    else:
        context_lines.append("  （暂无）")

    context_lines.append("")
    context_lines.append("【竞品情报】")
    if all_competitors:
        for comp in all_competitors:
            line = f"  • {comp['name']}"
            if comp.get("quote"):
                line += f"（报价: {comp['quote']}）"
            if comp.get("strengths"):
                line += f" 优势: {comp['strengths']}"
            if comp.get("weaknesses"):
                line += f" 弱点: {comp['weaknesses']}"
            context_lines.append(line)
    else:
        context_lines.append("  （暂无竞品情报）")

    context_lines.append("")
    context_lines.append("【项目现状】")
    context_lines.append(all_statuses[0] if all_statuses else "暂无现状情报")

    context_lines.append("")
    context_lines.append("【下一步计划】")
    context_lines.append(all_next_steps[0] if all_next_steps else "暂无下一步计划")

    if latest_raw_log:
        context_lines.append("")
        context_lines.append("【最新一条拜访原文（截取）】")
        context_lines.append(latest_raw_log)

    # ── 绝对优先级链注入（从低到高，最后的 LLM 最关注） ──

    # 第六顺位：项目阶段
    if project_stage:
        context_lines.append(f"\n【📊 当前项目阶段】{project_stage}")

    # 第五顺位：客户系统现状
    if current_status_input:
        context_lines.append(f"\n【🏭 客户当前系统现状】{current_status_input}")

    # 第四顺位：核心痛点
    if pain_points:
        context_lines.append(f"\n【🔥 客户核心痛点】{pain_points}")
        context_lines.append("▶ 所有话术必须戮中此痛点！")

    # 第三顺位：竞品对标
    if competitor:
        context_lines.append(f"\n【⚔️ 明确对标竞品】{competitor}")
        context_lines.append("▶ 话术中必须暗藏针对性打压/对比，但不直接点名攻击！")

    # 第二顺位：历史价值
    if use_history:
        context_lines.append("\n【🕰️ 历史价值指令】")
        context_lines.append("▶ 必须提及过往合作渊源、高层资源、历史项目交集，强化信任纽带！")

    # 第一顺位：target_role（支持复合人物字符串）
    if target_role:
        if "|" in target_role:
            parts = target_role.split("|", 2)
            person_name = parts[0].strip()
            person_title = parts[1].strip() if len(parts) > 1 else ""
            role_tag = parts[2].strip() if len(parts) > 2 else ""

            context_lines.append(f"\n【🎯 精准狙击目标】")
            context_lines.append(f"姓名: {person_name}")
            context_lines.append(f"职务: {person_title}")
            if role_tag:
                context_lines.append(f"态度/标签: {role_tag}")
            context_lines.append(f"▶ 称谓指令：根据职务自动生成职场称谓（如'{person_name[0]}总'或'{person_name[0]}工'）")
            context_lines.append(f"▶ 必须围绕此人的【职务职责】和【态度倾向】定制话术！")

            # 态度联动战术牵引
            if "反对" in role_tag:
                context_lines.append("⚠️ 此人当前【反对】我方！话术必须以化解抵触为核心！")
            elif "中立" in role_tag:
                context_lines.append("💡 此人当前【中立观望】，话术应侧重利益引导和风险提示。")
            elif "支持" in role_tag:
                context_lines.append("✅ 此人是我方【支持者】，话术应提供弹药让他内部推动。")
        else:
            context_lines.append(f"\n【🎯 目标角色】{target_role}")

    # 第零顺位：custom_input（绝对最高优先级，放最后确保 LLM 最关注）
    if custom_input:
        context_lines.append("\n【⚡ 销售前线最新情报 — 第一优先级】")
        context_lines.append(custom_input)
        context_lines.append("⚠️ 此情报刚获取，所有话术必须无条件紧扣此信息展开！")

    context_data = "\n".join(context_lines)

    # 5. 调用 LLM
    try:
        pitch_text = generate_sales_pitch(
            api_key=api_key,
            context_data=context_data,
            pitch_type=pitch_type,
            target_role=target_role,
            llm_configs=llm_configs,
        )
        return {
            "pitch": pitch_text,
            "pitchType": pitch_type,
            "projectName": project_name,
        }
    except Exception as e:
        return JSONResponse(content={"error": f"AI 生成失败: {str(e)}"}, status_code=500)



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
