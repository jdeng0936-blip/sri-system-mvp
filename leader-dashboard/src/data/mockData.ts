// ================================================================
// mockData.ts — All static text, Emoji, and mock data centralized
// Follows react-components skill: Data Decoupling principle
// ================================================================

export interface KpiCardData {
    readonly id: string
    readonly emoji: string
    readonly title: string
    readonly value: string
    readonly trend: string
    readonly trendUp: boolean
    readonly accentColor: string // Tailwind border-l color class
    readonly description: string
}

export const kpiCards: readonly KpiCardData[] = [
    {
        id: "revenue",
        emoji: "💰",
        title: "本月总计营收",
        value: "¥ 2,847万",
        trend: "+12.5%",
        trendUp: true,
        accentColor: "border-l-blue-500",
        description: "含已签约合同金额与已确认回款",
    },
    {
        id: "winrate",
        emoji: "🎯",
        title: "综合赢单率",
        value: "68.3%",
        trend: "+3.2%",
        trendUp: true,
        accentColor: "border-l-emerald-500",
        description: "已签约项目数 / 进入商务阶段项目总数",
    },
    {
        id: "risk",
        emoji: "🚨",
        title: "高风险合同预警",
        value: "7 份",
        trend: "+2",
        trendUp: false,
        accentColor: "border-l-red-500",
        description: "利润率低于阈值或交付周期异常的合同",
    },
    {
        id: "overdue",
        emoji: "⏰",
        title: "逾期催款总额",
        value: "¥ 461万",
        trend: "-8.1%",
        trendUp: true,
        accentColor: "border-l-amber-500",
        description: "超过合同约定付款日期仍未回款的总额",
    },
]

// ================================================================
// Funnel Data — 战区业绩漏斗
// ================================================================

export interface FunnelStage {
    readonly label: string
    readonly emoji: string
    readonly count: number
    readonly amount: string
    readonly widthPercent: number
}

export const funnelStages: readonly FunnelStage[] = [
    { label: "线索获取", emoji: "📡", count: 128, amount: "¥ 8,240万", widthPercent: 100 },
    { label: "方案报价", emoji: "📋", count: 76, amount: "¥ 5,120万", widthPercent: 62 },
    { label: "商务谈判", emoji: "🤝", count: 42, amount: "¥ 3,080万", widthPercent: 38 },
    { label: "合同签约", emoji: "✅", count: 23, amount: "¥ 2,847万", widthPercent: 22 },
]

// ================================================================
// Collection Progress Data — 动态回款进度
// ================================================================

export interface CollectionItem {
    readonly id: string
    readonly projectName: string
    readonly contractAmount: string
    readonly collectedPercent: number
    readonly isOverdue: boolean
    readonly daysInfo: string
}

export const collectionItems: readonly CollectionItem[] = [
    {
        id: "p1",
        projectName: "华润万象城 · 中央空调项目",
        contractAmount: "¥ 680万",
        collectedPercent: 85,
        isOverdue: false,
        daysInfo: "剩余 23 天",
    },
    {
        id: "p2",
        projectName: "碧桂园总部办公楼 · 暖通改造",
        contractAmount: "¥ 420万",
        collectedPercent: 45,
        isOverdue: true,
        daysInfo: "逾期 12 天",
    },
    {
        id: "p3",
        projectName: "腾讯滨海大厦 · 机电分包",
        contractAmount: "¥ 1,200万",
        collectedPercent: 62,
        isOverdue: false,
        daysInfo: "剩余 45 天",
    },
    {
        id: "p4",
        projectName: "宝安国际机场 T4 · 消防工程",
        contractAmount: "¥ 890万",
        collectedPercent: 30,
        isOverdue: true,
        daysInfo: "逾期 5 天",
    },
    {
        id: "p5",
        projectName: "中信证券大厦 · 弱电集成",
        contractAmount: "¥ 340万",
        collectedPercent: 100,
        isOverdue: false,
        daysInfo: "已结清",
    },
]

// ================================================================
// Intel Feed Data — 情报战报流
// ================================================================

export interface IntelFeedItem {
    readonly id: string
    readonly author: string
    readonly authorInitial: string
    readonly role: "一线销售" | "区域总监" | "销售VP"
    readonly roleEmoji: string
    readonly roleBadgeColor: "info" | "default" | "warning"
    readonly action: string
    readonly project: string
    readonly timestamp: string
    readonly type: "success" | "warning" | "destructive" | "info"
}

