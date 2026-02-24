import base64
import sys
from dataclasses import dataclass

import openai
from openai import OpenAI


# ══════════════════════════════════════════════════
# 🌐 GlobalLLMRouter — 高可用大模型路由（5 级回退防线）
# ══════════════════════════════════════════════════

# ANSI 颜色常量
_YELLOW = "\033[93m"
_RED = "\033[91m"
_GREEN = "\033[92m"
_CYAN = "\033[96m"
_RESET = "\033[0m"
_BOLD = "\033[1m"


@dataclass
class LLMProvider:
    """单个 LLM 提供商配置"""
    name: str       # "OpenAI" / "Google" / "Anthropic" / "xAI" / "Local"
    model: str      # 模型标识符
    base_url: str   # API base URL（支持反向代理）
    api_key: str    # 动态传入
    timeout: int    # 超时秒数


class GlobalLLMRouter:
    """
    高可用大模型路由 — 5 级回退防线。
    按优先级逐个尝试 provider，任意成功即返回，全部失败抛出异常。
    """

    def __init__(self, providers: list[LLMProvider]):
        self.providers = providers

    def chat(self, messages: list[dict], temperature: float = 0.6, **kwargs) -> str:
        """统一调用入口，自动回退。"""
        errors: list[str] = []
        total = len([p for p in self.providers if p.api_key])

        for idx, provider in enumerate(self.providers, 1):
            if not provider.api_key:
                continue  # 跳过未配置 Key 的 provider

            try:
                print(
                    f"{_CYAN}{_BOLD}🔗 [{idx}/{total}] "
                    f"尝试 {provider.name} ({provider.model})...{_RESET}",
                    file=sys.stderr,
                )

                if provider.name == "Anthropic":
                    # 使用原生 Anthropic SDK
                    import anthropic
                    client = anthropic.Anthropic(
                        api_key=provider.api_key,
                        timeout=provider.timeout,
                    )
                    # 提取 system 消息和 user/assistant 消息
                    system_text = ""
                    user_msgs = []
                    for m in messages:
                        if m["role"] == "system":
                            system_text += m["content"] + "\n"
                        else:
                            user_msgs.append({"role": m["role"], "content": m["content"]})
                    if not user_msgs:
                        user_msgs = [{"role": "user", "content": system_text}]
                        system_text = ""
                    create_kwargs = {
                        "model": provider.model,
                        "max_tokens": 4096,
                        "messages": user_msgs,
                        "temperature": temperature,
                    }
                    if system_text.strip():
                        create_kwargs["system"] = system_text.strip()
                    response = client.messages.create(**create_kwargs)
                    content = response.content[0].text
                else:
                    # OpenAI 兼容 SDK（OpenAI / Gemini / xAI / Local）
                    client = OpenAI(
                        api_key=provider.api_key,
                        base_url=provider.base_url,
                        timeout=provider.timeout,
                    )
                    response = client.chat.completions.create(
                        model=provider.model,
                        messages=messages,
                        temperature=temperature,
                    )
                    content = response.choices[0].message.content

                print(
                    f"{_GREEN}{_BOLD}✅ {provider.name} 命中成功！{_RESET}",
                    file=sys.stderr,
                )
                return content

            except openai.AuthenticationError as e:
                msg = f"[{provider.name}] 🔑 AuthError (Key 无效): {e}"
                errors.append(msg)
                print(
                    f"{_RED}{_BOLD}⛔ {provider.name} Key 无效 (401)，"
                    f"正在切换至下一防线...{_RESET}",
                    file=sys.stderr,
                )
                continue

            except openai.APITimeoutError as e:
                msg = f"[{provider.name}] ⏱️ Timeout: {e}"
                errors.append(msg)
                print(
                    f"{_YELLOW}{_BOLD}⚠️ {provider.name} 调用超时 ({provider.timeout}s)，"
                    f"正在无缝切换至下一防线...{_RESET}",
                    file=sys.stderr,
                )
                continue

            except openai.RateLimitError as e:
                msg = f"[{provider.name}] 🚦 RateLimit: {e}"
                errors.append(msg)
                print(
                    f"{_YELLOW}{_BOLD}⚠️ {provider.name} 触发限流，"
                    f"正在无缝切换至下一防线...{_RESET}",
                    file=sys.stderr,
                )
                continue

            except (openai.APIConnectionError, openai.InternalServerError) as e:
                msg = f"[{provider.name}] 💥 {type(e).__name__}: {e}"
                errors.append(msg)
                print(
                    f"{_RED}{_BOLD}⚠️ {provider.name} 服务异常 ({type(e).__name__})，"
                    f"正在无缝切换至下一防线...{_RESET}",
                    file=sys.stderr,
                )
                continue

            except openai.BadRequestError as e:
                msg = f"[{provider.name}] ⚠️ BadRequest (400): {e}"
                errors.append(msg)
                print(
                    f"{_RED}{_BOLD}⚠️ {provider.name} 请求被拒 (400: {e})，"
                    f"正在切换至下一防线...{_RESET}",
                    file=sys.stderr,
                )
                continue

            except Exception as e:
                msg = f"[{provider.name}] ❓ {type(e).__name__}: {e}"
                errors.append(msg)
                print(
                    f"{_RED}{_BOLD}⚠️ {provider.name} 未知异常 ({type(e).__name__}: {e})，"
                    f"正在切换至下一防线...{_RESET}",
                    file=sys.stderr,
                )
                continue

        # 全部失败
        error_detail = "\n".join(errors)
        print(
            f"{_RED}{_BOLD}🚨 所有 LLM 防线均已失败！\n{error_detail}{_RESET}",
            file=sys.stderr,
        )
        raise RuntimeError(f"所有 LLM 防线均已失败:\n{error_detail}")


