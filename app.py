import json
import re
import io
import base64
import difflib
import datetime
import PyPDF2

import openai
import streamlit as st
import streamlit.components.v1 as components
from database import (init_db, insert_visit_log, get_all_logs, add_project, get_projects,
                      get_logs_by_project, save_intelligence, get_all_projects, get_project_data,
                      get_user_blind_spots, save_test_record, get_all_test_records)
from llm_service import (parse_visit_log, parse_visit_log_with_image, encode_image,
                         chat_with_project, chat_with_project_stream,
                         generate_quiz, critique_answer, generate_team_report,
                         generate_followup_email, generate_tech_summary,
                         generate_insider_ammo, transcribe_audio)

# ── 全局默认配置 (Data Dictionary) ──
DEFAULT_CONFIGS = {
    "project_stages": [
        "初期接触", "方案报价", "商务谈判",
        "技术僵持", "逼单/签约", "丢单归档",
    ],
    "pain_point_options": [
        "工期极其紧张", "整体预算受限", "后期维护成本高",
        "安装空间受限", "运行环境恶劣(高腐蚀/高粉尘)",
        "需要智能化升级",
    ],
    "role_options": [
        "决策者 (关注ROI/风险)",
        "使用者 (关注易用/免维护)",
        "影响者 (关注参数/合规)",
        "教练/内线 (关注控标/汇报)",
    ],
    "leader_attitudes": [
        "极度看重初期投入成本 (对价格极其敏感)",
        "绝对迷信大品牌/求稳怕担责 (只信西门子/ABB等大厂)",
        "极度看重工期和投产节点 (对时间/交期极度焦虑)",
        "看重全生命周期与长期绝对安全 (价值与质量导向)",
    ],
    "leader_histories": [
        "首次接触我们，防备心较重",
        "历史合作过，对我们有一定信任基础",
        "过去曾被友商(或低价设备)坑过，心有余悸",
        "对各家方案均不满意，处于摇摆观望状态",
    ],
    "info_sources": [
        "高层客情/内线透露 (可信度极高)",
        "设计院/合作伙伴引入 (带有一定倾向性)",
        "公开招标/采购网 (公开竞争/内定风险高)",
        "陌拜/展会挖掘 (处于极早期)",
        "友商渠道流出 (需防范假消息)",
    ],
    "project_drivers": [
        "老旧设备改造/消除隐患 (关注痛点)",
        "产能扩建/新建厂房 (关注工期)",
        "响应政策/环保合规 (关注指标)",
        "数字化/智能化升级 (关注新技术)",
    ],
    "position_options": [
        "领跑 (参与标准制定/已锁定关键人)",
        "并跑 (常规技术交流中，有竞争)",
        "跟跑/陪跑 (介入较晚/竞品明显占优)",
        "未知 (刚获取信息，局势不明)",
    ],
    "budget_statuses": [
        "预算已全额批复 (随时可采)",
        "部分资金到位/边建边批 (有扯皮风险)",
        "正在申报预算 (可引导预算金额)",
        "资金来源不明/自筹 (警惕烂尾)",
    ],
}


# 柔性评价体系默认维度（各项独立 0-100 评估权重）
DEFAULT_EVAL_DIMENSIONS = {
    "M — 量化指标 (Metrics)": 80,
    "E — 经济决策者 (Economic Buyer)": 100,
    "D — 决策标准 (Decision Criteria)": 70,
    "D — 决策流程 (Decision Process)": 70,
    "I — 核心痛点 (Identify Pain)": 90,
    "C — 内部教练 (Champion)": 90,
    "R — 利益关系捆绑 (Relationship)": 85,
}


def _init_dynamic_options():
    """统一初始化所有动态下拉选项到 session_state（仅首次加载时执行）。"""
    for key, defaults in DEFAULT_CONFIGS.items():
        if key not in st.session_state:
            st.session_state[key] = list(defaults)  # 深拷贝，避免修改全局默认
    # 初始化柔性评价维度
    if "eval_dimensions" not in st.session_state:
        st.session_state.eval_dimensions = dict(DEFAULT_EVAL_DIMENSIONS)
    # 初始化立项审核缓冲池（强制 dict 类型）
    if not isinstance(st.session_state.get("pending_projects"), dict):
        st.session_state.pending_projects = {}  # {full_project_id: {data, history}}
    # 初始化注册表单步骤
    if "reg_form_step" not in st.session_state:
        st.session_state.reg_form_step = 1
    if "form_key" not in st.session_state:
        st.session_state.form_key = 0
    if "project_name_cache" not in st.session_state:
        st.session_state.project_name_cache = []
        try:
            # 初次加载时，从数据库拉取全量数据并进行"万能清洗"
            db_data = get_all_projects()
            if db_data:
                for p in db_data:
                    # 万能解包：无论老板的 DB 返回的是字典、元组还是对象
                    if isinstance(p, dict):
                        name = p.get('project_name') or p.get('name') or p.get('id') or str(p)
                    elif isinstance(p, (list, tuple)) and len(p) > 0:
                        name = str(p[0]) # 假设项目名在第一列
                    else:
                        name = str(p)
                    st.session_state.project_name_cache.append(name)
        except Exception as e:
            print(f"数据库预热异常: {e}")


# ── 本地隐私脱敏 ──

def mask_sensitive_info(text: str) -> str:
    """对文本进行本地隐私脱敏：手机号 & 金额。"""
    # 规则 1：11 位连续数字（手机号）
    text = re.sub(r"\b1[3-9]\d{9}\b", "[PHONE_MASK]", text)
    # 规则 2：数字+万/元（金额）
    text = re.sub(r"\d+(\.\d+)?\s*[万元]", "[MONEY_MASK]", text)
    return text


# 初始化数据库
init_db()
_init_dynamic_options()

# 页面配置
st.set_page_config(page_title="SRI 作战指挥室", layout="wide")

# --- 隐藏 Streamlit 默认的开发者菜单和页脚，打造沉浸式体验 ---
hide_streamlit_style = """
<style>
/* 隐藏右上角的 Deploy 按钮 */
.stDeployButton {
    visibility: hidden;
}
/* 隐藏右上角的三道杠菜单 */
#MainMenu {
    visibility: hidden;
}
/* 隐藏底部的 "Made with Streamlit" */
footer {
    visibility: hidden;
}
</style>
"""
st.markdown(hide_streamlit_style, unsafe_allow_html=True)


# ── 语音文本输入组件（强制简体中文） ──
def _voice_stt_block(label, key):
    """内部复用：渲染录音面板 + Whisper STT，转写结果写入 session_state[key]"""
    short_label = label.split("：")[0].split("(")[0].strip()
    with st.expander(f"🎙️ 点击开启语音输入：{short_label}", expanded=False):
        audio_value = st.audio_input("说话结束请再次点击以转文字", key=f"audio_{key}")

    if audio_value and audio_value != st.session_state.get(f"last_audio_{key}"):
        _api_key = st.session_state.get("api_key_value", "")
        if not _api_key:
            st.warning("请先在左侧侧边栏输入 API Key 以启用语音识别！")
        else:
            with st.spinner("🧠 正在将您的口述转为简体文字..."):
                try:
                    audio_bytes = audio_value.read()
                    audio_file = io.BytesIO(audio_bytes)
                    audio_file.name = "audio.wav"

                    from openai import OpenAI as _OpenAI
                    _client = _OpenAI(api_key=_api_key)
                    transcript_text = _client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="zh",
                        prompt="以下是一段简体中文的业务记录，请务必使用简体中文输出：",
                        response_format="text",
                    )

                    current_text = st.session_state.get(key, "")
                    if current_text:
                        st.session_state[key] = current_text + "\n" + transcript_text
                    else:
                        st.session_state[key] = transcript_text

                    st.session_state[f"last_audio_{key}"] = audio_value
                    st.rerun()
                except Exception as e:
                    st.error(f"语音识别失败，请检查配置：{e}")


def voice_text_area(label, key, placeholder="", height=150):
    """带语音录入的 text_area（强制简体中文）"""
    _voice_stt_block(label, key)
    return st.text_area(label, key=key, placeholder=placeholder, height=height)


def voice_text_input(label, key, placeholder=""):
    """带语音录入的 text_input（强制简体中文）"""
    _voice_stt_block(label, key)
    return st.text_input(label, key=key, placeholder=placeholder)

