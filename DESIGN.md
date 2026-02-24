# Design System: SRI 动态销售情报系统 (Sales Reconnaissance Intelligence)

**Project Type:** Streamlit Web Application (Python)
**Source File:** `app.py` (3,602 lines)
**Design Philosophy:** Military Command Center — Data-dense, action-oriented industrial dashboard

---

## 1. Visual Theme & Atmosphere

**总体氛围：** 军事化作战指挥室（Battle Command Center）

界面呈现出一种**高密度信息矩阵**的氛围，如同一个真实的军事情报指挥中心。整个系统用"战区"、"弹药"、"火力支援"、 "情报雷达"等军事隐喻贯穿，赋予了传统 CRM 系统一种紧迫、行动导向的气质。

- **视觉密度：** 极高（Dense / Utilitarian）— 每个屏幕都承载了大量的操作控件、指标卡片和审批流。
- **情感基调：** 紧迫且严肃（Urgent & Authoritative）— 通过大量使用 🚨⚠️🔴 警告图标和军事术语来营造紧张的前线战场感。
- **交互特质：** 原生 App 感 — 通过隐藏 Streamlit 默认菜单、页脚和部署按钮（`.stDeployButton`, `#MainMenu`, `footer` 全部 `visibility: hidden`），打造沉浸式无干扰操作界面。
- **设备策略：** 移动端优先 — 内置了完整的 `@media (max-width: 768px)` 触控优化引擎，专为一线销售人员在外拍照、录音和快速录入而设计。

---

## 2. Color Palette & Roles

系统继承 **Streamlit 默认浅色主题**（无自定义 `config.toml`），核心调色板完全依赖 Streamlit 内置语义色彩系统。

### 2.1 语义通知色（Semantic Notification Colors）

| 色彩名称 | 色值 (Streamlit 默认) | 功能角色 | 使用频率 |
|---|---|---|---|
| **柔和天际蓝** (Gentle Sky Blue) | `#d1ecf1` / `rgba(49, 130, 206, 0.1)` | `st.info()` — 引导性提示、系统说明、教学指引 | ⭐⭐⭐⭐⭐ 极高 |
| **森林通行绿** (Forest Pass Green) | `#d4edda` / `rgba(56, 161, 105, 0.1)` | `st.success()` — 操作成功确认、状态正常、审批通过 | ⭐⭐⭐⭐ 高 |
| **琥珀预警黄** (Amber Alert Gold) | `#fff3cd` / `rgba(237, 137, 54, 0.1)` | `st.warning()` — 风险预警、缺口情报、输入校验 | ⭐⭐⭐⭐ 高 |
| **烈焰危机红** (Crimson Crisis Red) | `#f8d7da` / `rgba(229, 62, 62, 0.1)` | `st.error()` — 严重错误、撞单拦截、利润告警 | ⭐⭐⭐ 中 |

### 2.2 交互控件色（Interactive Element Colors）

| 色彩名称 | 色值 (Streamlit 默认) | 功能角色 |
|---|---|---|
| **行动号角红** (Action Bugle Red) | `#FF4B4B` | `type="primary"` 按钮 — 核心提交动作（提交审核、AI诊断、一键生成） |
| **钢铁中性灰** (Steel Neutral Gray) | `#F0F2F6` | `type="secondary"` 按钮 — 辅助操作（驳回、清空、取消） |
| **指挥蓝** (Command Blue) | `#1F77B4` | Streamlit 默认强调色 — 选中态、链接、图表主色 |

### 2.3 内联微样式色（Inline Micro-Style Colors）

| 色彩名称 | 色值 | 功能角色 |
|---|---|---|
| **红印鉴证色** (Seal Vermillion) | `red` (CSS keyword) | 电子公章/印鉴标识文字（`font-weight: bold`） |
| **金额高亮红** (Price Highlight Red) | `red` (CSS keyword) | 金额数字高亮（提成核算、最终报价） |

### 2.4 Emoji 态度色彩编码系统

系统使用 Emoji 色块作为**视觉化的离散态度指标**，替代传统的进度条或色彩标签：

| Emoji | 含义 | 对应常规色值 |
|---|---|---|
| 🟢 | 支持我方 / 积极态度 | Green `#22C55E` |
| 🟡 | 中立 / 观望态度 | Yellow `#EAB308` |
| 🔴 | 反对 / 敌对态度 | Red `#EF4444` |
| ⚪ | 未知 / 未接触 | Gray `#9CA3AF` |