def build_llm_router(
    primary_api_key: str = "",
    llm_configs: dict | None = None,
) -> GlobalLLMRouter:
    """
    按优先级构建 5 级路由。
    如果前端传入了 llm_configs，使用动态配置；否则降级为单 Key 模式。
    严格检查 enabled 字段，禁用的 provider 不进入路由。
    """
    cfg = llm_configs or {}

    # 辅助函数：读取原始配置并填充默认值
    def _get(provider_key: str, field: str, default: str) -> str:
        return cfg.get(provider_key, {}).get(field, "") or default

    def _enabled(provider_key: str, default: bool) -> bool:
        p = cfg.get(provider_key, {})
        if isinstance(p, dict) and "enabled" in p:
            return bool(p["enabled"])
        return default

    providers: list[LLMProvider] = []

    # 第一防线: OpenAI
    if _enabled("openai", True):
        key = _get("openai", "apiKey", primary_api_key)
        if key:
            providers.append(LLMProvider(
                name="OpenAI",
                model=_get("openai", "model", "gpt-4o-mini"),
                base_url=_get("openai", "baseUrl", "https://api.openai.com/v1"),
                api_key=key,
                timeout=30,
            ))

    # 第二防线: Google Gemini
    if _enabled("gemini", False):
        key = _get("gemini", "apiKey", "")
        if key:
            providers.append(LLMProvider(
                name="Google Gemini",
                model=_get("gemini", "model", "gemini-2.0-flash"),
                base_url=_get("gemini", "baseUrl", "https://generativelanguage.googleapis.com/v1beta/openai/"),
                api_key=key,
                timeout=30,
            ))

    # 第三防线: Anthropic
    if _enabled("anthropic", False):
        key = _get("anthropic", "apiKey", "")
        if key:
            providers.append(LLMProvider(
                name="Anthropic",
                model=_get("anthropic", "model", "claude-3-5-sonnet-20241022"),
                base_url=_get("anthropic", "baseUrl", "https://api.anthropic.com/v1/"),
                api_key=key,
                timeout=45,
            ))

    # 第四防线: xAI Grok
    if _enabled("xai", False):
        key = _get("xai", "apiKey", "")
        if key:
            providers.append(LLMProvider(
                name="xAI Grok",
                model=_get("xai", "model", "grok-3-mini"),
                base_url=_get("xai", "baseUrl", "https://api.x.ai/v1"),
                api_key=key,
                timeout=30,
            ))

    # 终极物理防线: Local DeepSeek（默认启用，可通过配置禁用）
    if _enabled("local", True):
        local_url = _get("local", "baseUrl", "http://localhost:11434/v1")
        providers.append(LLMProvider(
            name="Local DeepSeek",
            model=_get("local", "model", "deepseek-r1"),
            base_url=local_url,
            api_key="local",
            timeout=120,
        ))

    return GlobalLLMRouter(providers)