# ── 侧边栏 ──
with st.sidebar:
    st.header("⚙️ 系统设置")
    api_key = st.text_input("请输入大模型 API Key", type="password")
    st.session_state["api_key_value"] = api_key  # 供 voice_enabled_text_widget 读取

    # 清空输入框的辅助函数
    def _clear_project_inputs():
        for k in ["input_client_manual", "input_project", "input_design_manual",
                   "sb_client_select", "sb_design_select"]:
            if k in st.session_state:
                del st.session_state[k]

    import time
    def auto_focus_next(keyword):
        """强行注入焦点，加时间戳防止组件缓存"""
        uid = time.time()
        js_code = f"""
        <script id="focus-{uid}">
        setTimeout(function() {{
            var doc = window.parent.document;
            var inputs = doc.querySelectorAll('input[type="text"]');
            for (var i = 0; i < inputs.length; i++) {{
                var label = inputs[i].getAttribute('aria-label') || '';
                var placeholder = inputs[i].getAttribute('placeholder') || '';
                if (label.includes('{keyword}') || placeholder.includes('{keyword}')) {{
                    inputs[i].focus();
                    break;
                }}
            }}
        }}, 400); 
        </script>
        """
        components.html(js_code, height=0, width=0)

    with st.expander("➕ 新建作战项目 / 注册申报", expanded=True):
        fk = st.session_state.form_key 
        
        # --- 彻底改用内存缓存层提取联想词库 ---
        existing_full_names = st.session_state.project_name_cache
        
        existing_clients = sorted(list(set([name.split(" - ")[0] for name in existing_full_names if " - " in name])))
        
        # 提取设计院数据 (基于内存全名或历史记录)
        # 注意：如果全名中没有设计院信息，这里可能依然为空，后续建议在注册时将设计院单独存入一个缓存列表
        existing_designs = sorted(list(set([name.split(" - ")[2] for name in existing_full_names if name.count(" - ") >= 2])))

        st.markdown("##### 📝 第一步：锁定终端客户")
        client_options = ["➕ 手动录入新客户"] + existing_clients
        selected_client_option = st.selectbox(
            "🏢 客户/企业名称 (点此直接键盘搜索)：", 
            client_options, 
            index=0, 
            key=f"sb_client_select_{fk}"
        )
        
        if selected_client_option == "➕ 手动录入新客户":
            client_name = st.text_input("✍️ 请输入新客户全称 (按 Enter 回车跳转⬇️)：", placeholder="例：万华化学", key=f"input_client_manual_{fk}")
        else:
            client_name = selected_client_option
            st.success(f"✅ 已锁定客户：{client_name}")

        st.markdown("---")
        
        # 焦点引擎触发：跳第二步
        if client_name and st.session_state.reg_form_step == 1:
            st.session_state.reg_form_step = 2
            auto_focus_next("二期技改") # 用 placeholder 精准制导
            
        if not client_name:
            st.info("👆 请先在上方确立终端客户。")
        else:
            st.markdown("##### 🎯 第二步：确立作战项目")
            project_name = st.text_input("🏗️ 具体项目名称 (必填，按 Enter 回车跳转⬇️)：", placeholder="例：二期技改", key=f"input_project_{fk}")
            
            st.markdown("---")
            
            # 焦点引擎触发：跳第三步
            if project_name and st.session_state.reg_form_step == 2:
                st.session_state.reg_form_step = 3
                auto_focus_next("设计院/总包")

            if not project_name:
                st.info("👆 请在上框输入具体项目名称。")
            else:
                st.markdown("##### 🤝 第三步：关联生态伙伴 (可选)")
                # UI 文案优化：引导用户这是可以直接搜索的
                design_options = ["【找不到？点此输入新设计院】", "🚫 暂无/不需要"] + existing_designs
                selected_design_option = st.selectbox(
                    "📐 设计院/总包 (点此直接键盘搜索)：", 
                    design_options, 
                    index=1, 
                    key=f"sb_design_select_{fk}"
                )
                
                if selected_design_option == "【找不到？点此输入新设计院】":
                    design_institute = st.text_input("✍️ 请输入新设计院全称：", placeholder="例：华陆工程科技", key=f"input_design_manual_{fk}")
                elif selected_design_option == "🚫 暂无/不需要":
                    design_institute = ""
                else:
                    design_institute = selected_design_option
                    st.success(f"✅ 已关联生态：{design_institute}")

        full_project_id = f"{client_name} - {project_name}" if client_name and project_name else ""
        
        if client_name and project_name:
            st.markdown("---")
            is_exact_conflict = False
            is_fuzzy_warning = False
            
            pending_ids = list(st.session_state.get("pending_projects", {}).keys())
            all_ids = existing_full_names + pending_ids
            
            # 1. 绝对冲突
            if full_project_id in all_ids:
                st.error(f"🚨 严重冲突：项目【{full_project_id}】已存在库中或正在审核！")
                is_exact_conflict = True
            else:
                # 2. 改进版模糊撞单雷达 (支持包含关系)
                db_pure_names = [n.split(" - ")[1] for n in existing_full_names if " - " in n]
                warning_matches = set()
                # 只要互相包含就报警 (如 二期 和 二期技改)
                for db_name in db_pure_names:
                    if project_name in db_name or db_name in project_name:
                        warning_matches.add(db_name)
                # 辅以 difflib 宽松匹配
                warning_matches.update(difflib.get_close_matches(project_name, db_pure_names, n=3, cutoff=0.3))
                
                close_matches = list(warning_matches)
                if close_matches:
                    is_fuzzy_warning = True
                    st.warning(f"⚠️ 撞单预警：数据库中发现类似项目！")
                    for m in close_matches[:3]: # 最多显示3个
                        st.caption(f"疑似撞单：{m}")
                    st.info("💡 如确认为新分期项目，请点击下方继续注册。")

            if is_exact_conflict:
                st.button("🚫 无法注册 (请修改名称)", disabled=True, use_container_width=True)
            else:
                btn_text = "⚠️ 坚持继续注册 (进入审核池)" if is_fuzzy_warning else "🚀 确认注册入库"
                btn_type = "secondary" if is_fuzzy_warning else "primary"
                
                if st.button(btn_text, type=btn_type, disabled=not full_project_id, use_container_width=True):
                    import datetime
                    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    log_entry = f"【系统日志】注册申请\n- 企业：{client_name}\n- 项目：{project_name}\n- 时间：{timestamp}"
                    design_val = locals().get('design_institute', '')
                    if design_val: log_entry += f"\n- 设计院：{design_val}"
                    
                    new_project_data = {'data': log_entry, 'history': []}

                    if is_fuzzy_warning:
                        if "pending_projects" not in st.session_state: st.session_state.pending_projects = {}
                        st.session_state.pending_projects[full_project_id] = new_project_data
                        st.toast(f"✅ 申请已提交！项目进入审核池。", icon="👮‍♂️")
                    else:
                        # 1. 持久化写入真实数据库
                        add_project(full_project_id, "线索") 
                        
                        # 2. 核心修复：同步写入内存缓存层！瞬间激活联想！
                        # 如果有设计院，我们将它拼在后面用于未来联想，格式：客户 - 项目 - 设计院
                        design_institute = locals().get('design_institute', '')
                        cache_id = f"{full_project_id} - {design_institute}" if design_institute else full_project_id
                        if cache_id not in st.session_state.project_name_cache:
                            st.session_state.project_name_cache.append(cache_id)
                            
                        st.session_state.current_project = full_project_id
                        st.success(f"✅ 注册成功！已写入数据库并同步至本地缓存。")

                    # --- 核心：核弹级自毁重建 ---
                    # 让 form_key 自增，旧的输入框会立刻从页面上消失并重建新的空白框
                    st.session_state.form_key += 1
                    st.session_state.reg_form_step = 1 # 重置焦点状态机
                    st.rerun()