export const intelFeedItems: readonly IntelFeedItem[] = [
    {
        id: "f1",
        author: "张伟",
        authorInitial: "张",
        role: "一线销售",
        roleEmoji: "🛡️",
        roleBadgeColor: "info",
        action: "提交了竞品铭牌照片情报",
        project: "华润万象城项目",
        timestamp: "3 分钟前",
        type: "info",
    },
    {
        id: "f2",
        author: "李总监",
        authorInitial: "李",
        role: "区域总监",
        roleEmoji: "⚔️",
        roleBadgeColor: "default",
        action: "审批通过立项申请",
        project: "星河 COCO Park 项目",
        timestamp: "18 分钟前",
        type: "success",
    },
    {
        id: "f3",
        author: "王VP",
        authorInitial: "王",
        role: "销售VP",
        roleEmoji: "👁️",
        roleBadgeColor: "warning",
        action: "触发利润率预警拦截",
        project: "碧桂园总部办公楼",
        timestamp: "1 小时前",
        type: "destructive",
    },
    {
        id: "f4",
        author: "陈敏",
        authorInitial: "陈",
        role: "一线销售",
        roleEmoji: "🛡️",
        roleBadgeColor: "info",
        action: "上传了招标文件 PDF 并完成 AI 解析",
        project: "腾讯滨海大厦项目",
        timestamp: "2 小时前",
        type: "info",
    },
    {
        id: "f5",
        author: "李总监",
        authorInitial: "李",
        role: "区域总监",
        roleEmoji: "⚔️",
        roleBadgeColor: "default",
        action: "驳回了报价单（利润低于 15% 红线）",
        project: "宝安国际机场 T4",
        timestamp: "3 小时前",
        type: "warning",
    },
    {
        id: "f6",
        author: "赵强",
        authorInitial: "赵",
        role: "一线销售",
        roleEmoji: "🛡️",
        roleBadgeColor: "info",
        action: "签单成功 🎉 合同金额 ¥340万",
        project: "中信证券大厦",
        timestamp: "5 小时前",
        type: "success",
    },
    {
        id: "f7",
        author: "王VP",
        authorInitial: "王",
        role: "销售VP",
        roleEmoji: "👁️",
        roleBadgeColor: "warning",
        action: "撞单仲裁完成，归属权判给华南战区",
        project: "万科云城二期",
        timestamp: "昨天",
        type: "warning",
    },
]

// ================================================================
// Dashboard Header
// ================================================================

export const dashboardTitle = "🎯 SRI 全局作战态势感知"
export const dashboardSubtitle = "Sales Reconnaissance Intelligence — Command Center"
export const currentRole = "销售VP"
export const currentRoleEmoji = "👁️"
export const currentRoleLabel = "上帝视角"

// ================================================================
// Commission Card Data — 提成核算卡
// ================================================================

export interface CommissionSalesperson {
    readonly name: string
    readonly initial: string
    readonly region: string
    readonly regionEmoji: string
}

export interface CommissionContract {
    readonly name: string
    readonly code: string
    readonly client: string
}

export interface CommissionHeroMetric {
    readonly id: string
    readonly emoji: string
    readonly label: string
    readonly value: string
    readonly rawValue: number
    readonly unit: string
    readonly accentClass: string // Tailwind text color class
}

export interface CommissionLineItem {
    readonly id: string
    readonly emoji: string
    readonly label: string
    readonly description: string
    readonly amount: number       // positive = bonus, negative = penalty
    readonly displayAmount: string
    readonly type: "base" | "bonus" | "penalty"
}

export const commissionSalesperson: CommissionSalesperson = {
    name: "张伟",
    initial: "张",
    region: "华南战区",
    regionEmoji: "🛡️",
}

export const commissionContract: CommissionContract = {
    name: "腾讯滨海总部机电分包",
    code: "HN-2026-0217",
    client: "腾讯科技（深圳）有限公司",
}

// Gross margin 22.5% => between 15% and 30% => neutral (white)
export const commissionHeroMetrics: readonly CommissionHeroMetric[] = [
    {
        id: "total-amount",
        emoji: "💰",
        label: "合同总金额",
        value: "¥ 1,200万",
        rawValue: 12000000,
        unit: "元",
        accentClass: "text-[hsl(var(--primary))]",
    },
    {
        id: "gross-margin",
        emoji: "📊",
        label: "综合毛利率",
        value: "22.5%",
        rawValue: 22.5,
        unit: "%",
        // Color is computed dynamically: <15 red, 15-30 white, >30 green
        accentClass: "",
    },
    {
        id: "base-rate",
        emoji: "🎯",
        label: "基准提成比例",
        value: "3.0%",
        rawValue: 3.0,
        unit: "%",
        accentClass: "text-[hsl(var(--warning))]",
    },
]

export const commissionLineItems: readonly CommissionLineItem[] = [
    {
        id: "base",
        emoji: "✅",
        label: "基础提成 (Base)",
        description: "合同总金额 × 基准提成比例 3.0%",
        amount: 360000,
        displayAmount: "¥ 36.0万",
        type: "base",
    },
    {
        id: "margin-bonus",
        emoji: "📈",
        label: "利润溢价奖励 (Margin Bonus)",
        description: "毛利率超过 20% 部分 × 合同金额 × 0.45%",
        amount: 54000,
        displayAmount: "+¥ 5.4万",
        type: "bonus",
    },
    {
        id: "strategic-bonus",
        emoji: "🤖",
        label: "战略产品捆绑奖 (Strategic Bundle)",
        description: "包含 AI 防腐控制柜，额外 +2%",
        amount: 24000,
        displayAmount: "+¥ 2.4万",
        type: "bonus",
    },
    {
        id: "overdue-penalty",
        emoji: "⏰",
        label: "逾期扣减 (Overdue Penalty)",
        description: "客户回款逾期 >30 天，扣减基础提成 5%",
        amount: -18000,
        displayAmount: "-¥ 1.8万",
        type: "penalty",
    },
    {
        id: "collision-penalty",
        emoji: "⚔️",
        label: "撞单扣减 (Collision Deduction)",
        description: "与华东战区李强存在客户重叠，仲裁后扣减",
        amount: -6000,
        displayAmount: "-¥ 0.6万",
        type: "penalty",
    },
]

export const commissionFinalAmount = "¥ 41.4万"
export const commissionFinalRaw = 414000