SYSTEM_PROMPT = (
    "你是一名资深工业电气销售专家。请对销售拜访口述记录进行结构化情报提取，"
    "严格返回以下 JSON 格式（4+1 情报模型）：\n"
    "{\n"
    "  \"current_status\": \"项目现状、预算与进度信息\",\n"
    "  \"decision_chain\": [\n"
    "    {\"name\": \"姓名\", \"title\": \"职务\", \"phone\": \"联系方式(若无则返回null)\", "
    "\"attitude\": \"支持/中立/反对\", \"soft_tags\": [\"标签1\", \"标签2\"]}\n"
    "  ],\n"
    "  \"competitor_info\": [\n"
    "    {\"name\": \"竞品名称\", \"quote\": \"报价(若无则返回null)\", "
    "\"strengths\": \"优势\", \"weaknesses\": \"劣势\", \"recent_actions\": \"近期动作\"}\n"
    "  ],\n"
    "  \"next_steps\": \"下一步行动计划或销售承诺\",\n"
    "  \"gap_alerts\": [\"缺口预警1\", \"缺口预警2\"]\n"
    "}\n\n"
    "作为严苛的销售总监，请审查拜访记录并在 gap_alerts 中指出缺失的致命情报。规则：\n"
    "1. 提到人物但未提供电话或联系方式 → '⚠️ 未获取 [姓名] 的联系方式'。\n"
    "2. 未提到下一步推进时间 → '⚠️ 缺少明确的下一步推进时间点'。\n"
    "3. 未确认项目预算 → '⚠️ 未确认最终预算'。\n"
    "4. 未识别关键决策人 → '⚠️ 未识别关键决策人'。\n"
    "如果情报完美，gap_alerts 返回空数组 []。\n\n"
    "严禁输出任何 Markdown 标记或多余的解释说明，只返回合法的 JSON 字符串。"
)


def encode_image(uploaded_file) -> str:
    """将上传的图片文件转换为 Base64 字符串。"""
    file_bytes = uploaded_file.read()
    uploaded_file.seek(0)  # 重置指针以便其他地方继续读取
    return base64.b64encode(file_bytes).decode("utf-8")


def parse_visit_log(api_key: str, raw_text: str) -> str:
    """调用大模型，将拜访流水账提炼为结构化 JSON（4+1 情报模型）。"""
    # 根据 key 前缀自动构建路由
    llm_configs = _detect_llm_config(api_key)
    router = build_llm_router(primary_api_key=api_key, llm_configs=llm_configs)

    return router.chat(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ],
        temperature=0.2,
    )


def _detect_llm_config(api_key: str) -> dict:
    """根据 API Key 前缀自动检测 LLM 提供商并构建配置。"""
    if api_key.startswith("sk-ant-"):
        return {
            "openai": {"enabled": False},
            "anthropic": {"enabled": True, "apiKey": api_key, "model": "claude-3-5-sonnet-20241022"},
            "local": {"enabled": False},  # 禁用本地回退，避免卡住
        }
    # 默认走 OpenAI
    return {}


def parse_visit_log_with_image(api_key: str, raw_text: str, image_base64: str) -> str:
    """调用多模态大模型，同时解析文字口述 + 图片情报，输出 4+1 JSON。"""
    client = OpenAI(api_key=api_key)

    user_content = [
        {
            "type": "text",
            "text": (
                "以下是销售的文字口述记录，请结合口述内容和图片中的信息"
                "（如名片上的姓名/电话、设备铭牌参数、报价单价格等），"
                "合并后严格按照 4+1 JSON 格式输出。\n\n"
                f"【销售口述记录】\n{raw_text}"
            ),
        },
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{image_base64}",
                "detail": "high",
            },
        },
    ]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content


ADVISOR_PROMPT = (
    "你是一名狠辣的工业销售军师。请根据提供的项目历史记录，回答用户问题。"
    "如果是写周报，请用极其专业的商务风格；如果是分析局势，请直言不讳地指出风险。"
    "回答必须基于客观情报，给出犀利、专业的分析和策略建议。"
)


def chat_with_project(api_key: str, context_data: str, user_query: str) -> str:
    """基于项目情报上下文，与 AI 参谋对话（非流式）。"""
    client = OpenAI(api_key=api_key)

    user_message = (
        f"【项目历史情报上下文】\n{context_data}\n\n"
        f"【我的问题】\n{user_query}"
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": ADVISOR_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.5,
    )

    return response.choices[0].message.content


def chat_with_project_stream(api_key: str, context_data: str, messages: list):
    """基于项目情报上下文，与 AI 参谋对话（流式输出）。
    
    messages: 完整的对话历史 [{"role": "user"/"assistant", "content": "..."}]
    返回一个生成器，逐 chunk yield 文本。
    """
    client = OpenAI(api_key=api_key)

    # 将项目情报注入 system prompt
    system_msg = (
        f"{ADVISOR_PROMPT}\n\n"
        f"【当前项目的全部历史情报数据】\n{context_data}"
    )

    api_messages = [{"role": "system", "content": system_msg}] + messages

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=api_messages,
        temperature=0.5,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