# --- 审核工作台 (DB 写入) ---
if st.session_state.pending_projects:
    st.sidebar.markdown("---")
    st.sidebar.error(f"🔔 待办：有 {len(st.session_state.pending_projects)} 个项目待审核")
    with st.sidebar.expander("👮‍♂️ 注册审核工作台", expanded=True):
        for pid in list(st.session_state.pending_projects.keys()):
            st.write(f"**{pid}**")
            c1, c2 = st.columns(2)
            if c1.button("通过", key=f"ok_{pid}"):
                # 1. 从内存缓冲池取出
                approved_data = st.session_state.pending_projects.pop(pid)
                # 2. 写入数据库
                add_project(pid, "线索") 
                if pid not in st.session_state.project_name_cache:
                    st.session_state.project_name_cache.append(pid)
                # 3. 视觉反馈
                st.session_state.current_project = pid
                st.session_state.input_client_manual = ""
                st.session_state.input_project = ""
                st.toast("✅ 审核通过！已写入数据库并跳转。")
                st.rerun()
            if c2.button("驳回", key=f"no_{pid}"):
                st.session_state.pending_projects.pop(pid)
                st.toast("❌ 已驳回申请")
                st.rerun()
            st.divider()

st.sidebar.divider()
current_user = st.sidebar.selectbox("👤 当前角色", ["销售人员", "销售总监"], key="role_select")

# ── 主界面 ──
st.title("🎯 SRI 动态销售情报系统")

tab_intel, tab_sandbox, tab_academy, tab_leader = st.tabs(
    ["📝 情报录入", "🗺️ 作战沙盘", "🎓 AI 伴学中心", "📊 领导看板"]
)

# ── 情报录入 ──
with tab_intel:
    # 1. 获取项目列表并选择
    project_names = get_all_projects()
    if not project_names:
        st.warning("⚠️ 暂无项目，请先在左侧侧边栏新建项目！")
        selected_project = None
        selected_project_id = None
    else:
        project_map = {name: pid for pid, name in project_names}
        selected_project = st.selectbox("📂 选择关联项目：", list(project_map.keys()), key="tab1_project_select")
        selected_project_id = project_map[selected_project]

    # 2. 战役立项基座
    if selected_project_id:
        st.markdown("### 🏛️ 战役立项基座 (硬性背景指标)")
        with st.expander("📝 首次建档 / 更新项目背景指标 (战略原点)", expanded=True):
            col_base1, col_base2 = st.columns(2)
            with col_base1:
                # 信息来源 - 决定情报的可信度
                info_source = st.selectbox(
                    "🕵️\u200d♂️ 核心信息获取来源：",
                    st.session_state.info_sources,
                    key="base_info_source",
                )
                # 驱动力 - 决定客户痛点方向
                project_driver = st.selectbox(
                    "🚀 立项核心驱动力：",
                    st.session_state.project_drivers,
                    key="base_project_driver",
                )
            with col_base2:
                # 身位 - 决定进攻策略 (领跑vs跟跑)
                current_position = st.selectbox(
                    "🏁 我方当前有利状态 (身位)：",
                    st.session_state.position_options,
                    key="base_position",
                )
                # 预算 - 决定商务策略
                budget_status = st.selectbox(
                    "💰 资金/预算落实情况：",
                    st.session_state.budget_statuses,
                    key="base_budget",
                )

            if st.button("💾 锁定并注入立项背景档案", type="primary", use_container_width=True, key="btn_save_baseline"):
                # 1. 构造高权重情报文本
                baseline_intel = (
                    f"【🚨 系统标记：核心立项背景基座】\n"
                    f"- 信息来源：{info_source}\n"
                    f"- 核心驱动力：{project_driver}\n"
                    f"- 我方当前身位：{current_position}\n"
                    f"- 预算状态：{budget_status}\n"
                    f"（AI参谋请注意：此为项目底层硬性约束，"
                    f"后续所有策略分析必须基于此背景！）"
                )

                # 2. 追加到 session_state 供当前会话中 AI 即时使用
                if "project_data" not in st.session_state:
                    st.session_state.project_data = ""
                st.session_state.project_data += f"\n{baseline_intel}"

                # 3. 持久化到数据库
                try:
                    save_intelligence(selected_project_id, "[立项背景基座更新]", baseline_intel)
                    position_tag = current_position.split(" ")[0]
                    st.success(f"✅ 战役基座已锁定！AI 已感知我方当前处于【{position_tag}】状态。")
                except Exception as e:
                    st.error(f"保存失败，请检查数据库连接。错误信息：{e}")

        st.markdown("---")

    # 3. 添加日常推进动态
    st.markdown("### ✍️ 添加日常推进动态")

    daily_log = voice_text_area(
        label="✍️ 销售口述流水账或会议纪要：",
        key="input_daily_log",
        placeholder="例：今天见了张总，他觉得价格偏高...",
        height=150
    )
    raw_text = daily_log  # 保持下游变量兼容

    st.markdown("---")
    st.markdown("### 📸 👂 现场情报多模态捕获 (支持图文/PDF文档)")
    st.info("💡 实战玩法：上传竞品铭牌照片，或【PDF格式】的招标文件/技术图纸，AI 将自动提炼核心参数！")

    # 初始化已处理文件指纹库（防重复消耗 Token）
    if "processed_file_hashes" not in st.session_state:
        st.session_state.processed_file_hashes = set()
    # 初始化当前解析的草稿情报（缓冲区）
    if "staged_intel" not in st.session_state:
        st.session_state.staged_intel = ""

    uploaded_file = st.file_uploader("上传现场照片或技术文档提取情报 (支持 JPG/PNG/PDF)：", type=["jpg", "jpeg", "png", "pdf"])

    if uploaded_file is not None:
        file_hash = hash(uploaded_file.getvalue())

        # 拦截机制：检查是否已经解析过该文件
        if file_hash in st.session_state.processed_file_hashes:
            st.warning("⚠️ 系统检测到该文件此前已解析并入库，为防止情报冗余，已拦截本次重复解析操作。")
        else:
            # 只有当处于未解析状态，且暂存区为空时，才触发大模型解析
            if st.session_state.get("last_parsed_file") != file_hash:
                with st.spinner("👁️🗨️ 战术 AI 正在深度解析文件，请稍候..."):
                    try:
                        parsed_intel = ""
                        file_extension = uploaded_file.name.split('.')[-1].lower()

                        from openai import OpenAI as _OpenAI
                        _client = _OpenAI(api_key=api_key)

                        # --- 调用解析引擎 ---
                        if file_extension == 'pdf':
                            pdf_reader = PyPDF2.PdfReader(uploaded_file)
                            extracted_text = "".join([pdf_reader.pages[i].extract_text() + "\n" for i in range(min(5, len(pdf_reader.pages)))])

                            pdf_prompt = f"请提炼以下客户文档的核心商业情报、坑(排他条款)及破局建议：\n{extracted_text[:6000]}"
                            response = _client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[{"role": "user", "content": pdf_prompt}]
                            )
                            parsed_intel = response.choices[0].message.content

                        elif file_extension in ['jpg', 'jpeg', 'png']:
                            base64_image = base64.b64encode(uploaded_file.getvalue()).decode('utf-8')
                            response = _client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[{
                                    "role": "user",
                                    "content": [
                                        {"type": "text", "text": "请提取这张业务照片中的品牌、型号、关键参数，并给出销售建议。"},
                                        {"type": "image_url", "image_url": {"url": f"data:image/{file_extension};base64,{base64_image}"}}
                                    ]
                                }]
                            )
                            parsed_intel = response.choices[0].message.content

                        # --- 解析成功，放入缓冲区而不是直接入库 ---
                        if parsed_intel:
                            st.session_state.staged_intel = f"【🚨 深度文档/视觉情报提取】\n{parsed_intel}"
                            st.session_state["last_parsed_file"] = file_hash
                            st.rerun()  # 刷新以显示编辑区

                    except Exception as e:
                        st.error(f"文件解析失败：{e}")

            # --- 渲染情报缓冲区 (Preview & Edit) ---
            if st.session_state.staged_intel:
                st.success("✅ 文件解析成功！请审查提炼出的情报（可手动修改）。")

                # 用户可以在入库前手动修改 AI 的提炼结果
                edited_intel = st.text_area("📝 情报缓冲区 (二次编辑)：", value=st.session_state.staged_intel, height=250)

                # 正式入库按钮
                if st.button("🧠 确认无误，提炼入库", type="primary"):
                    current_data = st.session_state.get('project_data', "")
                    st.session_state['project_data'] = (current_data + "\n\n" + edited_intel) if current_data else edited_intel

                    # 记录该文件指纹，彻底拉黑后续的重复上传
                    st.session_state.processed_file_hashes.add(file_hash)

                    # 清空草稿箱
                    st.session_state.staged_intel = ""
                    st.session_state["last_parsed_file"] = None

                    st.success("🎯 核心情报已正式注入作战沙盘！")
                    st.rerun()

    # 4. 提炼按钮与处理逻辑
    st.markdown("---")
    if st.button("🧠 智能提炼入库", type="primary"):
        if not selected_project:
            st.error("请先选择一个项目！")
        elif not raw_text and not uploaded_file:
            st.warning("请至少输入文字或上传文件！")
        elif not api_key:
            st.warning("⚠️ 请先在左侧侧边栏输入 API Key！")
        else:
            safe_text = mask_sensitive_info(raw_text) if raw_text else ""
            if safe_text:
                st.info(f"🛡️ 文本已脱敏：{safe_text[:80]}...")

            try:
                # 判断是否有图片上传 → 走多模态视觉解析
                has_image = (uploaded_file is not None
                             and uploaded_file.type.split('/')[0] == 'image')

                with st.spinner("AI 正在深度解析情报中..."):
                    if has_image:
                        st.info("🔍 检测到图片情报，已启用 GPT-4o-mini 多模态视觉解析...")
                        image_b64 = encode_image(uploaded_file)
                        parsed_result = parse_visit_log_with_image(
                            api_key, safe_text, image_b64
                        )
                    else:
                        parsed_result = parse_visit_log(api_key, safe_text)

                if parsed_result:
                    save_intelligence(selected_project_id, raw_text, parsed_result)
                    st.success("✅ 情报已成功结构化入库！")
                    st.json(parsed_result)
            except openai.AuthenticationError:
                st.error("⚠️ API 秘钥无效或未配置，请在左侧侧边栏输入正确的秘钥！")
            except Exception as e:
                st.error(f"❌ 解析失败：{e}")

