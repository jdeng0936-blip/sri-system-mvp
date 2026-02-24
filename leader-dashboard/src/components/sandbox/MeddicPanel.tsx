/**
 * MeddicPanel.tsx — 动态赢率雷达 (MEDDIC 调参舱)
 * =================================================
 * 7 维滑块与 useGlobalParams 双向绑定 + NBA 战术生成
 */

import { useState, useMemo } from "react"
import { useGlobalParams } from "@/store/globalParamsStore"
import { generateNBA } from "@/lib/apiClient"
import { Slider } from "@/components/ui/slider"
import {
    Loader2,
    Target,
    RotateCcw,
    TrendingUp,
    User,
    Shield,
    Settings,
    Zap,
    Users,
    Swords,
    Copy,
    Check,
} from "lucide-react"

// 维度配色与图标映射
const DIMENSION_META: Record<
    string,
    { icon: React.ReactNode; color: string; barColor: string; shortLabel: string }
> = {
    "M — 量化指标 (Metrics)": {
        icon: <TrendingUp size={13} />,
        color: "text-blue-400",
        barColor: "bg-blue-500",
        shortLabel: "M 量化指标",
    },
    "E — 经济决策者 (Economic Buyer)": {
        icon: <User size={13} />,
        color: "text-amber-400",
        barColor: "bg-amber-500",
        shortLabel: "E 经济买家",
    },
    "D — 决策标准 (Decision Criteria)": {
        icon: <Shield size={13} />,
        color: "text-purple-400",
        barColor: "bg-purple-500",
        shortLabel: "D 决策标准",
    },
    "D — 决策流程 (Decision Process)": {
        icon: <Settings size={13} />,
        color: "text-cyan-400",
        barColor: "bg-cyan-500",
        shortLabel: "D 决策流程",
    },
    "I — 核心痛点 (Identify Pain)": {
        icon: <Zap size={13} />,
        color: "text-red-400",
        barColor: "bg-red-500",
        shortLabel: "I 核心痛点",
    },
    "C — 内部教练 (Champion)": {
        icon: <Users size={13} />,
        color: "text-green-400",
        barColor: "bg-green-500",
        shortLabel: "C 内部教练",
    },
    "R — 利益关系捆绑 (Relationship)": {
        icon: <Swords size={13} />,
        color: "text-pink-400",
        barColor: "bg-pink-500",
        shortLabel: "R 利益捆绑",
    },
}