def generate_quiz(api_key: str, context_data: str, blind_spots: str = "无") -> str:
    """基于项目情报 + 历史盲点，生成一道三维实战情景模拟测验题。"""
    client = OpenAI(api_key=api_key)

    coach_prompt = (
        "你是一名顶级的工业电气销售教练兼技术总工。\n"
        "请仔细阅读该销售的项目汇报内容，以及他过去的"
        f"【知识盲点：{blind_spots}】。\n"
        "你需要从以下三个维度中，针对他的盲点或当前项目的薄弱环节，"
        "提出一道极其刁钻的实战测验题：\n\n"
        "1. 商务博弈（如：应对竞品低价、搞定关键决策人、推进采购流程）。\n"
        "2. 技术方案（如：高低压柜核心参数解析、我方方案的电气技术优势、"
        "解答客户对免维护设计的技术质疑）。\n"
        "3. 行业认知（如：该客户所在行业的最新政策导向、典型用电负荷特征、"
        "上下游痛点）。\n\n"
        "要求：\n"
        "- 不要说废话，结合项目当前真实情况直接提问。\n"
        "- 问题必须具有极强的压迫感和实战意义。\n"
        "- 字数严格控制在 100 字以内。"
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": coach_prompt},
            {"role": "user", "content": f"【项目历史情报】\n{context_data}"},
        ],
        temperature=0.8,
    )

    return response.choices[0].message.content


CRITIQUE_PROMPT = (
    "你是一名极其严苛、狠辣的工业销售总监。请评估销售人员对实战问题的回答。\n"
    "如果回答是\"做好客情\"、\"加强沟通\"等假大空的废话，请给予极低的分数并严厉批评。\n"
    "你必须严格返回以下 JSON 格式：\n"
    "{\n"
    "  \"score\": 数字 (0-100的评分),\n"
    "  \"critique\": \"严厉且直指核心的点评词，不超过150字\",\n"
    "  \"blind_spots\": [\"盲点标签1\", \"盲点标签2\"] "
    "(提取1-3个他缺乏的认知盲点，如\"缺乏具体技术反驳话术\"、\"对竞品交期无预案\")\n"
    "}\n\n"
    "严禁输出任何 Markdown 标记或多余的解释说明，只返回合法的 JSON 字符串。"
)


def critique_answer(api_key: str, quiz: str, user_answer: str) -> str:
    """评估销售人员的应对策略，返回 JSON 格式的评分、点评和盲点。"""
    client = OpenAI(api_key=api_key)

    user_message = (
        f"【测验题目】\n{quiz}\n\n"
        f"【销售人员的回答】\n{user_answer}"
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": CRITIQUE_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content


TEAM_REPORT_PROMPT = (
    "你是一名顶级的工业电气销售赋能专家。\n"
    "请根据以下汇总的【团队近期暴露的知识盲点】，进行深度归纳分析。\n"
    "请输出一份简明扼要的体检报告，必须包含：\n"
    "1. 核心共性短板（大家普遍欠缺的3个能力）。\n"
    "2. 下一步针对性培训建议（具体到应该补齐什么话术或技术知识）。\n"
    "不要废话，直接输出专业分析。"
)


def generate_team_report(api_key: str, blind_spots_summary: str) -> str:
    """基于团队盲点汇总数据，生成团队能力体检报告。"""
    client = OpenAI(api_key=api_key)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": TEAM_REPORT_PROMPT},
            {"role": "user", "content": f"【团队近期暴露的知识盲点汇总】\n{blind_spots_summary}"},
        ],
        temperature=0.5,
    )

    return response.choices[0].message.content


FOLLOWUP_PROMPTS_EMAIL = (
    '你是一名极其专业的工业大客户销售总监。\n'
    '请根据提供的【项目历史情报】，为前线销售写一封发给该项目核心决策人的跟进邮件。\n'
    '要求：\n'
    '1. 必须包含邮件标题行（Subject:）。\n'
    '2. 称呼必须准确（从情报中提取最高级别的决策人）。\n'
    '3. 邮件正文直击客户痛点，巧妙暗示我们在技术或交期上优于竞争对手，'
    '但不可带有明显攻击性。\n'
    '4. 必须包含一个明确的下一步推进动作（例如请求下周三进行技术汇报）。\n'
    '5. 结尾必须有专业落款。\n'
    '6. 语气专业、诚恳、不卑不亢。'
)