# ── 作战沙盘 ──
with tab_sandbox:
    all_projects = get_all_projects()

    if not all_projects:
        st.info("暂无作战项目，请在左侧新建。")
    else:
        project_map_sb = {name: pid for pid, name in all_projects}
        sandbox_proj_name = st.selectbox(
            "🎯 请选择要检阅的作战项目：",
            list(project_map_sb.keys()),
            key="sandbox_proj",
        )
        sandbox_proj_id = project_map_sb[sandbox_proj_name]

        st.divider()

        # 从数据库获取该项目的关键人 + 日志
        db_stakeholders, logs = get_project_data(sandbox_proj_id)

        st.metric(label="📊 该项目累计情报数", value=len(logs))

        # ═══════════════════════════════════════════
        # 🧠 AI 统帅部：项目全局诊断与战略导航
        # ═══════════════════════════════════════════
        st.markdown("### 🧠 AI 统帅部：项目全局诊断与战略导航")
        st.info("💡 统帅部将扫描该项目自立项以来的所有情报（含文档与语音记录），为您指出当前的致命盲区与最佳赢单路径。")

        if st.button("📊 一键生成【赢率诊断与下一步最佳行动 (NBA)】报告", type="primary", use_container_width=True):
            # --- 解耦：独立从 DB logs 聚合情报，不再依赖左侧 session_state ---
            nba_context_parts = [str(row[3]) for row in logs if row[3]] if logs else []
            current_data = "\n".join(nba_context_parts)
            if not api_key:
                st.toast("🔌 请先填入 API Key！", icon="🔑")
                st.warning("🔌 请先在左上角「⚙️ 系统设置」中填入 API Key！")
            elif not current_data.strip():
                st.toast("该项目暂无情报数据，请先录入拜访记录。", icon="📭")
                st.warning("⚠️ 当前沙盘缺乏情报储备，请先在「情报录入」页签提交拜访记录！")
            else:
                with st.spinner("⏳ 正在进行全息战况推演，测算项目赢率与致命风险..."):
                    try:
                        # 动态生成要求 AI 打分的维度字符串
                        dim_string = "\n".join([f"- **{dim}** (模型赋予重要度: {weight}/100)：[请打分 X/10分] - 依据：[请结合情报说明打分依据]" for dim, weight in st.session_state.eval_dimensions.items()])

                        nba_prompt = f"""
                    你是一位身经百战的 B2B 大客户销售副总裁。请阅读该项目自立项以来的所有情报记录。
                    
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

                        from openai import OpenAI as _OpenAI
                        _client = _OpenAI(api_key=api_key)
                        response = _client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[{"role": "user", "content": nba_prompt}]
                        )
                        diagnosis_report = response.choices[0].message.content

                        st.success("✅ 战况推演完成！以下是统帅部的权威判断：")
                        with st.container(border=True):
                            st.markdown(diagnosis_report)

                    except Exception as e:
                        st.error(f"诊断引擎调用失败：{e}")

        st.markdown("---")
        with st.expander("👥 关键决策链 / 权力地图 (Power Map)", expanded=True):
            st.info("💡 战术核心：谁是拍板人？AI 将自动读取本项目的所有情报进行分析。")

            # --- 核心修复：直接使用沙盘已选中的项目，不再读 session_state.current_project ---
            target_proj = sandbox_proj_name  # 沙盘顶部 selectbox 已选中的项目名
            target_proj_id = sandbox_proj_id  # 对应的数据库 ID

            if "stakeholders" not in st.session_state:
                st.session_state.stakeholders = {}

            import pandas as pd
            import json
            import re

            ROLE_OPTIONS = [
                "决策者 (关注ROI/风险)",
                "使用者 (关注易用/免维护)",
                "影响者 (关注参数/合规)",
                "教练/内线 (关注控标/汇报)",
                "技术把关者 (关注技术指标)"
            ]

            default_df = pd.DataFrame(columns=["姓名", "职位", "角色(支持复选)", "态度", "影响力(1-10)", "上级/汇报给"])

            # --- 🚀 智能提取区 ---
            if st.button(f"🤖 分析【{target_proj}】的全量历史情报 (AI 捕捉)", type="secondary"):
                with st.spinner(f"🕵️‍♂️ 正在穿透【{target_proj}】的所有历史沉淀..."):
                    # ★ 核心修复：从 SQLite 数据库读取真实情报日志（而非空的 session_state）
                    # logs 已在第 560 行通过 get_project_data(sandbox_proj_id) 从 DB 获取
                    # 每条 log 格式: (log_id, created_at, raw_input, ai_parsed_data)
                    full_text = ""
                    for log_entry in logs:
                        raw_input = str(log_entry[2]) if len(log_entry) > 2 and log_entry[2] else ""
                        ai_parsed = str(log_entry[3]) if len(log_entry) > 3 and log_entry[3] else ""
                        full_text += raw_input + "\n" + ai_parsed + "\n"

                    if len(full_text.strip()) < 10:
                        st.warning("⚠️ 该项目的情报库似乎是空的，请先在【情报录入】页签提交一些会议纪要！")
                    else:
                        extract_prompt = f"""
请从以下项目历史情报中，提取关键人物。必须输出合法JSON：
{{
    "people": [
        {{"姓名": "张三", "职位": "总经理", "角色(支持复选)": "决策者 (关注ROI/风险)", "态度": "🟡 中立/观望", "影响力(1-10)": 8, "上级/汇报给": ""}}
    ]
}}
角色必须从标准库选择：{", ".join(ROLE_OPTIONS)}。

