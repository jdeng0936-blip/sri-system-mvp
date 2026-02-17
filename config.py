"""
配置管理模块
集中管理系统配置，便于维护和部署
"""
import os
from typing import Dict, List

# ─── 数据库配置 ───
DATABASE_PATH = os.getenv("SRI_DB_PATH", "sri_intel.db")

# ─── OpenAI 配置 ───
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))

# ─── 业务配置 (Data Dictionary) ───
PROJECT_STAGES = [
    "初期接触", 
    "方案报价", 
    "商务谈判",
    "技术僵持", 
    "逼单/签约", 
    "丢单归档",
]

PAIN_POINT_OPTIONS = [
    "工期极其紧张", 
    "整体预算受限", 
    "后期维护成本高",
    "安装空间受限", 
    "运行环境恶劣(高腐蚀/高粉尘)",
    "需要智能化升级",
]

ROLE_OPTIONS = [
    "决策者 (关注ROI/风险)",
    "使用者 (关注易用/免维护)",
    "影响者 (关注参数/合规)",
    "教练/内线 (关注控标/汇报)",
]

LEADER_ATTITUDES = [
    "极度看重初期投入成本 (对价格极其敏感)",
    "绝对迷信大品牌/求稳怕担责 (只信西门子/ABB等大厂)",
    "极度看重工期和投产节点 (对时间/交期极度焦虑)",
    "看重全生命周期与长期绝对安全 (价值与质量导向)",
]

LEADER_HISTORIES = [
    "首次接触我们，防备心较重",
    "历史合作过，对我们有一定信任基础",
    "过去曾被友商(或低价设备)坑过，心有余悸",
    "对各家方案均不满意，处于摇摆观望状态",
]

INFO_SOURCES = [
    "微信聊天记录",
    "电话交流记录",
    "邮件往来",
    "现场拜访笔记",
    "内部会议纪要",
    "第三方消息",
]

# ─── UI 配置 ───
PAGE_TITLE = "销售情报系统 (SRI)"
PAGE_ICON = "🎯"
LAYOUT = "wide"

# ─── 系统提示词配置 ───
SYSTEM_PROMPTS = {
    "visit_log_parser": """
    你是一位销售情报分析专家，负责从口述内容中提取关键信息。
    请分析并提取以下要素：客户方参与人员、决策链、痛点、需求、竞争对手、时间节点等。
    """,
    
    "chat_assistant": """
    你是项目情报助手，基于已有情报回答问题。
    回答要准确、专业，直接引用情报内容。
    """,
    
    "quiz_generator": """
    你是培训专家，基于项目情报生成知识测试题。
    题目要有针对性，帮助销售人员了解自己的知识盲区。
    """,
}

# ─── 默认配置字典（向后兼容） ───
DEFAULT_CONFIGS: Dict[str, List[str]] = {
    "project_stages": PROJECT_STAGES,
    "pain_point_options": PAIN_POINT_OPTIONS,
    "role_options": ROLE_OPTIONS,
    "leader_attitudes": LEADER_ATTITUDES,
    "leader_histories": LEADER_HISTORIES,
    "info_sources": INFO_SOURCES,
}

def get_config(key: str, default=None):
    """获取配置值"""
    return DEFAULT_CONFIGS.get(key, default)

def set_config(key: str, value):
    """动态设置配置值"""
    DEFAULT_CONFIGS[key] = value

# ─── 环境检查 ───
def validate_config():
    """验证配置完整性"""
    errors = []
    
    if not OPENAI_API_KEY:
        errors.append("❌ 未设置 OPENAI_API_KEY 环境变量")
    
    if not os.path.exists(os.path.dirname(DATABASE_PATH) or "."):
        errors.append(f"❌ 数据库目录不存在: {DATABASE_PATH}")
    
    return errors

if __name__ == "__main__":
    # 测试配置
    print("=== 配置验证 ===")
    errors = validate_config()
    
    if errors:
        for error in errors:
            print(error)
    else:
        print("✅ 配置验证通过")
    
    print(f"\n数据库路径: {DATABASE_PATH}")
    print(f"OpenAI 模型: {OPENAI_MODEL}")
    print(f"项目阶段数: {len(PROJECT_STAGES)}")
