# 🆘 高地四：炮火呼叫中枢实现任务

**优先级：** ⭐⭐⭐⭐（高）  
**预估时间：** 45-60分钟  
**难度：** 中等  

---

## 📖 任务背景

当前"第一现场"有一个"🆘 呼叫后方技术群"按钮，但点击后只显示假提示。

**现实场景：**
- 客户提出复杂的非标定制需求
- AI无法准确回答
- 销售需要立即联系后方技术专家

**目标：** 实现一键打包现场上下文，生成工单并推送到指定渠道。

---

## 🎯 核心需求

### 功能要求

1. **上下文打包**
   - 客户原话（问题记录）
   - 当前项目信息
   - 已有的对话历史
   - 相关文档引用

2. **工单生成**
   - 自动生成结构化工单
   - 包含时间戳、项目、优先级
   - 格式清晰易读

3. **推送渠道**（任选其一）
   - **方案A：** 保存为文件（CSV/JSON）
   - **方案B：** 发送到Telegram（如已配置）
   - **方案C：** 写入数据库待处理

4. **用户反馈**
   - 显示工单编号
   - 确认已发送
   - 提供后续追踪方式

---

## 🔧 技术规格

### 方案选择

根据现有基础设施，推荐**方案A+B组合**：
- 本地保存工单文件（确保不丢失）
- 如果有Telegram配置，同时推送消息

---

### 需要修改的文件

**1. app.py - 第一现场部分**

找到这段代码（大约在第1070行）：

```python
if st.button("🆘 呼叫后方技术群", use_container_width=True):
    st.success("✅ 已将现场痛点、客户原话打包发送至企业微信技术群！后方专家正在连线...")
```

**替换为真实逻辑：**

```python
if st.button("🆘 呼叫后方技术群", use_container_width=True):
    # 生成工单
    ticket = generate_support_ticket(
        client_query=st.session_state.get("last_client_query", ""),
        project=current_live_project,
        session_state=st.session_state
    )
    
    # 保存工单
    ticket_id = save_ticket(ticket)
    
    # 推送通知（如果配置了Telegram）
    if api_key:  # 有API密钥说明系统已配置
        send_ticket_notification(ticket, ticket_id)
    
    # 显示结果
    st.success(f"✅ 工单已生成！工单编号：#{ticket_id}")
    st.info(f"📋 已保存至：`support_tickets/{ticket_id}.json`")
    
    with st.expander("查看工单详情"):
        st.json(ticket)
```

**2. 新建文件：support_ticket.py**

创建工单处理模块：

```python
"""
炮火呼叫中枢 - 工单系统
"""
import json
import os
from datetime import datetime
from typing import Dict, Any


def generate_support_ticket(
    client_query: str,
    project: str,
    session_state: Dict
) -> Dict[str, Any]:
    """
    生成技术支持工单
    
    Args:
        client_query: 客户问题
        project: 当前项目
        session_state: 会话状态
    
    Returns:
        工单字典
    """
    timestamp = datetime.now()
    
    ticket = {
        "ticket_id": timestamp.strftime("%Y%m%d_%H%M%S"),
        "timestamp": timestamp.isoformat(),
        "priority": "高" if "紧急" in client_query or "急" in client_query else "中",
        
        "client_info": {
            "query": client_query,
            "project": project,
        },
        
        "context": {
            "conversation_history": _extract_conversation_history(session_state),
            "retrieved_documents": _extract_retrieved_docs(session_state),
        },
        
        "metadata": {
            "source": "第一现场",
            "status": "待处理",
            "assigned_to": None,
        }
    }
    
    return ticket


def _extract_conversation_history(session_state: Dict) -> list:
    """提取对话历史"""
    # 从session_state中提取最近的对话
    history = []
    
    if "messages" in session_state:
        for msg in session_state["messages"][-5:]:  # 最近5条
            history.append({
                "role": msg.get("role", "unknown"),
                "content": msg.get("content", "")[:200]  # 截取前200字符
            })
    
    return history


def _extract_retrieved_docs(session_state: Dict) -> list:
    """提取相关文档"""
    # 如果有检索结果，提取文档名
    docs = []
    
    if "last_retrieved_docs" in session_state:
        for doc in session_state["last_retrieved_docs"]:
            docs.append({
                "filename": doc.get("filename", "unknown"),
                "similarity": doc.get("similarity", 0)
            })
    
    return docs


def save_ticket(ticket: Dict) -> str:
    """
    保存工单到本地
    
    Args:
        ticket: 工单字典
    
    Returns:
        工单ID
    """
    # 创建目录
    ticket_dir = "support_tickets"
    os.makedirs(ticket_dir, exist_ok=True)
    
    # 保存为JSON
    ticket_id = ticket["ticket_id"]
    filepath = os.path.join(ticket_dir, f"{ticket_id}.json")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(ticket, f, ensure_ascii=False, indent=2)
    
    return ticket_id


def send_ticket_notification(ticket: Dict, ticket_id: str) -> bool:
    """
    发送工单通知（可选）
    
    Args:
        ticket: 工单字典
        ticket_id: 工单ID
    
    Returns:
        是否成功
    """
    try:
        # 格式化消息
        message = f"""
🆘 **技术支持请求**

📋 工单编号: #{ticket_id}
⏰ 时间: {ticket['timestamp']}
🔴 优先级: {ticket['priority']}

👤 **客户问题:**
{ticket['client_info']['query']}

📂 **项目:** {ticket['client_info']['project']}

📚 **已检索文档:** {len(ticket['context']['retrieved_documents'])} 个

⚠️ **请尽快响应！**
        """.strip()
        
        # 方案1：如果有OpenClaw的message工具，发送到Telegram
        # 这需要OpenClaw环境支持
        # from openclaw import message
        # message.send(channel="telegram", target="技术支持群", message=message)
        
        # 方案2：简单记录（当前实现）
        print(f"[通知] 工单 #{ticket_id} 已生成")
        
        return True
        
    except Exception as e:
        print(f"[错误] 发送通知失败: {e}")
        return False


def list_tickets(status: str = None) -> list:
    """
    列出所有工单
    
    Args:
        status: 状态筛选（待处理/已解决/已关闭）
    
    Returns:
        工单列表
    """
    ticket_dir = "support_tickets"
    if not os.path.exists(ticket_dir):
        return []
    
    tickets = []
    for filename in os.listdir(ticket_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(ticket_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                ticket = json.load(f)
                
                # 状态筛选
                if status is None or ticket['metadata']['status'] == status:
                    tickets.append(ticket)
    
    # 按时间倒序
    tickets.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return tickets
```

