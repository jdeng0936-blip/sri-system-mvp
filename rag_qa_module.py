"""
RAG 智能问答模块 V2 - 高低压电气行业专用
支持双轨大模型生成：明线（客户回复）+ 暗线（战术护目镜）
"""
import time
import os
from typing import List, Dict, Optional
import openai


# ═══════════════════════════════════════════════════════════════
# 行业专用 System Prompts
# ═══════════════════════════════════════════════════════════════

CLIENT_SYSTEM_PROMPT = """你是专业的高低压电气设备方案专家，服务于一线销售的现场技术答疑。

你的任务是根据提供的技术文档（型式试验报告、选型手册、温升测试、燃弧记录等），用官方、可信、专业的口吻回答客户提问。

回答规范：
1. 严格基于提供的参考资料回答，不编造数据
2. 如果参考资料中包含视频/音频转录记录，请明确提及"根据我们的实测记录显示..."
3. 引用具体的文档来源（使用[文档X]标注）
4. 涉及温升、分断、短路等关键参数时，务必精确引用数值和对应国标
5. 回答结构：先给出核心结论 → 详细技术数据 → 标注信息来源
6. 语气自信、专业，体现行业权威感
7. 适当使用"经第三方权威检测"、"符合GB/T XXXX标准"等增信话术"""

TACTICAL_SYSTEM_PROMPT = """你是顶级 B2B 工业品销售战术教练（Miller Heiman 方法论风格）。

你需要基于客户刚刚关于高低压电气/配电柜参数的提问，以及内部检索到的技术资料，向销售人员提供犀利、可执行的战术指导。

指导风格：
- 快速识别客户所处的购买决策阶段（需求确认/方案评估/商务谈判）
- 警惕客户比价信号，提示竞品可能动向
- 引导销售展示核心差异化优势（如智能化专利、独有的温升控制技术）
- 提供报价底线和利润保护策略
- 语气犀利、直接，像球场教练在暂停时的战术部署

输出格式（不超过150字）：
🎯 **客户关注点：** 一句话精准判断
⚠️ **潜在风险：** 竞品/丢单风险提示
💡 **话术建议：** 1-2句可直接使用的应对话术
💰 **报价策略：** 定价/让利/增值策略"""


# ═══════════════════════════════════════════════════════════════
# 上下文构建工具
# ═══════════════════════════════════════════════════════════════

def build_context_str(retrieved_docs: List[Dict], max_length: int = 3000) -> str:
    """将检索到的文档碎片合并为上下文字符串"""
    context_parts = []
    for i, doc in enumerate(retrieved_docs[:5], 1):
        content = doc.get('content', '')
        filename = doc.get('filename', '未知')
        source_type = doc.get('metadata', {}).get('source_type', 'document')
        
        # 标注来源类型
        type_label = ""
        if source_type == "video":
            type_label = "（🎬 视频转录）"
        elif source_type == "audio":
            type_label = "（🎙️ 音频转录）"
        
        if len(content) > 500:
            content = content[:500] + "..."
        
        context_parts.append(f"[文档{i}] {filename}{type_label}\n{content}")
    
    context = "\n\n".join(context_parts)
    if len(context) > max_length:
        context = context[:max_length] + "..."
    return context


# ═══════════════════════════════════════════════════════════════
# 明线：客户回复生成（流式 + 非流式 + Mock）
# ═══════════════════════════════════════════════════════════════

def generate_rag_answer(
    query: str,
    retrieved_docs: List[Dict],
    api_key: str,
    model: str = "gpt-4o-mini",
    max_context_length: int = 3000
) -> Dict:
    """非流式生成 RAG 答案（备用回退）"""
    try:
        context = build_context_str(retrieved_docs, max_context_length)
        
        user_prompt = f"""客户问题：
{query}

可参考的技术文档：
{context}

请根据以上文档回答客户的问题。如果文档中没有相关信息，请诚实说明。"""

        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": CLIENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        answer = response.choices[0].message.content
        sources = [
            {"index": i, "filename": doc.get('filename', '未知'),
             "asset_type": doc.get('metadata', {}).get('asset_type', '未分类'),
             "similarity": doc.get('similarity', 0)}
            for i, doc in enumerate(retrieved_docs[:5], 1)
        ]
        
        return {
            "success": True,
            "answer": answer,
            "sources": sources,
            "context_length": len(context),
            "model": model
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "answer": f"抱歉，生成答案时出现错误：{str(e)}"
        }


def generate_rag_answer_stream(
    query: str,
    retrieved_docs: List[Dict],
    api_key: str,
    model: str = "gpt-4o-mini",
    max_context_length: int = 3000
):
    """流式生成 RAG 答案（主力路径）"""
    try:
        context = build_context_str(retrieved_docs, max_context_length)
        
        user_prompt = f"""客户问题：
{query}

可参考的技术文档：
{context}

请根据以上文档回答客户的问题。"""

        client = openai.OpenAI(api_key=api_key)
        stream = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": CLIENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1000,
            stream=True
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
                
    except Exception as e:
        yield f"\n\n⚠️ 生成答案时出错：{str(e)}"