export function MeddicPanel({ projectId }: { projectId?: number }) {
    const { params, updateDimensionWeight, resetToDefaults } = useGlobalParams()
    const [nbaResult, setNbaResult] = useState("")
    const [nbaLoading, setNbaLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    // 动态赢率计算
    const winRate = useMemo(() => {
        const dims = params.evalDimensions
        const keys = Object.keys(dims)
        if (keys.length === 0) return 0
        const total = keys.reduce((sum, k) => sum + dims[k], 0)
        return Math.round(total / keys.length)
    }, [params.evalDimensions])

    // 赢率颜色
    const winRateColor =
        winRate >= 80
            ? "text-green-400"
            : winRate >= 60
                ? "text-yellow-400"
                : winRate >= 40
                    ? "text-orange-400"
                    : "text-red-400"

    const winRateRing =
        winRate >= 80
            ? "ring-green-500/30"
            : winRate >= 60
                ? "ring-yellow-500/30"
                : winRate >= 40
                    ? "ring-orange-500/30"
                    : "ring-red-500/30"

    const handleGenerateNBA = async () => {
        setNbaLoading(true)
        setNbaResult("")
        try {
            const res = await generateNBA(projectId || 0)
            setNbaResult(res.result || res.error || "无返回")
        } catch (err: unknown) {
            const msg = (err as { message?: string })?.message || "生成失败"
            setNbaResult(`❌ ${msg}`)
        } finally {
            setNbaLoading(false)
        }
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(nbaResult)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🎯</span>
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                    动态赢率雷达 · MEDDIC 调参舱
                </h3>
                <div className="flex-1 h-px bg-white/5" />
                <button
                    onClick={resetToDefaults}
                    className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition"
                >
                    <RotateCcw size={10} />
                    重置默认
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左侧：7 维滑块 */}
                <div className="lg:col-span-2 space-y-3">
                    {Object.entries(params.evalDimensions).map(([key, value]) => {
                        const meta = DIMENSION_META[key] || {
                            icon: <Target size={13} />,
                            color: "text-white/60",
                            barColor: "bg-white/40",
                            shortLabel: key,
                        }
                        return (
                            <div
                                key={key}
                                className="group bg-white/[0.02] hover:bg-white/[0.04] rounded-xl px-4 py-3 transition-all border border-transparent hover:border-white/5"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={meta.color}>{meta.icon}</span>
                                        <span className="text-xs font-medium text-white/60">
                                            {meta.shortLabel}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-8 h-1.5 rounded-full overflow-hidden bg-white/5`}
                                        >
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${meta.barColor}`}
                                                style={{ width: `${value}%` }}
                                            />
                                        </div>
                                        <span
                                            className={`text-xs font-bold tabular-nums min-w-[2rem] text-right ${value >= 80
                                                    ? "text-green-400"
                                                    : value >= 50
                                                        ? "text-yellow-400"
                                                        : "text-red-400"
                                                }`}
                                        >
                                            {value}
                                        </span>
                                    </div>
                                </div>
                                <Slider
                                    value={[value]}
                                    min={0}
                                    max={100}
                                    step={5}
                                    onValueChange={([v]) => updateDimensionWeight(key, v)}
                                    className="w-full"
                                />
                            </div>
                        )
                    })}
                </div>

                {/* 右侧：赢率仪表 + NBA 按钮 */}
                <div className="space-y-4">
                    {/* 赢率仪表盘 */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6 text-center">
                        <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-3">
                            综合赢率评估
                        </div>
                        <div
                            className={`inline-flex items-center justify-center w-28 h-28 rounded-full ring-4 ${winRateRing} bg-white/[0.03]`}
                        >
                            <div>
                                <div className={`text-4xl font-black tabular-nums ${winRateColor}`}>
                                    {winRate}
                                </div>
                                <div className="text-[10px] text-white/30">WIN RATE</div>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-white/40">
                            {winRate >= 80
                                ? "🟢 大概率收割 — 紧盯签约节点"
                                : winRate >= 60
                                    ? "🟡 拉锯阶段 — 需定向突破"
                                    : winRate >= 40
                                        ? "🟠 风险较高 — 建议加强火力"
                                        : "🔴 危险信号 — 需战略级资源介入"}
                        </div>
                    </div>

                    {/* NBA 生成按钮 */}
                    <button
                        onClick={handleGenerateNBA}
                        disabled={nbaLoading}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-amber-500/20"
                    >
                        {nbaLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                NBA 战术推演中...
                            </>
                        ) : (
                            <>
                                <Target size={16} />
                                🎯 生成 NBA 战术指导
                            </>
                        )}
                    </button>

                    <div className="text-[10px] text-white/20 text-center">
                        Next Best Action · 基于 MEDDIC 七维评估
                    </div>
                </div>
            </div>

            {/* NBA 结果 */}
            {nbaResult && (
                <div className="mt-6 rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/15 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold text-amber-400/80">
                            🎯 NBA 战术指导报告
                        </div>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-amber-400 transition px-2 py-1 rounded-lg hover:bg-white/5"
                        >
                            {copied ? (
                                <>
                                    <Check size={10} /> 已复制
                                </>
                            ) : (
                                <>
                                    <Copy size={10} /> 一键复制
                                </>
                            )}
                        </button>
                    </div>
                    <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                        {nbaResult}
                    </div>
                </div>
            )}
        </div>
    )
}
