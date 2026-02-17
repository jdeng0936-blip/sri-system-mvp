# 🆘 任务：炮火呼叫中枢

## 痛点

第一现场有"🆘 呼叫后方技术群"按钮，但点击后只显示假提示。当AI无法回答客户的非标定制需求时，销售无法快速联系后方技术专家，现场上下文（客户原话、已有对话、相关文档）无法传递，导致支持效率低下。

---

## 目标

实现一键打包现场上下文，生成结构化工单，保存本地并可选推送通知。

---

## 技术要求

### 1. 新建工单模块

创建 `support_ticket.py`，包含：

**工单数据结构：**
```python
{
  "ticket_id": "20260215_173000",  # 时间戳ID
  "timestamp": "2026-02-15T17:30:00",
  "priority": "高/中/低",  # 根据关键词分析
  
  "client_info": {
    "query": "客户问题原文",
    "project": "当前项目名称"
  },
  
  "context": {
    "conversation_history": [...],  # 最近5轮对话
    "retrieved_documents": [...]    # 已检索的文档
  },
  
  "metadata": {
    "source": "第一现场",
    "status": "待处理"
  }
}
```

**核心函数：**
- `generate_support_ticket(query, project, session_state) -> dict` - 生成工单
- `save_ticket(ticket) -> ticket_id` - 保存为JSON到 `support_tickets/` 目录
- `send_ticket_notification(ticket, ticket_id) -> bool` - 可选推送（暂时只打印）

### 2. 集成到前端

在 `app.py` 第一现场部分，替换假按钮：

**当前代码：**
```python
if st.button("🆘 呼叫后方技术群"):
    st.success("✅ 已将现场痛点...打包发送...")  # 假提示
```

**升级为：**
```python
if st.button("🆘 呼叫后方技术群"):
    from support_ticket import generate_support_ticket, save_ticket
    
    ticket = generate_support_ticket(
        query=st.session_state.get("last_client_query", ""),
        project=current_live_project,
        session_state=st.session_state
    )
    ticket_id = save_ticket(ticket)
    
    st.success(f"✅ 工单已生成！编号：#{ticket_id}")
    st.info(f"📋 保存位置：support_tickets/{ticket_id}.json")
    
    with st.expander("查看工单详情"):
        st.json(ticket)
```

### 3. 上下文提取

- **对话历史：** 从 `st.session_state["messages"]` 提取最近5轮
- **检索文档：** 从 `st.session_state.get("last_retrieved_docs", [])` 提取
- **优先级分析：** 检测关键词（"紧急"/"急"/"马上" → 高优先级）

---

## 验收标准

- [ ] 点击按钮生成工单
- [ ] 工单包含完整的客户问题和项目信息
- [ ] 工单保存为 JSON 文件
- [ ] 显示工单编号和保存路径
- [ ] 可展开查看工单详情

---

## 测试方式

1. 在第一现场提问："我需要耐1000度高温的涂料"
2. AI 回答（可能无法满足）
3. 点击"🆘 呼叫后方技术群"
4. 检查 `support_tickets/` 目录是否生成 JSON 文件
5. 打开文件验证内容完整性

---

## 约束

- **数据安全：** 工单可能包含敏感信息，添加到 `.gitignore`
- **存储管理：** 定期清理已处理工单
- **通知渠道：** 当前只保存本地，暂不实现真实推送（预留接口）
- **前端兼容：** 不影响其他功能，只替换假按钮逻辑

---

## 扩展（可选）

- 工单管理界面（侧边栏显示待处理工单数）
- 自动推送到 Telegram/钉钉/企业微信
- 工单状态更新（待处理 → 处理中 → 已解决）

---

**完成后输出执行摘要。**