def _build_wechat_followup_prompt(target_person: str) -> str:
    return (
        f'你是一名深谙人情世故的顶级工业销售。\n'
        f'请为当前项目向【{target_person}】写一条微信跟进消息。\n\n'
        f'请首先仔细阅读以下【项目历史情报】，重点分析【{target_person}】的'
        f'职务、痛点、性格标签，以及我方目前与他的【关系深度】。\n\n'
        f'【强制性定制化原则】：\n'
        f'1. 看人下菜碟（基于角色）：\n'
        f'   - 如果是技术/总工，多提免维护、稳定性、技术验证；\n'
        f'   - 如果是采购/商务，多提交期保障、综合成本优势；\n'
        f'   - 如果是大老板/决策人，多提无忧运行、大局观、长期合作价值。\n'
        f'2. 把握分寸感（基于关系深度）：\n'
        f'   - 如果情报显示还没加上微信或刚接触，语气必须专业、谦逊、直接表明价值；\n'
        f'   - 如果情报显示已经是熟人/内线（如经常拜访、透露了竞品底价），'
        f'语气要极其自然、口语化，甚至可以带点调侃。\n'
        f'3. 像真人一样自然，禁止翻译腔。\n'
        f'4. 开头直接点明事由，中间软植入我方优势，结尾留一个轻松的互动钩子。\n'
        f'5. 字数控制在 150 字以内，适当使用 emoji。'
    )


def generate_followup_email(api_key: str, context_data: str,
                            channel: str = "email",
                            target_person: str = "关键决策人",
                            project_stage: str = "初期接触",
                            use_top_to_top: bool = False,
                            shared_history: str = "",
                            is_director: bool = False,
                            subordinate_name: str = "") -> str:
    client = OpenAI(api_key=api_key)

    if channel == "wechat":
        prompt = _build_wechat_followup_prompt(target_person)
    else:
        prompt = FOLLOWUP_PROMPTS_EMAIL

    # 阶段感知注入
    prompt += (
        f"\n【当前项目阶段】：{project_stage}。"
        f"请务必根据该阶段的特征调整话术。"
        f"例如：初期重在展示专业与破冰；报价期重在传递价值；"
        f"商务僵持期重在打破信息差或施压。"
    )

    # 高管协同注入
    if use_top_to_top:
        prompt += (
            "\n【高管协同战略】：对方是公司长线客户，"
            "请在话术中极其巧妙、自然地引入我方高管/老领导。"
            "不要生硬，要体现出我方高管对该项目的极度重视，"
            "或者暗示我方高管与对方有历史合作渊源/感情基础。"
            "目的是通过借力打力，促成下一步的高层会面或跨过基层阻碍。"
        )
        if shared_history.strip():
            prompt += (
                f"\n【历史渊源素材】：{shared_history.strip()}。"
                f"请将这段共同经历自然地织入话术中，"
                f"唤醒对方的情绪记忆，拉近距离，但不要显得刻意煽情。"
            )

    # 总监助销模式注入
    if is_director:
        sub = subordinate_name.strip() or "我们的项目负责人"
        prompt += (
            f"\n【总监助销模式】：当前发送者身份是销售总监/高管，不是普通销售。"
            f"请以高管视角撰写话术，体现高层亲自关注的分量感。"
            f"话术中需自然地提及下属【{sub}】，"
            f"例如：'{sub}跟我汇报了贵司项目的进展，我非常重视...' "
            f"或 '我特意让{sub}把最新方案给您同步一下...' "
            f"目的是通过高管身份进行降维打击，同时抬高下属在客户心中的地位。"
        )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"【项目历史情报】\n{context_data}"},
        ],
        temperature=0.7 if channel == "wechat" else 0.6,
    )

    return response.choices[0].message.content


TECH_PROMPTS = {
    "wechat": (
        '你是一名资深的工业电气技术总工。\n'
        '请根据【项目历史情报】，生成一段适合在手机上阅读的技术要点列表。\n'
        '要求：\n'
        '1. 每行不超过 15 字，用 ✅ 等符号分点。\n'
        '2. 突出我方方案的核心技术亮点和免维护优势。\n'
        '3. 对于具体的设备参数（如尺寸、电流），如果你在历史情报中没看到，'
        '请使用 [需填入我方具体参数] 占位，不要瞎编。'
    ),
    "email": (
        '你是一名资深的工业电气技术总工。\n'
        '请根据提供的【项目历史情报】，生成一份精炼的技术方案摘要，'
        '用于提交给客户的技术评审团。\n'
        '要求：\n'
        '1. 罗列我方设备的硬核技术参数与免维护设计优势。\n'
        '2. 针对客户项目需求逐条匹配我方方案的技术亮点。\n'
        '3. 如有竞品情报，以对比表格形式突出差异化优势。\n'
        '4. 对于具体的设备参数（如尺寸、电流），如果你在历史情报中没看到，'
        '请使用 [需填入我方具体参数] 占位，不要瞎编。\n'
        '5. 语言简洁专业，适合工程师阅读。'
    ),
}


