/**
 * LeaderPage.tsx — 📊 总裁全局作战大盘
 * ======================================
 * Streamlit app.py L2280-2500 还原:
 *   顶部 — 4 KPI / 中部 — 柱状图+环形图 / 底部 — SOS表+审批表
 *
 * Backend:
 *   GET /api/projects
 *   GET /api/sos
 *   GET /api/projects/pending
 */
import { useState, useEffect, useCallback } from "react"
import { api, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    Loader2, TrendingUp, TrendingDown, DollarSign,
    Target, Shield, Siren, CheckCircle2,
    Clock, UserCircle, FileText, ChevronRight,
} from "lucide-react"
import toast from "react-hot-toast"

/* ── Types ── */
interface SOSTicket {
    id: number
    ticket_no: string
    project_id: number
    client_query: string
    ai_brief: string
    status: string
    expert_reply: string | null
    resolved_by: string | null
    created_at: string
}

interface PendingProject {
    id: number
    name: string
    client: string
    owner_name: string
    stage: { value: string } | string
    created_at: string
}

/* ── Stage map ── */
const STAGE_MAP: Record<string, { label: string; color: string; css: string }> = {
    lead: { label: "线索", color: "bg-slate-500", css: "#64748b" },
    initial_contact: { label: "初期接触", color: "bg-blue-500", css: "#3b82f6" },
    proposal: { label: "方案报价", color: "bg-cyan-500", css: "#06b6d4" },
    negotiation: { label: "商务谈判", color: "bg-amber-500", css: "#f59e0b" },
    tech_stalemate: { label: "技术僵持", color: "bg-orange-500", css: "#f97316" },
    closing: { label: "逼单签约", color: "bg-purple-500", css: "#a855f7" },
    won: { label: "赢单", color: "bg-green-500", css: "#22c55e" },
    lost: { label: "丢单", color: "bg-red-500", css: "#ef4444" },
}

/* ── War zones ── */
const ZONE_DATA = [
    { name: "华东战区", value: 850, color: "from-blue-500 to-blue-400" },
    { name: "华南战区", value: 620, color: "from-emerald-500 to-emerald-400" },
    { name: "华北战区", value: 410, color: "from-amber-500 to-amber-400" },
    { name: "西南战区", value: 230, color: "from-purple-500 to-purple-400" },
]
const ZONE_MAX = Math.max(...ZONE_DATA.map((z) => z.value))

