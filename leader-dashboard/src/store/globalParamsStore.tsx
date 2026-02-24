/**
 * 全局作战字典 & MEDDIC 赢率权重
 * 100% 从原版 app.py DEFAULT_CONFIGS (L22-75) + DEFAULT_EVAL_DIMENSIONS (L79-87) 逐字提取
 */

import { createContext, useContext, useState, type ReactNode } from "react"

// ── Types (严格按总指挥规格) ──

export interface GlobalParamsState {
    // 1. 下拉选项字典
    projectStages: string[]
    painPointOptions: string[]
    roleOptions: string[]
    leaderAttitudes: string[]
    leaderHistories: string[]
    infoSources: string[]
    projectDrivers: string[]
    positionOptions: string[]
    budgetStatuses: string[]

    // 2. 动态赢率评估模型 (MEDDIC 权重)
    evalDimensions: Record<string, number>
}

// ── Default Values (原版 app.py 一字不差) ──

export const DEFAULT_GLOBAL_PARAMS: GlobalParamsState = {
    projectStages: [
        "初期接触", "方案报价", "商务谈判",
        "技术僵持", "逼单/签约", "丢单归档",
    ],
    painPointOptions: [
        "工期极其紧张", "整体预算受限", "后期维护成本高",
        "安装空间受限", "运行环境恶劣(高腐蚀/高粉尘)", "需要智能化升级",
    ],
    roleOptions: [
        "决策者 (关注ROI/风险)", "使用者 (关注易用/免维护)",
        "影响者 (关注参数/合规)", "教练/内线 (关注控标/汇报)",
        "技术把关者 (关注技术指标)",
    ],
    leaderAttitudes: [
        "极度看重初期投入成本 (对价格极其敏感)",
        "绝对迷信大品牌/求稳怕担责 (只信西门子/ABB等大厂)",
        "极度看重工期和投产节点 (对时间/交期极度焦虑)",
        "看重全生命周期与长期绝对安全 (价值与质量导向)",
    ],
    leaderHistories: [
        "首次接触我们，防备心较重", "历史合作过，对我们有一定信任基础",
        "过去曾被友商(或低价设备)坑过，心有余悸", "对各家方案均不满意，处于摇摆观望状态",
    ],
    infoSources: [
        "高层客情/内线透露 (可信度极高)", "设计院/合作伙伴引入 (带有一定倾向性)",
        "公开招标/采购网 (公开竞争/内定风险高)", "陌拜/展会挖掘 (处于极早期)",
        "友商渠道流出 (需防范假消息)",
    ],
    projectDrivers: [
        "老旧设备改造/消除隐患 (关注痛点)", "产能扩建/新建厂房 (关注工期)",
        "响应政策/环保合规 (关注指标)", "数字化/智能化升级 (关注新技术)",
    ],
    positionOptions: [
        "领跑 (参与标准制定/已锁定关键人)", "并跑 (常规技术交流中，有竞争)",
        "跟跑/陪跑 (介入较晚/竞品明显占优)", "未知 (刚获取信息，局势不明)",
    ],
    budgetStatuses: [
        "预算已全额批复 (随时可采)", "部分资金到位/边建边批 (有扯皮风险)",
        "正在申报预算 (可引导预算金额)", "资金来源不明/自筹 (警惕烂尾)",
    ],
    evalDimensions: {
        "M — 量化指标 (Metrics)": 80,
        "E — 经济决策者 (Economic Buyer)": 100,
        "D — 决策标准 (Decision Criteria)": 70,
        "D — 决策流程 (Decision Process)": 70,
        "I — 核心痛点 (Identify Pain)": 90,
        "C — 内部教练 (Champion)": 90,
        "R — 利益关系捆绑 (Relationship)": 85,
    },
}

// ── React Context ──

interface GlobalParamsContextType {
    params: GlobalParamsState
    setParams: React.Dispatch<React.SetStateAction<GlobalParamsState>>
    resetToDefaults: () => void
    updateDimensionWeight: (key: string, weight: number) => void
}

const GlobalParamsContext = createContext<GlobalParamsContextType | null>(null)

export function GlobalParamsProvider({ children }: { children: ReactNode }) {
    const [params, setParams] = useState<GlobalParamsState>(() => {
        try {
            const saved = localStorage.getItem("sri_global_params")
            if (saved) return { ...DEFAULT_GLOBAL_PARAMS, ...JSON.parse(saved) }
        } catch { /* ignore */ }
        return { ...DEFAULT_GLOBAL_PARAMS }
    })

    const resetToDefaults = () => {
        setParams({ ...DEFAULT_GLOBAL_PARAMS })
        localStorage.removeItem("sri_global_params")
    }

    const updateDimensionWeight = (key: string, weight: number) => {
        setParams((prev) => {
            const next = { ...prev, evalDimensions: { ...prev.evalDimensions, [key]: weight } }
            try { localStorage.setItem("sri_global_params", JSON.stringify(next)) } catch { /* ignore */ }
            return next
        })
    }

    const setParamsAndPersist: typeof setParams = (updater) => {
        setParams((prev) => {
            const next = typeof updater === "function" ? updater(prev) : updater
            try { localStorage.setItem("sri_global_params", JSON.stringify(next)) } catch { /* ignore */ }
            return next
        })
    }

    return (
        <GlobalParamsContext.Provider value={{ params, setParams: setParamsAndPersist, resetToDefaults, updateDimensionWeight }}>
            {children}
        </GlobalParamsContext.Provider>
    )
}

export function useGlobalParams() {
    const ctx = useContext(GlobalParamsContext)
    if (!ctx) throw new Error("useGlobalParams must be used within GlobalParamsProvider")
    return ctx
}