def mock_stream_client_response(query: str, retrieved_docs: List[Dict]):
    """
    高质量 Mock 流式客户回复生成器（无 API Key 时使用）
    模拟打字机效果，基于检索文档生成专业回答
    """
    # 构建文档引用信息
    doc_refs = []
    doc_details = []
    for i, doc in enumerate(retrieved_docs[:3], 1):
        filename = doc.get('filename', '技术文档')
        content = doc.get('content', '')[:200]
        source_type = doc.get('metadata', {}).get('source_type', 'document')
        doc_refs.append(f"[文档{i}]《{filename}》")
        
        if source_type in ('video', 'audio'):
            doc_details.append(
                f"\n\n**根据我们的实测记录显示** {doc_refs[-1]}：\n"
                f"> {content[:150]}..."
            )
        else:
            doc_details.append(
                f"\n\n**参考** {doc_refs[-1]}：\n"
                f"> {content[:150]}..."
            )
    
    # 构建回答
    ref_str = "、".join(doc_refs) if doc_refs else "内部技术资料"
    has_media = any(
        d.get('metadata', {}).get('source_type') in ('video', 'audio')
        for d in retrieved_docs[:3]
    )
    
    if doc_refs:
        response_parts = [
            f"感谢您的提问。基于我方 {ref_str} 的技术资料，为您做如下专业回复：\n",
            f"\n### 🔬 核心技术指标\n",
        ]
        if has_media:
            response_parts.append("根据我们的实测记录显示，产品各项性能参数均符合国家标准要求。")
        else:
            response_parts.append("根据第三方权威检测报告，产品各项性能参数均符合国家标准要求。")
        
        for detail in doc_details:
            response_parts.append(detail)
        
        response_parts.extend([
            "\n\n### ✅ 结论与建议\n",
            "综上所述，我方产品在该技术维度具备行业领先的竞争力。",
            f" 如需更详细的技术参数或现场演示，我们的技术团队随时可以安排。",
            f"\n\n> 📚 *以上信息来源：{ref_str}*"
        ])
    else:
        response_parts = [
            f"感谢您关于「{query}」的提问。\n\n",
            "我们的技术团队将从以下几个维度为您提供专业支持：\n\n",
            "1. **技术参数层面** — 完整的产品规格书和第三方性能测试报告\n",
            "2. **成功案例层面** — 类似工况下的实际运行数据和客户反馈\n",
            "3. **方案定制层面** — 针对贵司具体需求的技术方案初稿\n\n",
            "> 🎯 我们的技术专家将在会后24小时内，为您提供定制化的技术支持包。"
        ]
    
    # 逐段流式输出（模拟打字机效果）
    for part in response_parts:
        # 按字符输出，模拟流式
        words = list(part)
        chunk_size = 3  # 每次输出3个字符
        for i in range(0, len(words), chunk_size):
            yield "".join(words[i:i+chunk_size])
            time.sleep(0.02)


# ═══════════════════════════════════════════════════════════════
# 暗线：战术护目镜生成（LLM + 关键词模板 + Mock 流式）
# ═══════════════════════════════════════════════════════════════

def generate_tactical_advice(
    query: str,
    retrieved_docs: List[Dict],
    api_key: str = None,
    model: str = "gpt-4o-mini"
) -> str:
    """生成内部销售战术指导（Miller Heiman 风格）"""
    # 构建文档摘要
    doc_names = []
    doc_summaries = []
    for doc in retrieved_docs[:3]:
        filename = doc.get('filename', '未知')
        content = doc.get('content', '')[:200]
        doc_summaries.append(f"- {filename}: {content}")
        doc_names.append(filename)
    context = "\n".join(doc_summaries) if doc_summaries else "（武器库无相关文档）"

    # 有 API Key → LLM 生成
    if api_key and api_key.strip() and len(api_key) > 10:
        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": TACTICAL_SYSTEM_PROMPT},
                    {"role": "user", "content": f"客户问：「{query}」\n\n我方文档：\n{context}"}
                ],
                temperature=0.7,
                max_tokens=300
            )
            return response.choices[0].message.content
        except Exception:
            pass

    # 无 API Key → 关键词智能模板
    return _keyword_tactical_fallback(query, doc_names)


def mock_stream_tactical_advice(query: str, retrieved_docs: List[Dict]):
    """流式 Mock 战术护目镜生成器"""
    advice = _keyword_tactical_fallback(
        query,
        [d.get('filename', '未知') for d in retrieved_docs[:3]]
    )
    # 逐行流式输出
    for line in advice.split("\n"):
        yield line + "\n"
        time.sleep(0.05)