---

## 3. Typography Rules

### 3.1 字体家族（Font Family）

- **全局字体：** Streamlit 默认字体栈 — `"Source Sans Pro", sans-serif`
- **代码/数据字体：** 等宽字体 `"Source Code Pro", monospace`（用于 `st.code()` 和 `st.json()` 输出块）

### 3.2 标题层级体系（Heading Hierarchy）

系统采用 **Markdown 标题 + Emoji 前缀**形成强视觉锚点的层级体系：

| 层级 | Markdown | 渲染尺寸 (约) | 用途 | 示例 |
|---|---|---|---|---|
| **H1 — 系统级** | `st.title()` | ~2.25rem / 36px | 全局唯一主标题 | 🎯 SRI 动态销售情报系统 |
| **H2 — 模块级** | `st.header()` | ~1.75rem / 28px | 侧边栏区块标题 | ⚙️ 系统设置 |
| **H3 — 功能区** | `### Markdown` | ~1.35rem / 22px | Tab 内一级功能区 | 🏛️ 战役立项基座 / 🧠 AI 统帅部 |
| **H4 — 子功能** | `#### Markdown` | ~1.15rem / 18px | 功能区内子模块 | 💰 最终应发提成总额 |
| **H5 — 步骤标注** | `##### Markdown` | ~1rem / 16px | 表单分步引导 | 📝 第一步：锁定终端客户 |
| **正文** | `st.write() / caption()` | 1rem / 16px | 常规文本内容 | — |
| **辅助说明** | `st.caption()` | ~0.85rem / 14px | 灰色辅助信息 | 提报人 / 时间戳 |

### 3.3 移动端排版适配

```css
/* 移动端按钮文字 */
.stButton button { font-size: 1.1rem !important; }

/* 输入框文字 — 强制 16px 防止 iOS Safari 自动缩放 */
input, textarea { font-size: 16px !important; line-height: 1.5 !important; }
```

### 3.4 文字权重（Font Weight）规则

| 权重 | 使用场景 |
|---|---|
| **Bold (700)** | Markdown 强调 `**文本**`、内联 `font-weight:bold`（公章文字、金额标注） |
| **Regular (400)** | 常规正文、表单标签 |
| **Light (300)** | `st.caption()` 辅助文字 |

---

## 4. Component Stylings

### 4.1 按钮（Buttons）

- **主行动按钮 (Primary)：** Streamlit 饱满的行动号角红（`#FF4B4B`）背景 + 白色文字，用于所有关键提交操作。移动端强制放大至 **最小高度 3rem**（48px），配备 **柔和 8px 圆角**，确保胖手指友好。
- **辅助按钮 (Secondary)：** 钢铁中性灰底色 + 深色文字，用于"驳回"、"清空"等消极操作。
- **全宽化策略：** 几乎所有按钮都强制 `use_container_width=True`（全宽撑满父容器），形成如同移动端 App 的块级按钮风格。
- **Emoji 化标签：** 每个按钮都以 Emoji 图标开头（🚀 提交、💾 保存、🧠 AI诊断、❌ 驳回），作为即时视觉线索。

### 4.2 卡片与容器（Cards / Containers）

- **核心容器：** `st.container(border=True)` — 带有`细微的 1px 浅灰边框`和`微妙的 0.5rem 内圆角`，用于隔离独立功能区块（如申诉表单、4象限仪表盘子区块）。
- **折叠手风琴 (Accordion)：** `st.expander()` — 系统的灵魂组件，大量使用（15+ 实例），用于收纳次要功能区以减少信息过载。支持 `expanded=True/False` 控制默认展开状态。
- **分隔线：** `st.markdown("---")` / `st.divider()` — 用作功能区之间的视觉分界线，频繁出现。

### 4.3 输入控件（Inputs / Forms）

- **选择框 (Selectbox)：** 系统中最核心的交互控件，用于级联筛选（战区→人员→项目），大量使用 `index=0` 默认选中或 `index=None` 悬空搜索模式。
- **文本域 (Text Area)：** 带**语音录入增强**的自定义组件 `voice_text_area()`，内嵌 Whisper STT 引擎，支持一线销售口述转文字。
- **文件上传器 (File Uploader)：** 支持 PNG/JPG/PDF 多格式，用于公章上传、证据举证、竞品铭牌照片捕获等。
- **移动端适配：** 输入框强制 `font-size: 16px`（防iOS缩放）+ `line-height: 1.5`。

