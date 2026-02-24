/**
 * IntelTimeline.tsx — 战役情报时间轴
 * ====================================
 * 四象限布局:
 *  1. 👥 关键人物图谱 (from stakeholders)
 *  2. ⚔️ 竞争对手动态 (from parsed intel logs)
 *  3. 🚨 缺口情报雷达 (from gap_alerts)
 *  4. 📅 下一步行动 (from next_steps)
 *  5. 📜 历史情报时间轴 (full log list)
 */

import { useState, useEffect } from "react"
import { fetchIntelLogs, fetchStakeholders, type IntelLogDTO, type StakeholderRow } from "@/lib/apiClient"
import {
    Users,
    Swords,
    AlertTriangle,
    Target,
    Clock,
    ChevronDown,
    ChevronUp,
    FileText,
    CheckCircle2,
    Loader2,
} from "lucide-react"

interface ParsedLog {
    current_status?: string
    decision_chain?: { name: string; title: string; attitude: string }[]
    competitor_info?: { name: string; strengths?: string; weaknesses?: string; recent_actions?: string }[]
    next_steps?: string
    gap_alerts?: string[]
}

function safeParse(json?: string): ParsedLog {
    if (!json) return {}
    try { return JSON.parse(json) } catch { return {} }
}

export function IntelTimeline({ projectId }: { projectId: number }) {
    const [logs, setLogs] = useState<IntelLogDTO[]>([])
    const [stakeholders, setStakeholders] = useState<StakeholderRow[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedLog, setExpandedLog] = useState<number | null>(null)

    useEffect(() => {
        setLoading(true)
        Promise.all([
            fetchIntelLogs(projectId).catch(() => []),
            fetchStakeholders(projectId).catch(() => []),
        ]).then(([l, s]) => {
            setLogs(l)
            setStakeholders(s)
            setLoading(false)
        })
    }, [projectId])

    const parsedLogs = logs.map((l) => safeParse(l.ai_parsed_json))

    // Aggregate competitors
    const compPool: Record<string, string[]> = {}
    parsedLogs.forEach((p) => {
        ; (p.competitor_info || []).forEach((c) => {
            const name = c.name?.trim()
            if (!name) return
            if (!compPool[name]) compPool[name] = []
            if (c.recent_actions) compPool[name].push(c.recent_actions)
        })
    })

    // Aggregate gap alerts
    const allGaps: string[] = []
    parsedLogs.forEach((p) => {
        ; (p.gap_alerts || []).forEach((g) => {
            if (g && !allGaps.includes(g)) allGaps.push(g)
        })
    })

    // Aggregate next steps
    const nextSteps: { step: string; time: string }[] = []
    logs.forEach((log, idx) => {
        const ns = parsedLogs[idx]?.next_steps?.trim()
        if (ns) nextSteps.push({ step: ns, time: log.created_at })
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-white/30">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">加载情报数据...</span>
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📜</span>
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                    战役情报时间轴
                </h3>
                <div className="flex-1 h-px bg-white/5" />
                <div className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/40">
                    📊 累计 {logs.length} 条情报
                </div>
            </div>

            {logs.length === 0 && stakeholders.length === 0 ? (
                <div className="text-center py-8 text-white/20">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <div className="text-sm">暂无情报数据</div>
                    <div className="text-[10px] mt-1">请在上方【情报雷达】中录入拜访纪要</div>
                </div>
            ) : (
                <>
                    {/* 四象限 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Q1: 关键人物 */}
                        <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-blue-400/80">
                                <Users size={13} />
                                关键人物图谱
                            </div>
                            {stakeholders.length > 0 ? (
                                <div className="space-y-2">
                                    {stakeholders.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <div>
                                                <span className="font-medium text-white/70">{s.name}</span>
                                                <span className="text-white/30 ml-2">{s.title} · {s.role}</span>
                                            </div>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.attitude === "支持" ? "bg-green-500/15 text-green-400" :
                                                    s.attitude === "反对" ? "bg-red-500/15 text-red-400" :
                                                        "bg-yellow-500/15 text-yellow-400"
                                                }`}>
                                                {s.attitude} w={s.influence}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-white/20">暂未归档关键人物</div>
                            )}
                        </div>

                        {/* Q2: 竞争对手 */}
                        <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-red-400/80">
                                <Swords size={13} />
                                竞争对手动态
                            </div>
                            {Object.keys(compPool).length > 0 ? (
                                <div className="space-y-2">
                                    {Object.entries(compPool).map(([name, actions]) => (
                                        <div key={name} className="text-xs">
                                            <div className="font-medium text-white/70">🚨 {name}</div>
                                            {actions.map((a, i) => (
                                                <div key={i} className="text-white/40 ml-4">- {a}</div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-xs text-green-400/60">
                                    <CheckCircle2 size={12} />
                                    暂无明确竞争对手活动
                                </div>
                            )}
                        </div>

                        {/* Q3: 缺口预警 */}
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-amber-400/80">
                                <AlertTriangle size={13} />
                                缺口情报雷达
                            </div>
                            {allGaps.length > 0 ? (
                                <div className="space-y-1.5">
                                    {allGaps.map((g, i) => (
                                        <div key={i} className="text-xs text-amber-300/70 flex items-start gap-1.5">
                                            <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                                            {g}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-xs text-green-400/60">
                                    <CheckCircle2 size={12} />
                                    情报完备，暂无关键缺口
                                </div>
                            )}
                        </div>

                        {/* Q4: 下一步行动 */}
                        <div className="rounded-xl bg-green-500/5 border border-green-500/15 p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-green-400/80">
                                <Target size={13} />
                                下一步行动
                            </div>
                            {nextSteps.length > 0 ? (
                                <div className="space-y-1.5">
                                    {nextSteps.map((ns, i) => (
                                        <div key={i} className="text-xs text-white/50">
                                            📌 {ns.step}
                                            <span className="text-white/20 ml-2 text-[10px]">({new Date(ns.time).toLocaleDateString()})</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-white/20">暂无明确推进计划</div>
                            )}
                        </div>
                    </div>

                    {/* 历史情报时间轴 */}
                    {logs.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-white/50">
                                <Clock size={12} />
                                历史情报时间轴
                            </div>
                            {logs.map((log, idx) => {
                                const isExpanded = expandedLog === log.id
                                const parsed = parsedLogs[idx]
                                return (
                                    <div key={log.id} className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
                                        <button
                                            onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03] transition"
                                        >
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="text-white/30">{new Date(log.created_at).toLocaleString()}</span>
                                                <span className="text-white/50">记录 #{log.id}</span>
                                            </div>
                                            {isExpanded ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
                                        </button>
                                        {isExpanded && (
                                            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-[10px] font-bold text-white/40 mb-1">📝 原始流水账</div>
                                                    <div className="text-xs text-white/50 whitespace-pre-wrap bg-white/[0.02] rounded-lg p-3 max-h-[200px] overflow-y-auto">
                                                        {log.raw_input || "（无内容）"}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-white/40 mb-1">🤖 AI 结构化情报</div>
                                                    <div className="text-xs text-white/50 whitespace-pre-wrap bg-white/[0.02] rounded-lg p-3 max-h-[200px] overflow-y-auto font-mono">
                                                        {JSON.stringify(parsed, null, 2)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