情报内容：
{full_text}
"""
                        try:
                            from openai import OpenAI as _OpenAI_pm1
                            _client_pm1 = _OpenAI_pm1(api_key=api_key)
                            resp = _client_pm1.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": extract_prompt}])
                            json_str = resp.choices[0].message.content.strip()
                            if json_str.startswith("```"):
                                json_str = re.sub(r'^```json|```$', '', json_str, flags=re.MULTILINE).strip()

                            extracted = json.loads(json_str).get("people", [])
                            if extracted:
                                existing_df = st.session_state.stakeholders.get(target_proj, default_df)
                                new_rows = pd.DataFrame(extracted)
                                for col in default_df.columns:
                                    if col not in new_rows.columns:
                                        new_rows[col] = None

                                merged_df = pd.concat([existing_df, new_rows], ignore_index=True)
                                merged_df.drop_duplicates(subset=['姓名'], keep='last', inplace=True)

                                st.session_state.stakeholders[target_proj] = merged_df
                                st.toast(f"✅ 成功提取人物到【{target_proj}】！")
                                st.rerun()
                            else:
                                st.warning("⚠️ AI 读了情报，但没发现具体的人名。")
                        except Exception as e:
                            st.error(f"分析出错: {e}")

            # --- 表格渲染区 ---
            if target_proj in st.session_state.stakeholders and not st.session_state.stakeholders[target_proj].empty:
                st_data = st.session_state.stakeholders[target_proj]
            else:
                st_data = default_df

            st_data.index = range(1, len(st_data) + 1)

            column_config = {
                "角色(支持复选)": st.column_config.TextColumn("角色定位", help="多角色用逗号隔开"),
                "态度": st.column_config.SelectboxColumn("态度", options=["🟢 铁杆支持", "🟡 中立/观望", "🔴 反对/死敌"]),
                "影响力(1-10)": st.column_config.NumberColumn("权重", min_value=1, max_value=10)
            }

            edited_df = st.data_editor(
                st_data,
                num_rows="dynamic",
                column_config=column_config,
                use_container_width=True,
                key=f"editor_{target_proj}"
            )

            if st.button("💾 保存数据", type="secondary"):
                st.session_state.stakeholders[target_proj] = edited_df
                st.toast("✅ 保存成功！")

            # --- 政治图谱生成区 ---
            if not edited_df.empty:
                if st.button("🕸️ 生成关系图谱 & 策略", type="primary"):
                    with st.spinner("🕵️‍♂️ AI 正在分析每个人物背后的利益纠葛与政治站位..."):
                        csv_data = edited_df.to_csv(index=False)
                        power_prompt = f"""
你是一位精通中国式关系销售的军师。这是项目【{target_proj}】的关键人物：
{csv_data}

请输出：
### 1. 🕸️ 权力关系图谱 (Mermaid)
请生成一段 Mermaid `graph TD` 代码，直观展示汇报关系。铁杆支持者用绿色节点。死敌用红色节点。

### 2. 💣 定点爆破与防御策略
给出 3 条具体的破局战术。
"""

                        try:
                            from openai import OpenAI as _OpenAI_pm2
                            _client_pm2 = _OpenAI_pm2(api_key=api_key)
                            response = _client_pm2.chat.completions.create(
                                model="gpt-4o",
                                messages=[{"role": "user", "content": power_prompt}]
                            )
                            analysis_result = response.choices[0].message.content

                            mermaid_match = re.search(r'```mermaid(.*?)```', analysis_result, re.DOTALL)
                            if mermaid_match:
                                mermaid_code = mermaid_match.group(1).strip()
                                st.markdown("##### 🏛️ 组织权力渗透图")
                                st.markdown(f"```mermaid\n{mermaid_code}\n```")

                            text_strategy = re.sub(r'```mermaid.*?```', '', analysis_result, flags=re.DOTALL)
                            st.markdown(text_strategy)

                        except Exception as e:
                            st.error(f"AI 推演失败：{e}")

        st.markdown("---")
        st.markdown("### 📜 战役情报时间轴")

        # ── 预解析所有日志 JSON（始终初始化，供后续火力支援使用）──
        parsed_logs = []
        for row in logs:
            try:
                parsed_logs.append(json.loads(row[3]))
            except (json.JSONDecodeError, TypeError):
                parsed_logs.append({})

        if not logs and not db_stakeholders:
            st.info("该项目目前是一片空白，暂无情报录入。可直接使用下方🛠️ 火力支援生成模板话术。")
        else:

            # ── 第一行：关键人物 | 竞争对手 ──
            quad_1, quad_2 = st.columns(2)

            with quad_1:
                st.subheader("👥 关键人物图谱")
                if db_stakeholders:
                    import pandas as pd
                    df = pd.DataFrame(
                        db_stakeholders,
                        columns=["姓名", "硬档案(职务/电话)", "软标签"],
                    )
                    st.dataframe(df, use_container_width=True, hide_index=True)
                else:
                    st.info("暂未归档关键人物。")

            with quad_2:
                st.subheader("⚔️ 竞争对手动态")
                comp_pool = {}
                for data in parsed_logs:
                    for comp in data.get("competitor_info", data.get("competitors", [])):
                        cname = comp.get("name", "").strip()
                        if not cname:
                            continue
                        action = comp.get("recent_actions", comp.get("actions", "")).strip()
                        if cname not in comp_pool:
                            comp_pool[cname] = []
                        if action:
                            comp_pool[cname].append(action)

                if not comp_pool:
                    st.success("暂无明确竞争对手活动，形势大好！")
                else:
                    for cname, actions in comp_pool.items():
                        with st.container(border=True):
                            st.markdown(f"**🚨 {cname}**")
                            if actions:
                                st.markdown("\n".join(f"- {a}" for a in actions))
                            else:
                                st.caption("暂无具体动作记录")

            st.divider()

            # ── 第二行：缺口预警 | 下一步行动 ──
            quad_3, quad_4 = st.columns(2)

            with quad_3:
                st.subheader("🚨 缺口情报雷达")
                all_gaps = []
                for data in parsed_logs:
                    for gap in data.get("gap_alerts", []):
                        if gap and gap not in all_gaps:
                            all_gaps.append(gap)

                if not all_gaps:
                    st.success("✅ 情报完备，暂无关键缺口！")
                else:
                    for gap in all_gaps:
                        st.warning(f"⚠️ {gap}")

            with quad_4:
                st.subheader("📅 下一步行动")
                next_steps_list = []
                for idx_r, row in enumerate(logs):
                    created_at = row[1] or "未知时间"
                    ns = parsed_logs[idx_r].get("next_steps", "").strip()
                    if ns:
                        next_steps_list.append((ns, created_at))

                if not next_steps_list:
                    st.info("暂无明确的下一步推进计划。")
                else:
                    for idx, (step, source_time) in enumerate(next_steps_list):
                        st.info(f"📌 {step}　_({source_time})_")

            st.divider()

            # ── 历史情报时间轴 ──
            st.subheader("📜 历史情报时间轴")
            if logs:
                for idx_r, row in enumerate(logs):
                    log_id, created_at, raw_input, ai_parsed_data = row
                    display_time = created_at or "未知时间"
                    with st.expander(f"📅 {display_time} - 记录 #{log_id}"):
                        col_left, col_right = st.columns(2)
                        with col_left:
                            st.markdown("**📝 原始流水账**")
                            st.text(raw_input or "（无内容）")
                        with col_right:
                            st.markdown("**🤖 AI 结构化情报**")
                            st.json(parsed_logs[idx_r])
            else:
                st.info("暂无情报记录。")

        st.divider()

        # ── 🛠️ 智能火力支援 ──
        st.subheader("🛠️ 智能火力支援 (弹药库)")

        channel_type = st.radio(
            "选择发送渠道：",
            ["🟢 微信/短信 (简洁、口语化)", "📧 正式邮件 (商务、结构化)"],
            horizontal=True,
            key="fire_channel",
        )
        channel_key = "wechat" if "微信" in channel_type else "email"

        # 目标人物选择
        person_options = ["综合/关键决策人 (默认)"]
        if db_stakeholders:
            for s in db_stakeholders:
                if s[0]:
                    person_options.append(s[0])
        target_person = st.selectbox("🎯 选择发送对象：", person_options, key="fire_target")
        if target_person == "综合/关键决策人 (默认)":
            target_person = "关键决策人"

        # 项目阶段 & 历史价值
        stage_col, top_col = st.columns([1, 1])
        with stage_col:
            project_stage = st.selectbox(
                "📊 当前项目阶段：",
                st.session_state.project_stages,
                key="fire_stage",
            )
        with top_col:
            st.markdown("")  # 占位对齐
            use_historical_value = st.checkbox(
                "🕰️ 调取历史价值 (引入过往交集/高层资源/历史项目)",
                key="fire_hist",
            )

        shared_history = ""
        use_top_to_top = use_historical_value  # 保持下游兼容
        if use_historical_value:
            # 提取历史节点（多源容错）
            extracted_events = []

            # 来源 1：从 logs 原文 + parsed_logs 中按人物提取
            if logs:
                for idx_e, row in enumerate(logs):
                    created_at = row[1] or "未知时间"
                    raw_text = row[2] or ""
                    parsed = parsed_logs[idx_e] if idx_e < len(parsed_logs) else {}

                    if target_person != "关键决策人" and target_person in raw_text:
                        for sentence in raw_text.replace("。", "\n").replace("；", "\n").split("\n"):
                            sentence = sentence.strip()
                            if target_person in sentence and len(sentence) > 5:
                                extracted_events.append(f"[{created_at}] {sentence}")

                    for sh in parsed.get("stakeholders", []):
                        s_name = sh.get("name", "")
                        if target_person != "关键决策人" and target_person in s_name:
                            role = sh.get("role", "")
                            attitude = sh.get("attitude", sh.get("soft_persona", ""))
                            if role or attitude:
                                extracted_events.append(
                                    f"[{created_at}] {s_name} - {role} {attitude}".strip()
                                )

            # 来源 2：从 project_data 中提取关键节点
            if 'project_data' in locals() and project_data:
                if isinstance(project_data, list):
                    extracted_events += [str(item) for item in project_data if len(str(item)) > 5]
                elif isinstance(project_data, str):
                    extracted_events += [line.strip() for line in project_data.split('\n') if len(line.strip()) > 5]

            # 去重
            extracted_events = list(dict.fromkeys(extracted_events))

            # 容错：无记录时提供模拟选项确保组件可见
            if not extracted_events:
                extracted_events = [
                    "[暂无结构化记录] 系统建议：去年在行业展会上的交流",
                    "[暂无结构化记录] 系统建议：一期项目时的初期接触",
                ]

            selected_past_events = st.multiselect(
                f"🔍 基于时间轴提取到与【{target_person}】相关的关键节点，请勾选调取：",
                extracted_events,
                key="fire_events",
            )
            manual_history = st.text_input(
                "✍️ 手动补充未记录的历史价值：",
                placeholder="例如：18年一期项目时的并肩作战...",
                key="fire_manual_history",
            )
            shared_history = "；".join(selected_past_events)
            if manual_history.strip():
                shared_history += ("；" if shared_history else "") + manual_history.strip()


        # 总监助销模式
        is_director = (current_user == "销售总监")
        subordinate_name = ""
        if is_director:
            st.info("👑 触发总监助销模式：系统将以高管身份生成降维打击话术。")
            subordinate_name = st.text_input(
                "👤 负责该项目的下属姓名 (用于话术中自然引出)：",
                placeholder="例如：小王 / 李工",
                key="fire_subordinate",
            )

        with st.expander("⚙️ 高级技术方案配置 (四维精准制导)", expanded=True):
            tech_competitor = st.text_input(
                "⚔️ 明确对比友商 (留空则常规输出)：",
                placeholder="例如：西门子、ABB",
                key="tech_competitor",
            )
            tech_status = st.text_input(
                "📊 客户当前系统现状：",
                placeholder="例如：一期设备老化严重，经常跳闸",
                key="tech_status",
            )
            tech_pain_points = st.multiselect(
                "🎯 客户核心痛点 (可多选)：",
                st.session_state.pain_point_options,
                key="tech_pains",
            )
            tech_role = st.multiselect(
                "👤 沟通对象在采购链中的角色 (可身兼数职)：",
                st.session_state.role_options,
                key="tech_role",
            )

        # 聚合情报上下文（所有按钮共用）
        fire_context_parts = [str(row[3]) for row in logs if row[3]] if logs else []
        fire_context = "\n".join(fire_context_parts)

        fire_col1, fire_col2 = st.columns(2)
        with fire_col1:
            btn_email = st.button("✉️ 一键生成跟进话术", use_container_width=True)
        with fire_col2:
            btn_tech = st.button("📄 一键生成技术方案摘要", use_container_width=True)

        # ── btn_email 处理（紧随按钮定义，防止 Streamlit 丢失按钮状态）──
        if btn_email:
            if not api_key:
                st.toast("🔌 请先在左上角系统设置中填入 API Key！", icon="🔑")
                st.warning("🔌 请先在左上角「⚙️ 系统设置」中填入 API Key！")
            else:
                label = "微信消息" if channel_key == "wechat" else "跟进邮件"
                comp = tech_competitor if 'tech_competitor' in dir() else ""
                status = tech_status if 'tech_status' in dir() else ""
                pains = ', '.join(tech_pain_points) if 'tech_pain_points' in dir() and tech_pain_points else "待挖掘"
                roles = ', '.join(tech_role) if 'tech_role' in dir() and tech_role else "决策者"
                try:
                    with st.spinner(f"✉️ AI 正在为【{target_person}】定制{label}..."):
                        if fire_context.strip():
                            email = generate_followup_email(
                                api_key, fire_context, channel_key,
                                target_person, project_stage,
                                use_top_to_top, shared_history,
                                is_director, subordinate_name
                            )
                        else:
                            from openai import OpenAI as _OAI_email
                            _cli = _OAI_email(api_key=api_key)
                            prompt = f"""你是一位身经百战的顶尖B2B大客户销售。请根据以下参数，写一段发给客户的{label}跟进话术。