**3. 在 app.py 中导入**

在文件开头添加：

```python
from support_ticket import generate_support_ticket, save_ticket, send_ticket_notification, list_tickets
```

---

## 📋 验收标准

### 必须达到

- [ ] 点击按钮生成工单
- [ ] 工单包含客户问题
- [ ] 工单包含项目信息
- [ ] 工单保存为文件
- [ ] 显示工单编号
- [ ] 可查看工单详情

### 加分项

- [ ] 工单推送到Telegram
- [ ] 工单管理界面（查看所有工单）
- [ ] 工单状态更新
- [ ] 工单分配给技术人员

---

## 🧪 测试用例

### 测试步骤

1. **准备环境**
   - 启动应用
   - 进入"第一现场"
   - 上传一些文档到武器库

2. **模拟客户场景**
   - 客户提问："我需要一个能耐1000度高温的涂料，你们有吗？"
   - 系统回答（可能无法准确回答）

3. **呼叫后方**
   - 点击"🆘 呼叫后方技术群"按钮
   - 观察反馈信息

4. **验证工单**
   - 检查 `support_tickets/` 目录
   - 查看生成的JSON文件
   - 验证内容完整性

### 预期结果

**点击按钮后：**
```
✅ 工单已生成！工单编号：#20260215_173000

📋 已保存至：`support_tickets/20260215_173000.json`

[可展开] 查看工单详情
  {
    "ticket_id": "20260215_173000",
    "timestamp": "2026-02-15T17:30:00",
    "priority": "中",
    "client_info": {
      "query": "我需要一个能耐1000度高温的涂料，你们有吗？",
      "project": "XX炼化项目"
    },
    "context": {
      "conversation_history": [...],
      "retrieved_documents": [...]
    },
    "metadata": {
      "source": "第一现场",
      "status": "待处理"
    }
  }
```

**工单文件（support_tickets/20260215_173000.json）：**
```json
{
  "ticket_id": "20260215_173000",
  "timestamp": "2026-02-15T17:30:00.123456",
  "priority": "中",
  "client_info": {
    "query": "我需要一个能耐1000度高温的涂料，你们有吗？",
    "project": "XX炼化项目"
  },
  "context": {
    "conversation_history": [
      {
        "role": "user",
        "content": "你们的涂料耐温能力如何？"
      },
      {
        "role": "assistant",
        "content": "我们的WH-2026-A涂料耐温可达..."
      }
    ],
    "retrieved_documents": [
      {
        "filename": "产品参数.pdf",
        "similarity": 0.85
      }
    ]
  },
  "metadata": {
    "source": "第一现场",
    "status": "待处理",
    "assigned_to": null
  }
}
```

---

## ⚠️ 注意事项

### 1. 数据安全

- 工单可能包含敏感信息
- 建议设置目录权限
- 不要提交到Git（添加到.gitignore）

### 2. 存储管理

- 定期清理已处理工单
- 或移动到归档目录
- 避免积累过多文件

### 3. 通知渠道

- 如果要集成真实推送，需要配置对应API
- Telegram、钉钉、企业微信等都有API
- 当前实现先保证本地工单可用

---

## 🚀 扩展功能（可选）

### 1. 工单管理界面

在侧边栏或新标签页添加：

```python
with st.sidebar:
    st.markdown("### 🎫 工单管理")
    
    tickets = list_tickets(status="待处理")
    st.metric("待处理工单", len(tickets))
    
    if tickets:
        for ticket in tickets[:5]:  # 显示最近5个
            with st.expander(f"#{ticket['ticket_id']}"):
                st.write(f"问题: {ticket['client_info']['query'][:50]}...")
                st.write(f"优先级: {ticket['priority']}")
```

### 2. 自动分析优先级

```python
def analyze_priority(query: str) -> str:
    """基于关键词分析优先级"""
    urgent_keywords = ["紧急", "急", "马上", "立即", "ASAP"]
    high_keywords = ["重要", "大客户", "投标"]
    
    if any(kw in query for kw in urgent_keywords):
        return "紧急"
    elif any(kw in query for kw in high_keywords):
        return "高"
    else:
        return "中"
```

### 3. 智能推荐专家

```python
def recommend_expert(query: str) -> str:
    """根据问题推荐专家"""
    if "化工" in query or "防腐" in query:
        return "李工（防腐专家）"
    elif "高温" in query:
        return "王工（耐高温材料）"
    else:
        return "技术组长"
```

---

## ✅ 完成标志

提交以下内容即表示任务完成：

1. **新建文件**
   - `support_ticket.py` - 工单处理模块

2. **修改文件**
   - `app.py` - 集成工单生成

3. **测试结果**
   - 生成的工单JSON文件
   - UI截图

4. **使用说明**
   - 如何使用新功能
   - 工单存储位置
   - 如何管理工单

---

**准备好了吗？开始实现吧！** 🆘

我会实时监控进度并进行测试验证。
