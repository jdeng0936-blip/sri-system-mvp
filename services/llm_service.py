"""
企业级 LLM 路由网关 — services/llm_service.py
================================================
LLMOps 级别的"模型路由网关 (AI Gateway)"：
  1. AITask 场景枚举            → 按任务类型路由到最优模型
  2. ModelRegistry 动态注册表    → 可通过前端/DB 配置覆盖
  3. 5 级回退防线               → 精准异常捕获与无缝降级
  4. AuditLog 审计日志          → 记录每次调用的模型/耗时/结果

注意：保留原版 llm_service.py 为旧版兼容层，本文件为新架构。
"""

import enum
import json
import logging
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import openai
from openai import OpenAI

logger = logging.getLogger("llm_gateway")
logger.setLevel(logging.DEBUG)

# ANSI 颜色常量
_YELLOW = "\033[93m"
_RED = "\033[91m"
_GREEN = "\033[92m"
_CYAN = "\033[96m"
_RESET = "\033[0m"
_BOLD = "\033[1m"


# ═══════════════════════════════════════════
# 1. 场景化任务枚举 (Task-Specific Routing)
# ═══════════════════════════════════════════

class AITask(str, enum.Enum):
    """
    AI 场景枚举 — 不同场景路由到不同的模型组合。
    每个场景有独立的首选模型、温度、最大 token。
    """
    FAST_EXTRACT = "fast_extract"
    """快速提取 (情报解析/询报价/BOM提取)
       特点：低延迟优先，允许轻量模型"""

    HEAVY_STRATEGY = "heavy_strategy"
    """重度策略 (NBA报告/护目镜/话术生成/权力图谱)
       特点：高质量优先，使用最强满血模型"""

    VISION_PARSE = "vision_parse"
    """视觉解析 (图片情报/名片/现场照片)
       特点：必须使用多模态 Vision 模型"""

    CODE_GEN = "code_gen"
    """代码生成 (Mermaid图谱/流程图/JSON结构化)
       特点：需要强逻辑推理能力"""

    QUIZ_CRITIQUE = "quiz_critique"
    """伴学中心 (出题/评分/盲点分析)
       特点：中等复杂度，平衡速度与质量"""

    SOS_BRIEF = "sos_brief"
    """SOS求援摘要 (现场紧急，需极速响应)
       特点：最低延迟，简短回复"""

    GENERAL_CHAT = "general_chat"
    """通用对话 (军师对话/周报/复盘)"""


# ═══════════════════════════════════════════
# 2. 模型提供商配置
# ═══════════════════════════════════════════

@dataclass
class LLMProvider:
    """单个 LLM 提供商配置。"""
    name: str           # "OpenAI" / "Google Gemini" / "Anthropic" / "xAI" / "Local"
    model: str          # 具体模型版本号
    base_url: str       # API endpoint
    api_key: str        # 动态传入
    timeout: int = 30   # 超时秒数
    supports_vision: bool = False  # 是否支持多模态


@dataclass
class AuditEntry:
    """模型调用审计日志条目。"""
    task: str
    provider: str
    model: str
    success: bool
    latency_ms: int
    error: Optional[str] = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()


# ═══════════════════════════════════════════
# 3. 动态模型注册表 (ModelRegistry)
# ═══════════════════════════════════════════

