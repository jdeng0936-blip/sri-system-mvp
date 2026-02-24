"""
隐私脱敏引擎 — utils/security.py
=================================
移植自原版 app.py:187-193，完整保留所有正则规则。
原则：原文存库（内网可见），发往云端 LLM 的一律脱敏。
"""

import hashlib
import json
import re
from typing import Any


# ═══════════════════════════════════════════
# 1. 隐私脱敏函数（原版全量保留）
# ═══════════════════════════════════════════

def mask_sensitive_info(text: str) -> str:
    """
    对文本进行本地隐私脱敏：手机号 & 金额。
    ── 原版规则 100% 保留 ──
    规则 1：11 位连续数字（手机号） → [PHONE_MASK]
    规则 2：数字+万/元（金额）       → [MONEY_MASK]
    """
    if not text:
        return text
    # 规则 1：11 位手机号（兼容中文上下文，\b 对 CJK 字符无效）
    text = re.sub(r"(?<!\d)1[3-9]\d{9}(?!\d)", "[PHONE_MASK]", text)
    # 规则 2：数字+万/元（金额）
    text = re.sub(r"\d+(\.\d+)?\s*[万元]", "[MONEY_MASK]", text)
    return text


# ═══════════════════════════════════════════
# 2. 防篡改哈希计算
# ═══════════════════════════════════════════

def compute_bom_hash(bom_items: list[dict[str, Any]]) -> str:
    """
    基于 BOM 明细列表计算 SHA-256 防篡改哈希。
    用于 DealDesk / Contract 的天眼引擎比对。

    Args:
        bom_items: 结构示例 [{"model": "XGN15", "qty": 10, "price": 15000}, ...]

    Returns:
        SHA-256 hex digest
    """
    # 排序确保字段顺序一致性
    normalized = sorted(
        [{"model": str(i.get("model", "")),
          "qty": int(i.get("qty", 0)),
          "price": float(i.get("price", 0))}
         for i in bom_items],
        key=lambda x: x["model"]
    )
    payload = json.dumps(normalized, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_bom_integrity(current_bom: list[dict], stored_hash: str) -> tuple[bool, str]:
    """
    天眼引擎：验证前端提交的 BOM 是否与数据库底单一致。

    Returns:
        (is_valid, diff_summary)
        - is_valid=True :  哈希一致，未被篡改
        - is_valid=False:  哈希异动，返回变更摘要
    """
    current_hash = compute_bom_hash(current_bom)
    if current_hash == stored_hash:
        return True, ""
    return False, (
        "🚨 天眼侦测到该报价单已被修改！"
        f"原始哈希: {stored_hash[:12]}... → 当前哈希: {current_hash[:12]}..."
    )


# ═══════════════════════════════════════════
# 3. 密码哈希（用户认证）
# ═══════════════════════════════════════════

def hash_password(password: str) -> str:
    """SHA-256 密码哈希（生产环境建议替换为 bcrypt）。"""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    """校验明文密码与哈希是否匹配。"""
    return hash_password(plain) == hashed
