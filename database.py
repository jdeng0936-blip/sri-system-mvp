import sqlite3


def init_db():
    """初始化 SRI 情报系统数据库，创建核心表结构。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()

    # 项目表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            project_id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT,
            current_stage TEXT,
            tech_specs TEXT,
            war_gaming_tags TEXT
        )
    """)

    # 干系人表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stakeholders (
            person_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            project_id INTEGER,
            hard_profile TEXT,
            soft_persona TEXT
        )
    """)

    # 拜访日志表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visit_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            raw_input TEXT,
            ai_parsed_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 兼容升级：为旧表补充 created_at 列 ──
    cursor.execute("PRAGMA table_info(visit_logs)")
    columns = [row[1] for row in cursor.fetchall()]
    if "created_at" not in columns:
        cursor.execute(
            "ALTER TABLE visit_logs ADD COLUMN created_at TIMESTAMP"
        )

    # 测验记录表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS test_records (
            record_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT DEFAULT 'default',
            project_id INTEGER,
            quiz TEXT,
            user_answer TEXT,
            score INTEGER,
            critique TEXT,
            blind_spots TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


# ── 项目管理 ──

def add_project(project_name: str, current_stage: str):
    """新建作战项目。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO projects (project_name, current_stage) VALUES (?, ?)",
        (project_name, current_stage),
    )
    conn.commit()
    conn.close()


def get_projects():
    """获取所有项目列表，返回 [(id, name), ...]。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute("SELECT project_id, project_name FROM projects")
    rows = cursor.fetchall()
    conn.close()
    return rows


# ── 拜访日志 ──

def insert_visit_log(project_id: int, raw_input: str, ai_parsed_data: str):
    """将原始口述和 AI 提炼结果写入 visit_logs 表。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO visit_logs (project_id, raw_input, ai_parsed_data) VALUES (?, ?, ?)",
        (project_id, raw_input, ai_parsed_data),
    )
    conn.commit()
    conn.close()


def get_all_logs(project_id: int | None = None):
    """查询拜访日志，可按项目筛选，按 ID 倒序返回。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    if project_id:
        cursor.execute(
            "SELECT log_id, created_at, raw_input, ai_parsed_data "
            "FROM visit_logs WHERE project_id = ? ORDER BY log_id DESC",
            (project_id,),
        )
    else:
        cursor.execute(
            "SELECT log_id, created_at, raw_input, ai_parsed_data "
            "FROM visit_logs ORDER BY log_id DESC"
        )
    rows = cursor.fetchall()
    conn.close()
    return rows


def get_logs_by_project(project_id: int):
    """查询指定项目的拜访日志，按 ID 倒序返回。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT log_id, created_at, raw_input, ai_parsed_data "
        "FROM visit_logs WHERE project_id = ? ORDER BY log_id DESC",
        (project_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return rows


# ── 综合情报存储 ──

def save_intelligence(project_id: int, raw_text: str, parsed_json_str: str):
    """将拜访日志 + 关键人档案一起入库。"""
    import json

    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()

    # 1. 存拜访日志
    cursor.execute(
        "INSERT INTO visit_logs (project_id, raw_input, ai_parsed_data) VALUES (?, ?, ?)",
        (project_id, raw_text, parsed_json_str),
    )

    # 2. 提取并存关键人
    try:
        parsed = json.loads(parsed_json_str)
    except (json.JSONDecodeError, TypeError):
        parsed = {}

    # 兼容旧格式 stakeholders 和新格式 decision_chain
    people = parsed.get("decision_chain", parsed.get("stakeholders", []))
    for person in people:
        name = person.get("name", "").strip()
        if not name:
            continue
        role = person.get("title", person.get("role", "未知"))
        phone = person.get("phone")
        soft_tags = ", ".join(person.get("soft_tags", []))
        hard_profile = f"职务: {role} | 电话: {phone or '未获取'}"
        cursor.execute(
            "INSERT INTO stakeholders (name, project_id, hard_profile, soft_persona) "
            "VALUES (?, ?, ?, ?)",
            (name, project_id, hard_profile, soft_tags),
        )

    conn.commit()
    conn.close()


def get_all_projects():
    """获取所有不重复的项目名称列表（来自 projects 表）。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT project_id, project_name FROM projects ORDER BY project_id")
    rows = cursor.fetchall()
    conn.close()
    return rows


def get_project_data(project_id: int):
    """获取指定项目的关键人列表和历史拜访记录。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()

    # 关键人列表
    cursor.execute(
        "SELECT name, hard_profile, soft_persona FROM stakeholders WHERE project_id = ?",
        (project_id,),
    )
    stakeholders = cursor.fetchall()

    # 历史拜访记录
    cursor.execute(
        "SELECT log_id, created_at, raw_input, ai_parsed_data "
        "FROM visit_logs WHERE project_id = ? ORDER BY log_id DESC",
        (project_id,),
    )
    logs = cursor.fetchall()

    conn.close()
    return stakeholders, logs


def get_user_blind_spots(user: str = "default") -> str:
    """获取用户的历史知识盲点（从所有项目的 gap_alerts 聚合）。"""
    import json

    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute("SELECT ai_parsed_data FROM visit_logs ORDER BY log_id DESC LIMIT 20")
    rows = cursor.fetchall()
    conn.close()

    blind_spots = []
    for row in rows:
        try:
            data = json.loads(row[0])
            for gap in data.get("gap_alerts", []):
                if gap and gap not in blind_spots:
                    blind_spots.append(gap)
        except (json.JSONDecodeError, TypeError):
            continue

    return "、".join(blind_spots) if blind_spots else "无"


def save_test_record(user: str, project_id: int, quiz: str,
                    user_answer: str, score: int, critique: str,
                    blind_spots_json: str):
    """将测验记录持久化入库。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO test_records (user, project_id, quiz, user_answer, "
        "score, critique, blind_spots) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user, project_id, quiz, user_answer, score, critique, blind_spots_json),
    )
    conn.commit()
    conn.close()


def get_all_test_records():
    """获取全员测验记录（关联项目名称）。"""
    conn = sqlite3.connect("sri_intel.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT t.user, p.project_name, t.score, t.blind_spots, t.created_at "
        "FROM test_records t LEFT JOIN projects p ON t.project_id = p.project_id "
        "ORDER BY t.created_at DESC"
    )
    rows = cursor.fetchall()
    conn.close()
    return rows


if __name__ == "__main__":
    init_db()
    print("✅ 数据库初始化完成！")