# 默认的 场景 → (首选模型版本, 回退模型版本, 温度, max_tokens) 映射
DEFAULT_MODEL_REGISTRY: dict[AITask, dict] = {
    AITask.FAST_EXTRACT: {
        "openai": "gpt-4o-mini",
        "gemini": "gemini-2.0-flash",
        "anthropic": "claude-3-5-haiku-20241022",
        "xai": "grok-3-mini",
        "local": "deepseek-r1",
        "temperature": 0.1,
        "max_tokens": 4096,
    },
    AITask.HEAVY_STRATEGY: {
        "openai": "gpt-4o",
        "gemini": "gemini-2.5-pro-preview-05-06",
        "anthropic": "claude-sonnet-4-20250514",
        "xai": "grok-3",
        "local": "deepseek-r1",
        "temperature": 0.6,
        "max_tokens": 8192,
    },
    AITask.VISION_PARSE: {
        "openai": "gpt-4o",
        "gemini": "gemini-2.0-flash",
        "anthropic": "claude-sonnet-4-20250514",
        "xai": "grok-3",
        "local": "deepseek-r1",
        "temperature": 0.2,
        "max_tokens": 4096,
    },
    AITask.CODE_GEN: {
        "openai": "gpt-4o",
        "gemini": "gemini-2.5-pro-preview-05-06",
        "anthropic": "claude-sonnet-4-20250514",
        "xai": "grok-3",
        "local": "deepseek-r1",
        "temperature": 0.3,
        "max_tokens": 4096,
    },
    AITask.QUIZ_CRITIQUE: {
        "openai": "gpt-4o-mini",
        "gemini": "gemini-2.0-flash",
        "anthropic": "claude-3-5-haiku-20241022",
        "xai": "grok-3-mini",
        "local": "deepseek-r1",
        "temperature": 0.5,
        "max_tokens": 4096,
    },
    AITask.SOS_BRIEF: {
        "openai": "gpt-4o-mini",
        "gemini": "gemini-2.0-flash",
        "anthropic": "claude-3-5-haiku-20241022",
        "xai": "grok-3-mini",
        "local": "deepseek-r1",
        "temperature": 0.7,
        "max_tokens": 2048,
    },
    AITask.GENERAL_CHAT: {
        "openai": "gpt-4o",
        "gemini": "gemini-2.0-flash",
        "anthropic": "claude-sonnet-4-20250514",
        "xai": "grok-3",
        "local": "deepseek-r1",
        "temperature": 0.6,
        "max_tokens": 4096,
    },
}

# Provider 名称 → 注册表 key 的映射
_PROVIDER_KEY_MAP = {
    "OpenAI": "openai",
    "Google Gemini": "gemini",
    "Anthropic": "anthropic",
    "xAI Grok": "xai",
    "Local DeepSeek": "local",
}


# ═══════════════════════════════════════════
# 4. 企业级全局路由器
# ═══════════════════════════════════════════