【项目】：{target_proj}
【竞品情报】：{comp or '未知'}
【客户现状】：{status or '未知'}
【客户痛点】：{pains}
【沟通对象】：{target_person}（身份: {roles}）
【项目阶段】：{project_stage}

要求：1. 语气专业自信有分寸感 2. 直击对方身份最关心的利益点 3. 如有竞品隐晦打击竞品软肋 4. 200字以内直接输出话术正文"""
                            resp = _cli.chat.completions.create(
                                model="gpt-4o",
                                messages=[{"role": "user", "content": prompt}]
                            )
                            email = resp.choices[0].message.content
                    st.success("✅ 话术生成完毕！您可以直接复制发送。")
                    st.text_area(f"📨 生成的{label}（可直接复制）", email, height=300)
                except Exception as e:
                    st.error(f"❌ 生成失败，请检查 API Key 是否正确！错误详情: {e}")

        # ── btn_tech 处理 ──
        if btn_tech:
            if not api_key:
                st.toast("🔌 请先在左上角系统设置中填入 API Key！", icon="🔑")
                st.warning("🔌 请先在左上角「⚙️ 系统设置」中填入 API Key！")
            else:
                label = "技术要点" if channel_key == "wechat" else "技术方案摘要"
                comp = tech_competitor if 'tech_competitor' in dir() else ""
                status = tech_status if 'tech_status' in dir() else ""
                pains = ', '.join(tech_pain_points) if 'tech_pain_points' in dir() and tech_pain_points else "待挖掘"
                roles = ', '.join(tech_role) if 'tech_role' in dir() and tech_role else "决策者"
                try:
                    with st.spinner(f"📄 AI 正在编制{label}..."):
                        if fire_context.strip():
                            tech = generate_tech_summary(
                                api_key, fire_context, channel_key,
                                tech_competitor, tech_status,
                                tech_pain_points, tech_role
                            )
                        else:
                            from openai import OpenAI as _OAI_tech
                            _cli = _OAI_tech(api_key=api_key)
                            prompt = f"""你是一位资深的技术售前专家。请根据以下参数，生成一段用于方案PPT或汇报开头的【技术方案摘要】。
【项目】：{target_proj}
【竞品情报】：{comp or '未知'}
【客户现状】：{status or '未知'}
【客户痛点】：{pains}
【汇报对象身份】：{roles}

