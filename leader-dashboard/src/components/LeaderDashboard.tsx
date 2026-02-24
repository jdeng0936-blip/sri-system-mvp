import React from "react"
import { useDashboardData } from "@/hooks/useDashboardData"
import { DashboardHeader } from "@/components/DashboardHeader"
import { KpiCardGrid } from "@/components/KpiCardGrid"
import { BattlefieldFunnel } from "@/components/BattlefieldFunnel"
import { CollectionProgress } from "@/components/CollectionProgress"
import { IntelFeed } from "@/components/IntelFeed"

interface PendingProject {
    id: number; client: string; project_name: string
    applicant: string; dept: string; time: string
}
interface Appeal {
    id: number; new_project: string; conflict_with: string
    applicant: string; original_owner: string; reason: string
    status: string; time: string
}
interface LeaderDashboardProps {
    readonly className?: string
}

export const LeaderDashboard: React.FC<Readonly<LeaderDashboardProps>> = ({
    className = "",
}) => {
    const { kpiCards, funnelStages, collectionItems, intelFeedItems, isLoading } =
        useDashboardData()

    // ── 从真实 API 拉取审批/仲裁数据 ──
    const [pendingProjects, setPendingProjects] = React.useState<PendingProject[]>([])
    const [appeals, setAppeals] = React.useState<Appeal[]>([])
    const [sosTickets, setSosTickets] = React.useState([
        { id: "SOS-001", project: "恒力石化", query: "客户突然要求延长质保至5年，我方标准只有2年！", brief: "需商务特批或寻找替代保障方案", status: "🔴 紧急待支援", time: "10:30", reply: "" },
    ])

    const fetchPending = React.useCallback(() => {
        fetch("http://localhost:8000/api/projects/pending")
            .then(r => r.json())
            .then(data => {
                setPendingProjects(data.pending || [])
                setAppeals(data.appeals || [])
            })
            .catch(() => { })
    }, [])

    // 首次加载 + 每 10 秒轮询
    React.useEffect(() => {
        fetchPending()
        const timer = setInterval(fetchPending, 10000)
        return () => clearInterval(timer)
    }, [fetchPending])

    // ── 审批操作 ──
    async function handleApprove(id: number) {
        try {
            await fetch("http://localhost:8000/api/projects/approve", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            })
            fetchPending()
        } catch { /* ignore */ }
    }
    async function handleReject(id: number) {
        try {
            await fetch("http://localhost:8000/api/projects/reject", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            })
            fetchPending()
        } catch { /* ignore */ }
    }

    if (isLoading) {
        return (
            <div className={`min-h-screen bg-[hsl(var(--background))] flex items-center justify-center ${className}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-full border-4 border-[hsl(var(--primary))]/30 border-t-[hsl(var(--primary))] animate-spin" />
                    </div>
                    <div className="text-[hsl(var(--muted-foreground))] text-sm tracking-wider animate-pulse">
                        🛰️ 正在加载作战态势数据...
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-[hsl(var(--background))] ${className}`}>
            {/* 渐变暗纹背景 */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_50%)] pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--destructive)/0.04),transparent_50%)] pointer-events-none" />

            {/* 内容层 */}
            <div className="relative z-10">
                {/* Header */}
                <DashboardHeader />

                {/* Main content area: grid layout */}
                <div className="p-6">
                    <div className="grid grid-cols-[1fr_1fr_380px] grid-rows-[auto_1fr] gap-4" style={{ minHeight: "calc(100vh - 250px)" }}>
                        {/* Row 1: KPI Cards span first 2 columns */}
                        <div className="col-span-2">
                            <KpiCardGrid cards={kpiCards} />
                        </div>

                        {/* Intel Feed: spans full height on right */}
                        <div className="row-span-2">
                            <IntelFeed items={intelFeedItems} className="h-full" />
                        </div>

                        {/* Row 2: Charts side by side */}
                        <div className="overflow-auto">
                            <BattlefieldFunnel stages={funnelStages} className="h-full" />
                        </div>
                        <div className="overflow-auto">
                            <CollectionProgress items={collectionItems} className="h-full" />
                        </div>
                    </div>

                    {/* ── 领导专属模块 (审批/SOS/仲裁) ── */}
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* 📋 立项审批 */}
                        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))]/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">📋 立项审批</h3>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{pendingProjects.length} 待审</span>
                            </div>
                            {pendingProjects.length === 0 ? (
                                <p className="text-xs text-emerald-400">✅ 当前无待审项目</p>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {pendingProjects.map((p) => (
                                        <div key={p.id} className="bg-[hsl(var(--background))]/50 rounded-md p-2.5 space-y-1.5">
                                            <p className="text-xs font-medium text-[hsl(var(--foreground))]">🎯 {p.project_name}</p>
                                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">提报: {p.applicant} | {p.dept} | {p.time}</p>
                                            <div className="flex gap-1.5">
                                                <button onClick={() => handleApprove(p.id)} className="flex-1 text-[10px] py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors">✅ 批准</button>
                                                <button onClick={() => handleReject(p.id)} className="flex-1 text-[10px] py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors">❌ 驳回</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 🚨 SOS 调度 */}
                        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))]/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">🚨 SOS 调度中心</h3>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{sosTickets.filter(t => t.status.includes("紧急")).length} 紧急</span>
                            </div>
                            {sosTickets.length === 0 ? (
                                <p className="text-xs text-emerald-400">☕ 天下太平</p>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {sosTickets.map((t, i) => (
                                        <div key={i} className="bg-[hsl(var(--background))]/50 rounded-md p-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-red-400">{t.status}</span>
                                                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{t.id}</span>
                                            </div>
                                            <p className="text-xs text-[hsl(var(--foreground))]">🗣️ {t.query}</p>
                                            <p className="text-[10px] text-amber-400">🎯 {t.brief}</p>
                                            {t.status.includes("紧急") && (
                                                <button onClick={() => setSosTickets(prev => prev.map((tk, j) => j === i ? { ...tk, status: "🟢 支援已送达" } : tk))} className="w-full text-[10px] py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors">🚀 投送弹药</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ⚖️ 撞单仲裁 */}
                        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))]/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">⚖️ 撞单仲裁法庭</h3>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{appeals.filter(a => a.status.includes("待")).length} 待裁</span>
                            </div>
                            {appeals.length === 0 ? (
                                <p className="text-xs text-emerald-400">⚖️ 战区和平</p>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {appeals.map((a, i) => (
                                        <div key={a.id || i} className="bg-[hsl(var(--background))]/50 rounded-md p-2.5 space-y-1.5">
                                            <p className="text-xs font-medium text-[hsl(var(--foreground))]">🔴 {a.new_project} 🆚 {a.conflict_with}</p>
                                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">申诉方: {a.applicant} | 守方: {a.original_owner}</p>
                                            <p className="text-[10px] text-blue-300">📝 {a.reason}</p>
                                            {a.status.includes("待") && (
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => setAppeals(prev => prev.map((ap, j) => j === i ? { ...ap, status: "✅ 胜诉转移" } : ap))} className="flex-1 text-[10px] py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30">✅ 申诉有效</button>
                                                    <button onClick={() => setAppeals(prev => prev.map((ap, j) => j === i ? { ...ap, status: "❌ 败诉驳回" } : ap))} className="flex-1 text-[10px] py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">❌ 驳回</button>
                                                </div>
                                            )}
                                            {!a.status.includes("待") && (
                                                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{a.status}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LeaderDashboard