def generate_tech_summary(api_key: str, context_data: str,
                          channel: str = "email",
                          tech_competitor: str = "",
                          tech_status: str = "",
                          tech_pain_points: list = None,
                          tech_role: list = None) -> str:
    """基于项目情报 + 四维配置，生成 Miller Heiman 体系的技术与商务融合方案摘要。"""
    client = OpenAI(api_key=api_key)

    pain_points_str = "、".join(tech_pain_points) if tech_pain_points else "未明确具体痛点"
    role_str = "、".join(tech_role) if tech_role else "未指定"

    prompt = (
        f"你是一名深谙复杂大客户销售（Miller Heiman体系）的顶级工业电气总工程师。\n"
        f"请为当前项目的特定受众，生成一份极具杀伤力的【技术与商务融合方案摘要】。\n\n"

        f"【🎯 四维制导参数】：\n"
        f"1. 沟通对象身兼的角色：{role_str}\n"
        f"2. 明确的对比友商：{tech_competitor if tech_competitor.strip() else '未指定'}"
        f" (如果指定了友商，请采取专业且隐蔽的拉踩策略，强调我们的差异化优势)\n"
        f"3. 客户当前系统现状：{tech_status if tech_status.strip() else '未提供'}\n"
        f"4. 客户核心痛点：{pain_points_str}\n\n"

        f"【输出绝对红线】：\n"
        f"1. 必须完全贴合【{role_str}】的复合视角！"
        f"如果他既是决策者又是影响者，你既要讲ROI也要讲技术合规；"
        f"如果是给「教练/内线」，要提供能直接复制用于向上级汇报的控标理由。\n"
        f"2. 针对【核心痛点】，必须提出我们方案中对应的"
        f"「特征(Feature) + 优势(Advantage) + 利益(Benefit)」！\n"
        f"3. 输出 3-4 个核心段落，拒绝罗列短句，拒绝假大空的废话。"
        f"必须像一份专业的、可直接微信转发给该角色的正式汇报摘要。\n"
        f"4. 遇到缺失的具体设备参数，严格使用 [需填入具体参数] 占位。"
    )

    # 微信渠道追加移动端格式约束
    if channel == "wechat":
        prompt += (
            "\n5. 因为最终通过微信发送，每个段落控制在 3-5 行之内，"
            "适当使用 ✅ 📊 🔧 等符号增强可读性。"
        )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"【项目历史情报】\n{context_data}"},
        ],
        temperature=0.5,
    )

    return response.choices[0].message.content


def generate_insider_ammo(api_key: str, context_data: str,
                          channel: str = "wechat",
                          target_person: str = "教练/内线",
                          project_stage: str = "初期接触",
                          leader_attitude: str = "",
                          leader_history: str = "") -> str:
    """为教练/内线一次性生成 3 种侧重点的向上管理话术。"""
    client = OpenAI(api_key=api_key)

    prompt = (
        f"你是一名深谙复杂销售博弈和职场向上管理的顶级军师。\n"
        f"请根据以下项目情报，为我们的「内线（教练）」写出 3 个不同侧重点的【内部汇报话术】。\n\n"

        f"【🎯 终极靶向：领导心理画像】：\n"
        f"你要汇报的这位最高决策者，目前的心理状态是：【{leader_attitude if leader_attitude else '未指定'}】。\n"
        f"他目前的背景轨迹是：【{leader_history if leader_history else '未指定'}】。\n"
        f"你的话术必须**极其精准地切中/利用他现在的这个心理软肋或信任基础**！\n\n"

        f"【核心原则】：\n"
        f"1. 绝对伪装：语气必须完全是「客户内部技术负责人/员工」，"
        f"用「那家全密封的厂家」称呼我们。\n"
        f"2. 极其口语化：像在微信里给老板发语音，"
        f"包装成「为公司生产安全/为老板钱包着想」。\n"
        f"3. 心理按摩：如果他怕担责，就强调我们方案的兜底能力；"
        f"如果他抠门，就强调隐性成本；"
        f"如果他有心理阴影，就利用那个阴影去打压竞品。\n"
        f"4. 遇到缺失的具体参数，严格使用 [需填入具体参数] 占位。\n\n"

        f"【必须输出以下三个版本】：\n"
        f"🎯 版本一：【痛陈利害派】（侧重：停机风险与生产安全）\n"
        f"🎯 版本二：【偷换概念派】（侧重：暗中控标与设定门槛）\n"
        f"🎯 版本三：【算总账派】（侧重：全生命周期成本 TCO）\n\n"

        f"请用清晰的 Markdown 格式分点输出这三个版本，字数要精炼！"
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"【项目历史情报】\n{context_data}"},
        ],
        temperature=0.75,
    )

    return response.choices[0].message.content