export function LeaderPage() {
    const user = useAuthStore((s) => s.user)
    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [sosTickets, setSOSTickets] = useState<SOSTicket[]>([])
    const [pendingProjects, setPendingProjects] = useState<PendingProject[]>([])
    const [loading, setLoading] = useState(true)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [projRes, sosRes] = await Promise.all([
                api.get("/api/projects"),
                api.get("/api/sos").catch(() => ({ data: [] })),
            ])
            setProjects(projRes.data)
            setSOSTickets(sosRes.data)
            try {
                const pendRes = await api.get("/api/projects/pending")
                setPendingProjects(pendRes.data)
            } catch (_e) { /* not VP */ }
        } catch (_e) { /* */ }
        finally { setLoading(false) }
    }, [])
    useEffect(() => { loadData() }, [loadData])

    /* ── KPI computations ── */
    const getStage = (p: ProjectDTO) => {
        const s = p.stage
        return typeof s === "object" && s !== null ? (s as { value: string }).value : (s as string)
    }
    const activeProjects = projects.filter((p) => { const s = getStage(p); return s !== "won" && s !== "lost" })
    const wonProjects = projects.filter((p) => getStage(p) === "won")
    const avgWinRate = projects.length > 0
        ? Math.round(projects.reduce((acc, p) => acc + (p.win_rate || 0), 0) / projects.length)
        : 0
    const urgentSOS = sosTickets.filter((t) => t.status === "urgent").length

    /* Stage distribution for ring chart */
    const stageCounts: Record<string, number> = {}
    projects.forEach((p) => { const s = getStage(p) || "lead"; stageCounts[s] = (stageCounts[s] || 0) + 1 })
    const totalForRing = projects.length || 1

    let cumulativePct = 0
    const ringData = Object.entries(STAGE_MAP)
        .map(([key, meta]) => ({ key, ...meta, count: stageCounts[key] || 0 }))
        .filter((s) => s.count > 0)
        .map((seg) => {
            const pct = (seg.count / totalForRing) * 100
            const start = cumulativePct
            cumulativePct += pct
            return { ...seg, pct, start }
        })

    const conicStops = ringData.map((seg) => `${seg.css} ${seg.start}% ${seg.start + seg.pct}%`).join(", ")

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-white/20" />
            </div>
        )
    }

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
            {/* ═══ Header ═══ */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center text-xl">📊</div>
                <div>
                    <h1 className="text-xl font-bold text-white/90">总裁全局作战大盘</h1>
                    <p className="text-xs text-white/40 mt-0.5">实时监控全盘商机、战区火力与团队战斗力。数据已与各模块底层打通。</p>
                </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* ═══ 1. KPI Cards ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard icon={<DollarSign size={16} />} label="本月预估营收" value={`¥${(wonProjects.length * 320 + activeProjects.length * 85)}万`} delta="+12%" up accent="from-emerald-500/15 to-emerald-500/5" />
                <KPICard icon={<Target size={16} />} label="活跃作战项目" value={`${activeProjects.length} 个`} delta={`+${Math.max(1, Math.floor(activeProjects.length * 0.2))} vs上月`} up accent="from-blue-500/15 to-blue-500/5" />
                <KPICard icon={<Shield size={16} />} label="全局平均赢率" value={`${avgWinRate}%`} delta="+5% vs上季" up={avgWinRate >= 50} accent="from-amber-500/15 to-amber-500/5" />
                <KPICard icon={<Siren size={16} />} label="待处理 SOS 预警" value={`${urgentSOS} 条`} delta={urgentSOS > 0 ? "需立即处置" : "天下太平"} up={urgentSOS === 0} accent="from-red-500/15 to-red-500/5" />
            </div>

            {/* ═══ 2. Charts Row ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar chart */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white/70">🏢 战区业绩火力排行 (预估商机金额·万)</h3>
                    <div className="space-y-3">
                        {ZONE_DATA.map((zone) => (
                            <div key={zone.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-white/50">{zone.name}</span>
                                    <span className="text-white/70 font-bold">¥{zone.value}万</span>
                                </div>
                                <div className="w-full h-6 rounded-lg bg-white/[0.04] overflow-hidden">
                                    <div className={`h-full rounded-lg bg-gradient-to-r ${zone.color} transition-all duration-1000 ease-out`}
                                        style={{ width: `${(zone.value / ZONE_MAX) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ring chart */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white/70">📊 项目阶段分布 (环形图)</h3>
                    <div className="flex items-center gap-6">
                        <div className="relative w-36 h-36 shrink-0">
                            <div className="w-full h-full rounded-full"
                                style={{ background: ringData.length > 0 ? `conic-gradient(${conicStops})` : "conic-gradient(#334155 0% 100%)" }} />
                            <div className="absolute inset-3 rounded-full bg-[hsl(222,47%,9%)] flex flex-col items-center justify-center">
                                <span className="text-lg font-bold text-white/80">{projects.length}</span>
                                <span className="text-[9px] text-white/30">总项目</span>
                            </div>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                            {ringData.map((seg) => (
                                <div key={seg.key} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-sm ${seg.color}`} />
                                    <span className="text-[10px] text-white/40">{seg.label}</span>
                                    <span className="text-[10px] text-white/60 font-bold ml-auto">{seg.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ 3. Bottom: Data Tables ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table A: SOS Alerts */}
                <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.02] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white/70 flex items-center gap-1.5"><Siren size={14} className="text-red-400" /> 🚨 全量 SOS 预警</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400">{sosTickets.length} 条</span>
                    </div>
                    {sosTickets.length === 0 ? (
                        <div className="text-center py-8 text-xs text-white/15">☕ 天下太平，暂无 SOS 工单</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-white/5 text-white/30">
                                        <th className="text-left py-2 font-medium">工单号</th>
                                        <th className="text-left py-2 font-medium">状态</th>
                                        <th className="text-left py-2 font-medium">前线阻击</th>
                                        <th className="text-left py-2 font-medium">时间</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sosTickets.map((t) => (
                                        <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                                            <td className="py-2 text-white/50 font-mono text-[10px]">{t.ticket_no}</td>
                                            <td className="py-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.status === "urgent" ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"
                                                    }`}>
                                                    {t.status === "urgent" ? "🔴 紧急" : "🟢 已支援"}
                                                </span>
                                            </td>
                                            <td className="py-2 text-white/40 max-w-[200px] truncate">{t.client_query}</td>
                                            <td className="py-2 text-white/20 text-[10px]">{new Date(t.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Table B: Pending Approvals */}
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.02] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white/70 flex items-center gap-1.5"><FileText size={14} className="text-amber-400" /> 📋 待办审批</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">{pendingProjects.length} 项</span>
                    </div>
                    {pendingProjects.length === 0 ? (
                        <div className="text-center py-8 text-xs text-white/15">🎉 暂无积压待审项目</div>
                    ) : (
                        <div className="space-y-2">
                            {pendingProjects.map((p) => (
                                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/15 transition group">
                                    <div className="flex items-center gap-2.5">
                                        <Clock size={12} className="text-amber-400/50" />
                                        <div>
                                            <div className="text-xs text-white/60 font-bold">{p.name}</div>
                                            <div className="text-[10px] text-white/20">{p.client} · {p.owner_name || "—"}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={async () => {
                                            try {
                                                await api.post(`/api/projects/${p.id}/approve`)
                                                toast.success(`✅ 项目【${p.name}】已批准！`)
                                                loadData()
                                            } catch (_e) { toast.error("审批失败") }
                                        }} className="px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-bold hover:bg-green-500/20 transition">
                                            <CheckCircle2 size={10} className="inline mr-0.5" />批准
                                        </button>
                                        <ChevronRight size={12} className="text-white/10 group-hover:text-white/30 transition" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Team Leaderboard ═══ */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                <h3 className="text-sm font-bold text-white/70">🎖️ 销售团队战力实时排行</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/5 text-white/30">
                                <th className="text-left py-2 font-medium">排名</th>
                                <th className="text-left py-2 font-medium">销售姓名</th>
                                <th className="text-left py-2 font-medium">跟进项目</th>
                                <th className="text-left py-2 font-medium">赢率</th>
                                <th className="text-left py-2 font-medium">状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { rank: "🥇", name: user?.name || "张伟", count: activeProjects.length, rate: `${avgWinRate}%`, status: avgWinRate >= 60 ? "🔥 爆单" : "✅ 正常" },
                                { rank: "🥈", name: "李思远", count: 3, rate: "60%", status: "✅ 正常" },
                                { rank: "🥉", name: "王建国", count: 6, rate: "15%", status: "⚠️ 需辅导" },
                            ].map((row, i) => (
                                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                                    <td className="py-2.5 text-white/60">{row.rank}</td>
                                    <td className="py-2.5 text-white/70 font-bold flex items-center gap-1.5"><UserCircle size={14} className="text-white/20" />{row.name}</td>
                                    <td className="py-2.5 text-white/40">{row.count} 个</td>
                                    <td className="py-2.5 text-white/50">{row.rate}</td>
                                    <td className="py-2.5 text-xs">{row.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

/* ── KPI Card Component ── */
function KPICard({ icon, label, value, delta, up, accent }: {
    icon: React.ReactNode; label: string; value: string; delta: string; up: boolean; accent: string
}) {
    return (
        <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accent} p-4 space-y-2 hover:border-white/20 transition`}>
            <div className="flex items-center justify-between">
                <span className="text-white/30">{icon}</span>
                {up
                    ? <TrendingUp size={14} className="text-green-400/70" />
                    : <TrendingDown size={14} className="text-red-400/70" />}
            </div>
            <div className="text-xl font-bold text-white/85">{value}</div>
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">{label}</span>
                <span className={`text-[10px] font-bold ${up ? "text-green-400/60" : "text-red-400/60"}`}>{up ? "↑" : "↓"} {delta}</span>
            </div>
        </div>
    )
}