class AIGateway:
    """
    企业级 LLM 路由网关 (AI Gateway)
    ─────────────────────────────────
    核心能力：
    1. 场景自适应路由  — 不同 AITask 自动选择最优模型版本
    2. 5 级回退防线    — OpenAI → Gemini → Anthropic → xAI → Local
    3. 动态配置覆盖    — 前端/DB 传入 model_overrides 可覆盖默认选择
    4. 审计日志        — 每次调用记录 provider/model/延迟/成败
    """

    def __init__(
        self,
        providers: list[LLMProvider],
        model_registry: dict[AITask, dict] | None = None,
    ):
        self.providers = providers
        self.registry = model_registry or DEFAULT_MODEL_REGISTRY.copy()
        self.audit_log: list[AuditEntry] = []

    # ─────────────────────────────────────
    # 核心：场景感知的智能调用
    # ─────────────────────────────────────

    def chat(
        self,
        messages: list[dict],
        task: AITask = AITask.GENERAL_CHAT,
        temperature: float | None = None,
        model_overrides: dict | None = None,
        **kwargs,
    ) -> str:
        """
        统一调用入口 — 场景感知 + 自动回退。

        Args:
            messages:        标准 OpenAI messages 格式
            task:            AI 场景枚举，决定首选模型
            temperature:     覆盖默认温度 (None = 使用注册表默认)
            model_overrides: 动态覆盖 {"openai": "gpt-4o", "gemini": "..."}
                             前端设置页面或 DB 配置可传入

        Returns:
            AI 生成的文本内容

        Raises:
            RuntimeError: 全部防线失败
        """
        # 读取该场景的注册表配置
        task_config = self.registry.get(task, self.registry[AITask.GENERAL_CHAT])
        temp = temperature if temperature is not None else task_config.get("temperature", 0.6)

        # 合并动态覆盖（前端/DB 配置 > 注册表默认）
        overrides = model_overrides or {}

        errors: list[str] = []
        active_providers = [p for p in self.providers if p.api_key]
        total = len(active_providers)

        for idx, provider in enumerate(active_providers, 1):
            # 根据场景 + 覆盖确定该 provider 使用的模型版本
            provider_key = _PROVIDER_KEY_MAP.get(provider.name, "openai")
            model = (
                overrides.get(provider_key)                      # 优先：动态覆盖
                or task_config.get(provider_key)                 # 其次：注册表场景配置
                or provider.model                                # 兜底：provider 默认
            )

            start_time = time.monotonic()

            try:
                print(
                    f"{_CYAN}{_BOLD}🔗 [{idx}/{total}] "
                    f"[{task.value}] 尝试 {provider.name} ({model})...{_RESET}",
                    file=sys.stderr,
                )

                content = self._call_provider(provider, model, messages, temp)

                elapsed_ms = int((time.monotonic() - start_time) * 1000)
                print(
                    f"{_GREEN}{_BOLD}✅ {provider.name} ({model}) "
                    f"命中成功！耗时 {elapsed_ms}ms{_RESET}",
                    file=sys.stderr,
                )

                # 审计日志
                self.audit_log.append(AuditEntry(
                    task=task.value, provider=provider.name,
                    model=model, success=True, latency_ms=elapsed_ms,
                ))

                return content

            except openai.AuthenticationError as e:
                msg = f"[{provider.name}] 🔑 AuthError (401): Key 无效"
                errors.append(msg)
                self._log_fallback(provider, model, "AuthError", e, start_time, task)
                continue

            except openai.RateLimitError as e:
                msg = f"[{provider.name}] 🚦 RateLimit (429): 触发限流"
                errors.append(msg)
                self._log_fallback(provider, model, "RateLimit", e, start_time, task)
                continue

            except openai.APITimeoutError as e:
                msg = f"[{provider.name}] ⏱️ Timeout ({provider.timeout}s)"
                errors.append(msg)
                self._log_fallback(provider, model, "Timeout", e, start_time, task)
                continue

            except (openai.APIConnectionError, openai.InternalServerError) as e:
                msg = f"[{provider.name}] 💥 {type(e).__name__}: 服务异常"
                errors.append(msg)
                self._log_fallback(provider, model, type(e).__name__, e, start_time, task)
                continue

            except openai.BadRequestError as e:
                msg = f"[{provider.name}] ⚠️ BadRequest (400): {e}"
                errors.append(msg)
                self._log_fallback(provider, model, "BadRequest", e, start_time, task)
                continue

            except Exception as e:
                msg = f"[{provider.name}] ❓ {type(e).__name__}: {e}"
                errors.append(msg)
                self._log_fallback(provider, model, type(e).__name__, e, start_time, task)
                continue

        # 全部失败
        error_detail = "\n".join(errors)
        print(
            f"{_RED}{_BOLD}🚨 所有 LLM 防线均已失败 (task={task.value})！"
            f"\n{error_detail}{_RESET}",
            file=sys.stderr,
        )
        raise RuntimeError(f"所有 LLM 防线均已失败:\n{error_detail}")

    # ─────────────────────────────────────
    # 内部：实际调用 Provider
    # ─────────────────────────────────────

    def _call_provider(
        self,
        provider: LLMProvider,
        model: str,
        messages: list[dict],
        temperature: float,
    ) -> str:
        """
        实际调用 LLM Provider。
        Anthropic 使用原生 SDK，其余走 OpenAI 兼容层。
        """
        if provider.name == "Anthropic":
            return self._call_anthropic(provider, model, messages, temperature)
        else:
            client = OpenAI(
                api_key=provider.api_key,
                base_url=provider.base_url,
                timeout=provider.timeout,
            )
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
            )
            return response.choices[0].message.content

    def _call_anthropic(
        self,
        provider: LLMProvider,
        model: str,
        messages: list[dict],
        temperature: float,
    ) -> str:
        """Anthropic 原生 SDK 调用（消息格式转换）。"""
        import anthropic
        client = anthropic.Anthropic(
            api_key=provider.api_key,
            timeout=provider.timeout,
        )
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
            "model": model,
            "max_tokens": 4096,
            "messages": user_msgs,
            "temperature": temperature,
        }
        if system_text.strip():
            create_kwargs["system"] = system_text.strip()

        response = client.messages.create(**create_kwargs)
        return response.content[0].text

    # ─────────────────────────────────────
    # 内部：回退日志
    # ─────────────────────────────────────

    def _log_fallback(
        self,
        provider: LLMProvider,
        model: str,
        error_type: str,
        error: Exception,
        start_time: float,
        task: AITask,
    ):
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        print(
            f"{_YELLOW}{_BOLD}⚠️ {provider.name} ({model}) "
            f"{error_type}，耗时 {elapsed_ms}ms，"
            f"切换至下一防线...{_RESET}",
            file=sys.stderr,
        )
        logger.warning(
            "LLM fallback | task=%s provider=%s model=%s error=%s latency=%dms",
            task.value, provider.name, model, error_type, elapsed_ms,
        )
        self.audit_log.append(AuditEntry(
            task=task.value, provider=provider.name,
            model=model, success=False, latency_ms=elapsed_ms,
            error=f"{error_type}: {str(error)[:200]}",
        ))

    # ─────────────────────────────────────
    # 审计日志查询
    # ─────────────────────────────────────

    def get_audit_log(self, last_n: int = 50) -> list[dict]:
        """获取最近 N 条审计日志。"""
        entries = self.audit_log[-last_n:]
        return [
            {
                "task": e.task,
                "provider": e.provider,
                "model": e.model,
                "success": e.success,
                "latency_ms": e.latency_ms,
                "error": e.error,
                "timestamp": e.timestamp,
            }
            for e in entries
        ]

    def get_stats(self) -> dict:
        """获取调用统计摘要。"""
        total = len(self.audit_log)
        success = sum(1 for e in self.audit_log if e.success)
        by_provider: dict[str, dict] = {}
        for e in self.audit_log:
            if e.provider not in by_provider:
                by_provider[e.provider] = {"total": 0, "success": 0, "avg_ms": 0, "latencies": []}
            by_provider[e.provider]["total"] += 1
            if e.success:
                by_provider[e.provider]["success"] += 1
            by_provider[e.provider]["latencies"].append(e.latency_ms)

        for stats in by_provider.values():
            lats = stats.pop("latencies")
            stats["avg_ms"] = int(sum(lats) / len(lats)) if lats else 0

        return {
            "total_calls": total,
            "success_rate": f"{(success / total * 100):.1f}%" if total > 0 else "N/A",
            "by_provider": by_provider,
        }