# ── 沙盘话术生成（深度打磨版） ──

# 最高指令：焊死在每次请求最前面的 System Persona
_SALES_PERSONA = (
    "【最高指令 — 你的身份】\n"
    "你是一个拥有 15 年 B2B 大客户销售经验的顶级销冠。\n"
    "深谙人性、懂权谋、懂利益交换，说话一针见血。\n"
    "你的一切输出必须基于真实商战逻辑——不说废话、不用套话模板、\n"
    "不搞'尊敬的X总您好'式官腔。\n"
    "你的目标是用最自然、最高情商的语言推进项目，扫除废标风险。\n\n"
)

_PITCH_PROMPTS = {
    "wechat_msg": (
        "【任务：微信跟进消息】\n"
        "你现在要给客户关键人发一条微信。严格遵守：\n"
        "1. 总字数 ≤ 150 字！像真人聊天，别长篇大论。\n"
        "2. 开头用一句生活化寒暄破冰（天气/行业新闻/对方近况），但不超过 20 字。\n"
        "3. 核心：针对下方【废标风险/情报盲区】中最致命的一条，\n"
        "   巧妙地抛出一个'诱饵'——比如：'我这边刚拿到一份对标数据，\n"
        "   跟你们现在选型方向高度相关，找个时间给您当面拆解一下？'\n"
        "4. 如果下方有【竞品情报】，必须侧面敲打一下客户——\n"
        "   用暗示而非直接攻击（例如：'最近听说有些友商交期承诺很激进，\n"
        "   到时候落地可能有gap...'）。\n"
        "5. 结尾必须留一个轻松的互动钩子，引导对方回复。\n"
        "6. 适当使用 emoji，像真人微信，不要感叹号满天飞。\n"
        "7. 绝对禁止：'尊敬的'、'贵司'、'不胜荣幸'等翻译腔。\n"
    ),
    "email": (
        "【任务：正式商务跟进邮件】\n"
        "你现在要写一封可以直接发送的商务邮件。严格遵守：\n"
        "1. 必须包含：邮件主题行 + 正文 + 落款。\n"
        "2. 语气：不卑不亢，专业但不冰冷，像一个自信的行业专家。\n"
        "3. 核心策略——把下方【控标点】包装成'对客户项目极其负责的技术建议'：\n"
        "   例如控标点是'预算未确认'，你要写成'为确保贵方项目顺利推进，\n"
        "   我们建议在招标前完成预算框架的初步对齐，以下是我方的参考方案...'。\n"
        "4. 竞品挖坑：从【竞品情报】中找到对手的弱点，\n"
        "   不直接点名攻击，而是在邮件中自然地提出一个'评估维度'，\n"
        "   让客户在对比时自己发现竞品的短板。\n"
        "5. 结尾必须给出一个明确的 Call-to-Action（约会议/送样/技术交流）。\n"
        "6. 绝对禁止：空洞的自卖自夸、无信息量的套话。\n"
    ),
    "internal_strategy": (
        "【任务：内部攻防作战方案】\n"
        "你现在要为销售团队输出一份冷酷、精准的内部作战方案。\n"
        "这不是给客户看的，是给自己人看的。用词要狠、准、冷酷。\n"
        "必须包含以下四个板块（Markdown 格式）：\n\n"
        "## 🎯 项目死穴诊断\n"
        "直接列出当前项目最致命的 2-3 个风险点，\n"
        "基于下方的【废标风险】和【控标点】，一针见血点出哪里可能翻车。\n\n"
        "## ⚔️ 竞品攻击路线\n"
        "基于【竞品情报】分析：对手的弱点在哪？\n"
        "哪个决策人可能已被竞品搞定？我们怎么反攻？\n"
        "给出具体的拉踩话术和差异化打法。\n\n"
        "## 🛡️ 风险规避 & 控标建议\n"
        "针对每一条废标风险，给出具体的规避措施：\n"
        "要补哪些材料？要约见谁？要怎么设置评标门槛让我方占优？\n\n"
        "## ⏰ 48 小时关键推进动作\n"
        "列出 3-5 件必须在 48 小时内完成的具体动作，\n"
        "包括：约见哪个关键人、送什么资料、安排什么局。\n"
        "如果需要请客吃饭或利益绑定，直说！这是内部文档。\n"
    ),
    "tech_solution": (
        "【任务：技术方案摘要】\n"
        "输出一份可直接发给客户技术团队的技术方案摘要。严格遵守：\n"
        "1. 强制使用 FAB 结构：Feature(特征) → Advantage(优势) → Benefit(利益)。\n"
        "2. 针对下方【控标点】设置对我方有利的评标维度和技术门槛。\n"
        "3. 用'行业常见风险'包装竞品弱点，不直接点名攻击。\n"
        "4. 缺失的具体参数，严格使用 [需填入具体参数] 占位。\n"
        "5. 用 Markdown 格式输出 3-4 个核心段落，极其严谨专业。\n"
        "6. 像一份可直接微信转发给技术负责人的正式汇报文档。\n"
    ),
}