### 4.4 数据展示（Data Display）

- **数据表格：** `st.dataframe()` 和 `st.data_editor()` — 全部设置 `use_container_width=True` + `hide_index=True`，移动端支持`顺滑横向触控滚动`（`-webkit-overflow-scrolling: touch`）并隐藏滚动条。
- **指标卡：** `st.metric()` — 用于项目情报数等KPI展示。
- **图表：** `st.bar_chart()` — 用于测验得分等统计可视化。

### 4.5 通知与反馈系统（Notification System）

| 组件 | 用途 | 视觉表现 |
|---|---|---|
| `st.success("✅ ...")` | 操作成功 | 绿底横幅 + 对勾图标 |
| `st.error("🚨 ...")` | 严重错误/拦截 | 红底横幅 + 警报图标 |
| `st.warning("⚠️ ...")` | 风险预警 | 黄底横幅 + 三角图标 |
| `st.info("💡 ...")` | 引导提示 | 蓝底横幅 + 信息图标 |
| `st.toast("✅ ...")` | 临时快闪通知 | 右下角浮动弹窗（自动消失） |
| `st.spinner("🧠 ...")` | 加载等待态 | 旋转动画 + 文字描述 |

---

## 5. Layout Principles

### 5.1 全局布局架构

```
┌─────────────────────────────────────────────────────────┐
│  st.set_page_config(layout="wide")  — 全屏宽模式          │
├─────────────┬───────────────────────────────────────────┤
│             │                                           │
│  SIDEBAR    │          MAIN CONTENT AREA                │
│  (侧边栏)   │                                           │
│             │   ┌─ TABS (10个主标签页) ──────────────┐   │
│  • 系统设置  │   │ 📝情报 | 🗺️沙盘 | 🎓伴学 | ...   │   │
│  • 公章管理  │   ├──────────────────────────────────┤   │
│  • 武器库    │   │                                  │   │
│  • 新建项目  │   │   Tab Content Area               │   │
│  • 审核工作台│   │   (功能区通过 st.expander         │   │
│  • 身份选择  │   │    和 st.columns 组织)            │   │
│             │   │                                  │   │
│             │   └──────────────────────────────────┘   │
└─────────────┴───────────────────────────────────────────┘
```

### 5.2 Tab 导航体系（10 个主功能模块）

| # | 标签名 | Emoji | 核心职责 |
|---|--------|-------|---------|
| 1 | 情报录入 | 📝 | 日常推进动态、多模态捕获 |
| 2 | 作战沙盘 | 🗺️ | 项目全景视图、AI诊断、权力地图 |
| 3 | AI 伴学中心 | 🎓 | 实战模拟与知识测验 |
| 4 | 核心技术武器库 | 📚 | 知识库管理与RAG检索 |
| 5 | 第一现场 | 🎙️ | 实时音视频情报上报 |
| 6 | 领导看板 | 📊 | 全局审批、仲裁、团队管理 |
| 7 | 粮草审批 | 💸 | 费用报销、资金拨付流程 |
| 8 | 招投标控标 | 📑 | AI拆标排雷、控标参数生成 |
| 9 | 询报价 | 💰 | BOM管理、报价单生成与审批 |
| 10 | 合同联审 | 📋 | 四步合同审批pipeline |

### 5.3 多栏网格系统（Column Grid）

系统使用 Streamlit 的 `st.columns()` 构建灵活的自适应网格：

| 布局模式 | 用途 | 示例 |
|---|---|---|
| `st.columns(2)` | 等分双栏 — 审批按钮（通过/驳回）、AI输出并列 |
| `st.columns(3)` | 等分三栏 — 生态铁三角（业主/设计院/总包） |
| `st.columns([8, 2])` | 主+操作列 — 弹药库列表（内容 + 删除按钮） |
| `st.columns([3, 1])` | 主+附属列 — 上传区 + 操作按钮 |
| `st.columns([4, 1])` | 内容+控件列 — 心理画像 + 生成按钮 |
| `st.columns([1, 1])` | 等分双栏 — 阶段选择 + 客户 TopN |