要求：1. 使用结构化工程语言条理清晰 2. 强调技术指标如何精准解决客户现状与痛点 3. 形成针对竞品的差异化技术壁垒"""
                            resp = _cli.chat.completions.create(
                                model="gpt-4o",
                                messages=[{"role": "user", "content": prompt}]
                            )
                            tech = resp.choices[0].message.content
                    st.success("✅ 技术方案摘要生成完毕！")
                    st.markdown(f"### 🎯 专为该客户定制的{label} (请直接复制发给客户)：")
                    st.markdown(tech)
                except Exception as e:
                    st.error(f"❌ 技术摘要生成失败，请检查 API Key 是否正确！错误详情: {e}")

        # 动态画像标签已由 _init_dynamic_options() 统一初始化

        st.markdown("#### \U0001f575\ufe0f\u200d\u2642\ufe0f 内线专属通道 (教练弹药库)")
        with st.expander("🎯 锁定汇报目标 (决策者心理画像分析)", expanded=True):
            # ── 领导态度选择 + 动态管理 ──
            leader_attitude = st.selectbox(
                "🧠 领导当前态度/关注核心：",
                st.session_state.leader_attitudes,
                key="insider_leader_attitude",
            )
            att_col1, att_col2 = st.columns([4, 1])
            with att_col1:
                new_att = st.text_input(
                    "➕ 添加新的态度标签：",
                    placeholder="例如：极度关注环保合规与碳排放指标",
                    key="new_attitude_input",
                )
            with att_col2:
                st.markdown("<br>", unsafe_allow_html=True)
                if st.button("添加", key="btn_add_attitude"):
                    if new_att.strip() and new_att.strip() not in st.session_state.leader_attitudes:
                        st.session_state.leader_attitudes.append(new_att.strip())
                        st.rerun()
                    elif new_att.strip():
                        st.toast("⚠️ 该标签已存在！")
            # 删除按钮区域
            if len(st.session_state.leader_attitudes) > 1:
                del_att = st.selectbox(
                    "🗑️ 选择要删除的态度标签：",
                    ["（不删除）"] + st.session_state.leader_attitudes,
                    key="del_attitude_select",
                )
                if del_att != "（不删除）":
                    if st.button(f"确认删除「{del_att[:10]}...」", key="btn_del_attitude"):
                        st.session_state.leader_attitudes.remove(del_att)
                        st.rerun()

            st.divider()

            # ── 领导历史轨迹选择 + 动态管理 ──
            leader_history = st.selectbox(
                "🕰️ 领导的历史轨迹/心理阴影：",
                st.session_state.leader_histories,
                key="insider_leader_history",
            )
            hist_col1, hist_col2 = st.columns([4, 1])
            with hist_col1:
                new_hist = st.text_input(
                    "➕ 添加新的历史标签：",
                    placeholder="例如：上一任厂长被设备事故免职，新领导极度保守",
                    key="new_history_input",
                )
            with hist_col2:
                st.markdown("<br>", unsafe_allow_html=True)
                if st.button("添加", key="btn_add_history"):
                    if new_hist.strip() and new_hist.strip() not in st.session_state.leader_histories:
                        st.session_state.leader_histories.append(new_hist.strip())
                        st.rerun()
                    elif new_hist.strip():
                        st.toast("⚠️ 该标签已存在！")
            # 删除按钮区域
            if len(st.session_state.leader_histories) > 1:
                del_hist = st.selectbox(
                    "🗑️ 选择要删除的历史标签：",
                    ["（不删除）"] + st.session_state.leader_histories,
                    key="del_history_select",
                )
                if del_hist != "（不删除）":
                    if st.button(f"确认删除「{del_hist[:10]}...」", key="btn_del_history"):
                        st.session_state.leader_histories.remove(del_hist)
                        st.rerun()

        btn_insider = st.button("\U0001f525 一键生成【内线向上汇报/控标】专属隐蔽话术", use_container_width=True, type="primary")

        if btn_insider:
            if not api_key:
                st.toast("🔌 请先在左上角系统设置中填入 API Key！", icon="🔑")
                st.warning("🔌 请先在左上角「⚙️ 系统设置」中填入 API Key！")
            elif not fire_context:
                st.toast("该项目暂无情报数据，请先录入拜访记录。", icon="📭")
                st.info("📭 该项目暂无情报数据，无法生成内线话术。请先在「情报录入」Tab 中添加拜访记录。")
            else:
                try:
                    with st.spinner("🕵️ 正在为您的内线/教练量身定制「向上管理」话术..."):
                        insider = generate_insider_ammo(
                            api_key, fire_context, channel_key,
                            target_person, project_stage,
                            leader_attitude, leader_history
                        )
                    st.markdown("### 🔒 极密：内线专属「向上管理」话术 (仅供教练使用，切勿外传)")
                    st.warning(insider)
                except Exception as e:
                    st.error(f"内线话术生成失败：{e}")

        st.divider()

        # ── 💬 AI 参谋部 ──
        st.subheader("💬 AI 参谋部")

        # 项目切换时重置聊天记录，避免串台
        if "advisor_project_id" not in st.session_state or st.session_state.advisor_project_id != sandbox_proj_id:
            st.session_state.advisor_project_id = sandbox_proj_id
            st.session_state.advisor_messages = []

        # 渲染历史对话
        for msg in st.session_state.advisor_messages:
            st.chat_message(msg["role"]).write(msg["content"])

        # 用户输入
        user_query = st.chat_input(
            "向参谋长提问（如：生成一份发给老板的周报 / 分析当前赢单率）..."
        )

        if user_query:
            if not api_key:
                st.warning("请先在左侧侧边栏输入 API Key！")
            else:
                # 显示用户消息
                st.chat_message("user").write(user_query)
                st.session_state.advisor_messages.append({"role": "user", "content": user_query})

                # 聚合项目情报上下文
                context_parts = []
                for row in logs:
                    try:
                        context_parts.append(row[3])
                    except (IndexError, TypeError):
                        pass
                context_str = "\n".join(context_parts)

                # 流式输出 AI 回答
                try:
                    with st.chat_message("assistant"):
                        stream = chat_with_project_stream(
                            api_key, context_str, st.session_state.advisor_messages
                        )
                        response = st.write_stream(stream)
                    st.session_state.advisor_messages.append({"role": "assistant", "content": response})
                except Exception as e:
                    st.error(f"AI 参谋调用失败：{e}")

# ── AI 伴学中心 ──
with tab_academy:
    st.subheader("🎓 AI 实战伴学中心")
    st.caption("基于真实项目情报，AI 教练为你量身定制刁钻的实战演练题。")

    academy_projects = get_all_projects()

    if not academy_projects:
        st.warning("⚠️ 暂无项目数据，请先在情报录入中录入拜访记录。")
    else:
        academy_map = {name: pid for pid, name in academy_projects}
        academy_proj_name = st.selectbox(
            "📂 选择要进行实战演练的项目：",
            list(academy_map.keys()),
            key="academy_proj",
        )
        academy_proj_id = academy_map[academy_proj_name]

        st.divider()

        # 生成测验卡
        if st.button("🎯 生成今日实战测验卡", type="primary"):
            if not api_key:
                st.warning("请先在左侧侧边栏输入 API Key！")
            else:
                _, academy_logs = get_project_data(academy_proj_id)
                if not academy_logs:
                    st.info("该项目暂无情报数据，无法生成测验。")
                else:
                    context_parts = [row[3] for row in academy_logs if row[3]]
                    context_str = "\n".join(context_parts)

                    # 获取盲点数据
                    blind_spots = get_user_blind_spots()

                    try:
                        with st.spinner("📝 AI 教练正在基于三维框架出题..."):
                            quiz = generate_quiz(api_key, context_str, blind_spots)
                        st.session_state.current_quiz = quiz
                    except Exception as e:
                        st.error(f"出题失败：{e}")

        # 展示测验题
        if "current_quiz" in st.session_state and st.session_state.current_quiz:
            st.warning(f"📋 **今日实战题：**\n\n{st.session_state.current_quiz}")

            st.divider()

            st.markdown("### 🗣️ 实战模拟演练")
            st.info("💡 场景：假设你是销售，面对现在的项目局势，你打算怎么给客户发微信或打电话？")

            user_answer = voice_text_area(
                label="请写下（或语音输入）你的应对话术或策略：",
                key="academy_input_voice_fixed",
                placeholder="点击上方 🎙️ 图标可以直接录音...",
                height=200
            )
            answer = user_answer  # 保持下游变量兼容
            if st.button("📮 提交策略并获取 AI 点评", type="primary"):
                if not answer.strip():
                    st.warning("⚠️ 请先输入或语音录入您的应对话术。")
                elif not api_key:
                    st.warning("请先在左侧侧边栏输入 API Key！")
                else:
                    with st.spinner("🕵️‍♂️ 王牌销售教头正在逐句拆解您的话术..."):
                        # 构建高阶点评 Prompt
                        project_context = st.session_state.get("project_data", "暂无情报记录")
                        coach_prompt = f"""你是一位年薪千万的 B2B 大客户销售总监兼无情的演练教头（精通 Miller Heiman 体系）。