_PITCH_TEMPERATURES = {
    "wechat_msg": 0.7,
    "email": 0.6,
    "internal_strategy": 0.5,
    "tech_solution": 0.4,
}

# ── 角色靶向精准打击策略 ──

_ROLE_STRATEGIES = {
    "决策者": (
        "\n【🎯 角色靶向：决策者】\n"
        "话术必须拔高！核心关注：\n"
        "- ROI（投资回报率）、降本增效、业务安全与政绩面子\n"
        "- 帮他规避最大的雷区，用数据和大局观征服他\n"
        "语气：自信、有分量、像一个值得信赖的行业顾问。\n"
    ),
    "使用者": (
        "\n【🛠️ 角色靶向：使用者】\n"
        "话术要接地气！核心关注：\n"
        "- 系统稳定性、操作便捷性、售后服务响应速度\n"
        "- 让他确信用我们的方案'好干活、不背锅'\n"
        "语气：务实、贴心、像一个靠谱的技术老友。\n"
    ),
    "影响者": (
        "\n【⚖️ 角色靶向：影响者】\n"
        "话术要体现专业压制！核心关注：\n"
        "- 参数壁垒、合规性、技术先进性\n"
        "- 用我们的'控标点'给他提供打击竞品的武器弹药\n"
        "语气：严谨、专业、充满技术优越感。\n"
    ),
    "教练/内线": (
        "\n【🕵️ 角色靶向：教练/内线】\n"
        "话术要像自己人！核心关注：\n"
        "- 内部政治格局、个人私交、利益绑定\n"
        "- 提供能让他去向上级邀功的控标素材，或刺探竞品的致命情报\n"
        "语气：极其亲密、口语化、像微信私聊兄弟/闺蜜。\n"
    ),
}


def generate_sales_pitch(api_key: str, context_data: str,
                         pitch_type: str = "wechat_msg",
                         target_role: str = "",
                         llm_configs: dict | None = None) -> str:
    """
    基于项目沙盘情报动态生成实战话术。
    pitch_type: wechat_msg | email | internal_strategy | tech_solution
    target_role: 决策者 | 使用者 | 影响者 | 教练/内线 | ""(不限定)
    context_data: 序列化后的项目全量情报文本（含优先级链注入）。
    llm_configs: 前端传入的动态 LLM 路由配置（可选）。
    """
    # 焊死 persona + 任务指令
    system_prompt = _SALES_PERSONA + _PITCH_PROMPTS.get(
        pitch_type, _PITCH_PROMPTS["wechat_msg"]
    )

    # 角色靶向注入（第二顺位）
    if target_role and target_role in _ROLE_STRATEGIES:
        system_prompt += _ROLE_STRATEGIES[target_role]

    temperature = _PITCH_TEMPERATURES.get(pitch_type, 0.6)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"【项目沙盘情报 — 全量注入】\n{context_data}"},
    ]

    # 使用 GlobalLLMRouter 高可用路由
    router = build_llm_router(primary_api_key=api_key, llm_configs=llm_configs)
    return router.chat(messages=messages, temperature=temperature)


def transcribe_audio(api_key: str, audio_bytes: bytes) -> str:
    """使用 OpenAI Whisper API 将音频转为文字。"""
    import tempfile, os
    client = OpenAI(api_key=api_key)

    # 写入临时文件供 API 读取
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        tmp.write(audio_bytes)
        tmp.close()
        with open(tmp.name, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="zh",
            )
        return transcript.text
    finally:
        os.unlink(tmp.name)