def _keyword_tactical_fallback(query: str, doc_names: List[str]) -> str:
    """关键词驱动的战术模板（无 API Key 降级方案）"""
    query_lower = query.lower()
    tactics = [
        (["盐雾", "防腐", "耐蚀", "腐蚀", "salt", "corrosion"],
         "防腐性能与耐久性指标", "客户可能在横向对比竞品盐雾数据",
         "强调我方盐雾测试报告（第三方权威认证），引导展示实际工况案例",
         "防腐是核心卖点，报价可适当坚挺"),
        (["价格", "报价", "成本", "预算", "price", "cost", "tco"],
         "价格敏感度高，进入成本博弈", "客户可能已有竞品低价方案",
         "转向TCO（总拥有成本）分析，强调维护周期和寿命优势",
         "可提供阶梯报价或增值服务包"),
        (["案例", "项目", "应用", "工厂", "炼化", "case", "reference", "success"],
         "希望看实际落地案例作为决策依据", "缺乏同行业案例可能成为丢单因素",
         "立即展示同行业标杆项目，突出运行时长和零故障记录",
         "案例驱动型客户决策快，推快签约节奏"),
        (["参数", "规格", "厚度", "附着力", "性能", "spec", "performance"],
         "正在技术选型，关注具体性能参数", "技术细节不充分可能导致选型出局",
         "提供完整规格书，主动对比行标，展示技术领先点",
         "技术驱动型客户价格敏感度低"),
        (["交期", "工期", "施工", "delivery", "schedule"],
         "项目时间节点压力大", "交期不满足可能直接出局",
         "展示供应链实力和项目管理能力，提供交付计划",
         "急单可上浮5-10%，提供加急服务"),
        (["温升", "temperature", "heat", "temp", "发热"],
         "关注设备散热能力与长期可靠性", "温升不达标是硬伤，客户可能拿此淘汰竞品",
         "主动展示温升试验报告，强调优于GB/T 11022标准限值",
         "温升合规是准入门槛，报价不必让步"),
        (["分断", "短路", "断路器", "breaking", "short circuit", "燃弧"],
         "评估设备极限工况下的安全性", "分断不达标直接淘汰，无谈判余地",
         "展示型式试验报告，强调31.5kA/80kA的极限分断数据",
         "安全性卖点，客户愿为此支付溢价"),
        (["智能", "物联", "监控", "远程", "iot", "smart", "无人值守"],
         "关注智能化升级与运维降本", "竞品可能已有物联方案报价",
         "展示我方智能化专利和远程运维平台demos",
         "智能模块毛利高，可打包定价"),
    ]

    matched = None
    for keywords, focus, risk, talk, price in tactics:
        if any(kw in query_lower for kw in keywords):
            matched = (focus, risk, talk, price)
            break

    if not matched:
        doc_ref = f"引导客户查看{'、'.join(doc_names)}中的实测数据" if doc_names else "建议上传更多技术资料以增强回答精度"
        matched = ("客户关注的具体技术细节", "需确认客户是否处于选型比较阶段",
                   doc_ref, "利润空间充足，若客户犹豫可承诺增值服务")

    return (
        f"🎯 **客户关注点：** {matched[0]}\n\n"
        f"⚠️ **潜在风险：** {matched[1]}\n\n"
        f"💡 **话术建议：** {matched[2]}\n\n"
        f"💰 **报价策略：** {matched[3]}"
    )


# ═══════════════════════════════════════════════════════════════
# 引用来源格式化
# ═══════════════════════════════════════════════════════════════

def format_sources(sources: List[Dict]) -> str:
    """格式化引用来源"""
    if not sources:
        return ""
    
    lines = ["### 📚 参考来源\n"]
    for i, source in enumerate(sources, 1):
        similarity = source.get('similarity', source.get('score', 0))
        similarity_bar = "🟢" if similarity > 0.8 else "🟡" if similarity > 0.5 else "🔴"
        idx = source.get('index', i)
        filename = source.get('filename', '未知')
        asset_type = source.get('asset_type', source.get('metadata', {}).get('asset_type', '未分类'))
        lines.append(
            f"{similarity_bar} **[文档{idx}]** {filename} "
            f"({asset_type})"
        )
    
    return "\n".join(lines)


if __name__ == "__main__":
    print("RAG 智能问答模块 V2 已加载 — 电气行业专用版")
    
    test_docs = [
        {
            "filename": "温升试验报告.pdf",
            "content": "开关柜额定电流4000A下持续运行8小时，母排温升62K（限值70K）",
            "metadata": {"asset_type": "🏛️ [背书] 权威背书", "source_type": "document"},
            "similarity": 0.92
        },
        {
            "filename": "燃弧测试.mp4",
            "content": "[视频转录] 10kV真空断路器内部燃弧试验，分断电流31.5kA",
            "metadata": {"asset_type": "🎯 [标准] 选型排雷", "source_type": "video"},
            "similarity": 0.85
        }
    ]
    
    # 测试 context 构建
    ctx = build_context_str(test_docs)
    print(f"\n上下文构建: {len(ctx)}字")
    
    # 测试 mock 流式
    print("\n--- Mock 流式客户回复 ---")
    for chunk in mock_stream_client_response("温升性能如何？", test_docs):
        print(chunk, end="", flush=True)
    print("\n\n--- 战术模板 ---")
    print(generate_tactical_advice("温升性能如何？", test_docs))