你的下属（销售员）刚刚面对以下项目局势，给出了一段他的【实战应对话术/策略】。

【项目当前局势与基座情报】：
{project_context}

【AI 教练出的实战题】：
{st.session_state.current_quiz}

【销售员的实战话术/策略】：
"{answer}"

【你的点评任务】：
你不需要客气！请直接指出他话术里的致命漏洞，并给出极具杀伤力的示范。
请严格按照以下 Markdown 格式输出你的点评报告：

### 📊 战术维度评分 (总分 100)
- **破冰与共情 (25分)**：[你的打分] - [一句话点评：他是否拉近了距离？]
- **痛点与价值 (25分)**：[你的打分] - [一句话点评：他是否打中了客户的核心软肋？]
- **排他与控标 (25分)**：[你的打分] - [一句话点评：他有没有成功给竞品挖坑/设阻？]
- **推进与逼单 (25分)**：[你的打分] - [一句话点评：他是否拿到了下一步的承诺 (Next Step)？]

### 🔪 致命漏洞剖析
[指出他话术中最天真、最容易被客户怼回来、或者最容易被友商利用的 1 到 2 个核心漏洞。语气要犀利！]

### 💎 满分示范 (教头下场演示)
[请你亲自下场，写一段可以直接发给客户/当面说的满分话术。要完美融合人情世故、技术施压和战略推进！]
"""

                        try:
                            from openai import OpenAI as _OpenAI
                            _client = _OpenAI(api_key=api_key)
                            response = _client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[
                                    {"role": "system", "content": "你是一位极其严苛的 B2B 大客户销售教头，点评必须犀利、实战、有杀伤力。"},
                                    {"role": "user", "content": coach_prompt},
                                ],
                                temperature=0.7,
                            )
                            coach_feedback = response.choices[0].message.content

                            # 渲染点评结果
                            st.markdown("---")
                            st.success("✅ 点评完成！请查收您的实战诊断报告：")
                            st.markdown(coach_feedback)

                            # 尝试从 Markdown 中提取总分用于入库
                            import re as _re
                            score_matches = _re.findall(r"(\d+)\s*分?\s*-", coach_feedback)
                            total_score = sum(int(s) for s in score_matches[:4]) if score_matches else 0

                            # 持久化入库
                            save_test_record(
                                "default", academy_proj_id,
                                st.session_state.current_quiz, answer,
                                total_score, coach_feedback, "[]"
                            )
                            st.info("💾 测验记录已归档入库！")

                        except Exception as e:
                            st.error(f"❌ 点评引擎调用失败：{e}")

# ── 领导看板 ──
with tab_leader:
    if current_user != "销售总监":
        st.warning("⚠️ 仅销售总监可访问此看板。请在左侧侧边栏切换角色。")
    else:
        st.subheader("📊 团队能力透视看板")

        records = get_all_test_records()

        if not records:
            st.info("暂无团队测验数据。")
        else:
            # 模块 A：团队测验明细墙
            st.markdown("### 📋 团队测验明细墙")
            import pandas as pd
            df = pd.DataFrame(records, columns=["销售姓名", "关联项目", "测验得分", "盲点标签", "测验时间"])
            st.dataframe(df, use_container_width=True)

            # 统计概览
            avg_score = df["测验得分"].mean()
            total_tests = len(df)
            low_count = len(df[df["测验得分"] < 60])
            col_m1, col_m2, col_m3 = st.columns(3)
            col_m1.metric("📊 总测验次数", total_tests)
            col_m2.metric("📈 平均得分", f"{avg_score:.1f}")
            col_m3.metric("🚨 不及格次数", low_count)

            st.divider()

            # 模块 B：AI 团队能力体检报告
            st.markdown("### 🧠 团队能力 AI 体检报告")
            if st.button("🏥 一键生成团队能力体检报告", type="primary"):
                if not api_key:
                    st.warning("请先在左侧侧边栏输入 API Key！")
                else:
                    # 汇总所有盲点
                    all_spots = []
                    for row in records:
                        if row[3]:  # blind_spots 字段
                            all_spots.append(row[3])
                    spots_summary = "\n".join(all_spots)

                    try:
                        with st.spinner("🧠 AI 正在分析团队能力短板..."):
                            report = generate_team_report(api_key, spots_summary)
                        st.success(f"**📊 团队能力体检报告**\n\n{report}")
                    except Exception as e:
                        st.error(f"报告生成失败：{e}")


# ── 全局配置管理器 (侧边栏底部) ──
def render_config_manager():
    """在侧边栏底部渲染所有下拉选项的增删管理面板。"""
    with st.sidebar:
        st.markdown("---")
        with st.expander("⚙️ 全局系统参数配置 (管理员)", expanded=False):
            st.info("在此处维护系统所有的下拉菜单选项。")

            def manage_options(key, label):
                options = st.session_state.get(key, [])
                st.write(f"**{label}**")
                st.code(options)

                new_item = st.text_input(f"➕ 新增 {label}:", key=f"new_{key}")
                if st.button("添加", key=f"add_{key}"):
                    if new_item.strip() and new_item.strip() not in options:
                        st.session_state[key].append(new_item.strip())
                        st.rerun()
                    elif new_item.strip():
                        st.toast("⚠️ 该选项已存在！")

                items_to_remove = st.multiselect(f"🗑️ 删除 {label}:", options, key=f"del_{key}")
                if st.button("删除选中", key=f"remove_{key}"):
                    for item in items_to_remove:
                        if item in st.session_state[key]:
                            st.session_state[key].remove(item)
                    st.rerun()
                st.markdown("---")

            # 管理各模块参数（key 对应 DEFAULT_CONFIGS 中的键）
            cfg_tab_options, cfg_tab_meddic = st.tabs(["📋 下拉选项管理", "⚖️ MEDDIC 权重配置"])

            with cfg_tab_options:
                manage_options("project_stages", "项目阶段")
                manage_options("pain_point_options", "客户核心痛点")
                manage_options("role_options", "采购链角色")
                manage_options("leader_attitudes", "决策者态度标签")
                manage_options("leader_histories", "决策者历史标签")
                manage_options("info_sources", "信息来源")
                manage_options("project_drivers", "立项驱动力")
                manage_options("position_options", "我方身位")
                manage_options("budget_statuses", "预算状态")

            with cfg_tab_meddic:
                st.write("### 🧠 动态赢率评估模型库")
                st.info("💡 设定各项评估指标的绝对重要性 (0-100)。您可自由增删指标（如增加 '客情关系' 或 '预算合规'）。")

                # 动态渲染当前所有指标的拉杆
                st.write("**⚙️ 调整当前模型参数：**")
                updated_dims = {}
                for dim, weight in st.session_state.eval_dimensions.items():
                    updated_dims[dim] = st.slider(f"{dim} (重要度)", 0, 100, weight)

                # 实时保存拉杆状态
                st.session_state.eval_dimensions = updated_dims

                st.markdown("---")
                # 增删改查：添加新指标
                new_dim = st.text_input("➕ 新增评估指标名称：", placeholder="例如：B - 专项预算落实情况")
                if st.button("添加指标", use_container_width=True):
                    if new_dim and new_dim not in st.session_state.eval_dimensions:
                        st.session_state.eval_dimensions[new_dim] = 50  # 默认赋予50重要度
                        st.rerun()

                # 增删改查：删除指标
                del_dim = st.selectbox("🗑️ 删除不再适用的指标：", ["(不删除)"] + list(st.session_state.eval_dimensions.keys()))
                if st.button("确认删除指标", use_container_width=True):
                    if del_dim != "(不删除)" and del_dim in st.session_state.eval_dimensions:
                        del st.session_state.eval_dimensions[del_dim]
                        st.rerun()

                st.markdown("---")
                # 为老板构想的未来功能预留接口
                st.success("🤖 AI 闭环自学习引擎 (Auto-ML)")
                st.caption("基于未来 100 个闭环项目的胜败复盘数据，AI 将自动反向微调上述权重。（当前处于数据积累期）")
                st.button("启动自学习优化 (数据积累中...)", disabled=True, use_container_width=True)


with st.sidebar:
    st.markdown("---")
    if st.button("🔄 刷新/重置系统状态", use_container_width=True):
        st.rerun()

render_config_manager()