### 5.4 间距与留白策略（Spacing & Whitespace）

| 属性 | 桌面端 | 移动端 (≤768px) |
|---|---|---|
| **内容区顶部间距** | Streamlit 默认 (~3rem) | `2rem` (紧缩) |
| **内容区水平内边距** | Streamlit 默认 (~5rem) | `1rem` (极限紧缩) |
| **按钮圆角** | Streamlit 默认 (~4px) | `8px` (柔和友好) |
| **按钮最小高度** | Streamlit 默认 (~38px) | `3rem / 48px` (胖手指友好) |
| **侧边栏宽度** | Streamlit 默认 (~300px) | `100%` (全屏覆盖) |

### 5.5 数据表格移动适配

```css
.stDataFrame {
    overflow-x: auto;                    /* 允许横向滚动 */
    -webkit-overflow-scrolling: touch;   /* iOS 弹性惯性滚动 */
}
.stDataFrame::-webkit-scrollbar {
    display: none;                       /* 隐藏滚动条 */
}
```

---

## 6. Iconography System — Emoji 军事化图标语言

系统不使用任何第三方图标库（如 FontAwesome 或 Material Icons），而是全面采用 **Unicode Emoji** 作为统一的图标语言。这是一套经过精心设计的**军事隐喻式图标体系**：

### 6.1 功能域图标

| 域 | Emoji | 含义 |
|---|---|---|
| **情报系统** | 🕵️‍♂️ 📡 🔍 | 信息获取、雷达扫描、深度检索 |
| **作战行动** | 🎯 ⚔️ 🚀 💣 🔥 | 目标锁定、攻防、发射、爆破、火力 |
| **防御保障** | 🛡️ 🔒 🛡️ | 数据脱敏、加密、安全 |
| **后勤补给** | 💸 📦 🏗️ | 资金审批、物资、工程 |
| **指挥决策** | 🧠 📊 👮‍♂️ ⚖️ | AI分析、仪表盘、审核、仲裁 |
| **人员标识** | 👤 👥 👷 👋 | 个人、团队、工人、打招呼 |
| **状态反馈** | ✅ ❌ ⚠️ 🚨 💡 | 成功、失败、警告、紧急、提示 |

### 6.2 Emoji 首字母规范

**所有面向用户的文本标签**（按钮、标题、提示、Tab 名称）都必须以一个**语义相关的 Emoji** 开头，形成**即时视觉锚点**，帮助用户在高密度信息中快速定位功能区域。

---

## 7. RBAC 视觉差异化系统（Role-Based Visual Context）

系统根据当前登录角色，在作战沙盘等核心页面呈现差异化的**视觉上下文**：

| 角色 | 视觉标识 | 数据可见范围 |
|---|---|---|
| 一线销售 | 🛡️ **单兵作战视角** | 仅个人归属项目 |
| 区域总监 | ⚔️ **战区指挥视角** | 分管战区全部项目 |
| 销售VP | 👁️ **上帝视角** | 全公司所有项目 |
| 系统管理员 | 👁️ **上帝视角** | 全公司所有项目 |

---

## 8. Interaction Patterns — 核心交互模式

### 8.1 级联筛选模式（Cascade Filter Pattern）

```
战区 Selectbox → 人员 Selectbox → 项目 Selectbox
```

上级选择变更后，下级选项自动过滤刷新。

### 8.2 自动焦点跳转（Auto-Focus Engine）

通过 JavaScript 注入实现表单步骤间的自动焦点跳转（`auto_focus_next()`），模拟原生 App 的流畅表单填写体验。

### 8.3 撞单拦截与仲裁（Collision Detection & Arbitration）

新项目提交时，自动执行**模糊查重**（客户名称双向包含检测），一旦触发拦截：
- 展示醒目红色 `st.error()` 拦截横幅
- 渲染内嵌的**申诉表单**（`st.container(border=True)` 内）
- 支持证据附件上传，最终由 VP 裁决

### 8.4 多模态情报捕获（Multimodal Intelligence Capture）

融合文字录入 + 语音转写（Whisper STT）+ 图片上传（GPT-4o-mini Vision）+ PDF解析（PyPDF2），形成全方位的前线情报采集链路。