# ═══════════════════════════════════════════
# 5. 网关工厂函数
# ═══════════════════════════════════════════

def build_ai_gateway(
    primary_api_key: str = "",
    llm_configs: dict | None = None,
    model_overrides: dict[str, dict] | None = None,
) -> AIGateway:
    """
    构建 AIGateway 实例。

    Args:
        primary_api_key: 主 API Key (向后兼容)
        llm_configs:     前端设置的完整 LLM 配置 (含各 provider 的 key/model/enabled)
        model_overrides: 场景级模型覆盖 {"fast_extract": {"openai": "gpt-4o"}, ...}

    Returns:
        AIGateway 实例
    """
    cfg = llm_configs or {}

    def _get(provider_key: str, field_name: str, default: str) -> str:
        return cfg.get(provider_key, {}).get(field_name, "") or default

    def _enabled(provider_key: str, default: bool) -> bool:
        p = cfg.get(provider_key, {})
        if isinstance(p, dict) and "enabled" in p:
            return bool(p["enabled"])
        return default

    providers: list[LLMProvider] = []

    # ── 第一防线: OpenAI ──
    if _enabled("openai", True):
        key = _get("openai", "apiKey", primary_api_key)
        if key:
            providers.append(LLMProvider(
                name="OpenAI",
                model=_get("openai", "model", "gpt-4o-mini"),
                base_url=_get("openai", "baseUrl", "https://api.openai.com/v1"),
                api_key=key,
                timeout=30,
                supports_vision=True,
            ))

    # ── 第二防线: Google Gemini ──
    if _enabled("gemini", False):
        key = _get("gemini", "apiKey", "")
        if key:
            providers.append(LLMProvider(
                name="Google Gemini",
                model=_get("gemini", "model", "gemini-2.0-flash"),
                base_url=_get("gemini", "baseUrl",
                              "https://generativelanguage.googleapis.com/v1beta/openai/"),
                api_key=key,
                timeout=30,
                supports_vision=True,
            ))

    # ── 第三防线: Anthropic ──
    if _enabled("anthropic", False):
        key = _get("anthropic", "apiKey", "")
        if key:
            providers.append(LLMProvider(
                name="Anthropic",
                model=_get("anthropic", "model", "claude-sonnet-4-20250514"),
                base_url=_get("anthropic", "baseUrl", "https://api.anthropic.com/v1/"),
                api_key=key,
                timeout=45,
                supports_vision=True,
            ))

    # ── 第四防线: xAI Grok ──
    if _enabled("xai", False):
        key = _get("xai", "apiKey", "")
        if key:
            providers.append(LLMProvider(
                name="xAI Grok",
                model=_get("xai", "model", "grok-3-mini"),
                base_url=_get("xai", "baseUrl", "https://api.x.ai/v1"),
                api_key=key,
                timeout=30,
                supports_vision=False,
            ))

    # ── 第五防线: Local DeepSeek ──
    if _enabled("local", bool(not providers)):
        # 仅在无云端 provider 时默认启用本地
        providers.append(LLMProvider(
            name="Local DeepSeek",
            model=_get("local", "model", "deepseek-r1"),
            base_url=_get("local", "baseUrl", "http://localhost:11434/v1"),
            api_key="local",
            timeout=120,
            supports_vision=False,
        ))

    # 构建注册表 (合并场景级覆盖)
    registry = DEFAULT_MODEL_REGISTRY.copy()
    if model_overrides:
        for task_str, overrides in model_overrides.items():
            try:
                task_enum = AITask(task_str)
                if task_enum in registry:
                    registry[task_enum] = {**registry[task_enum], **overrides}
            except ValueError:
                pass  # 忽略未知场景

    return AIGateway(providers=providers, model_registry=registry)


# ═══════════════════════════════════════════
# 6. 向后兼容层 (保持旧版 API 不中断)
# ═══════════════════════════════════════════

# 旧版别名 — 确保已有 routers/api.py 中的 build_llm_router 调用不会崩溃
GlobalLLMRouter = AIGateway

def build_llm_router(
    primary_api_key: str = "",
    llm_configs: dict | None = None,
) -> AIGateway:
    """向后兼容旧版 build_llm_router() 调用。"""
    return build_ai_gateway(primary_api_key=primary_api_key, llm_configs=llm_configs)


def _detect_llm_config(api_key: str) -> dict:
    """根据 API Key 前缀自动检测 LLM 提供商。"""
    if api_key.startswith("sk-ant-"):
        return {
            "openai": {"enabled": False},
            "anthropic": {"enabled": True, "apiKey": api_key,
                          "model": "claude-sonnet-4-20250514"},
            "local": {"enabled": False},
        }
    return {}
