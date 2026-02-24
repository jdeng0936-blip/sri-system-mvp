/**
 * FinancePage.tsx — 💸 粮草战备库 (借款与费用追踪)
 * ==================================================
 * 左右双栏布局:
 *  左: 发起资金申请 (关联项目·资金类目·金额·事由)
 *  右: 审批流转中心 (待办卡片列表)
 *
 * 对标 Streamlit 原版 tab_finance: app.py lines 2660-2870
 * 目前使用前端 localStorage 模拟审批状态 (后端 SOS/expense 路由未覆盖)
 */

import { useState, useEffect, useCallback } from "react"
import { api, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    DollarSign,
    Send,
    Loader2,
    AlertTriangle,
    Check,
    Folder,
    Tag,
    Calendar,
    FileText,
    Target,
    ShieldCheck,
    ArrowRight,
    X,
} from "lucide-react"
import toast from "react-hot-toast"

// ── 费用申请数据结构 ──
interface ExpenseRequest {
    id: string
    project: string
    projectId: number
    type: string
    amount: number
    reason: string
    applicant: string
    dept: string
    time: string
    status: string
    targetPerson: string
    targetMonth: string
    auditTrail: string[]
}

const EXPENSE_TYPES = ["差旅费", "招待费", "客情维护专属", "项目运作/招投标费"]

const STATUS_FLOW: Record<string, { next: string; approverRole: string }> = {
    "待总监审批": { next: "待VP审批", approverRole: "director" },
    "待VP审批": { next: "待总经理核准", approverRole: "vp" },
    "待总经理核准": { next: "财务已执行", approverRole: "vp" },
}

const STATUS_COLORS: Record<string, string> = {
    "待总监审批": "text-amber-400 bg-amber-500/10 border-amber-500/20",
    "待VP审批": "text-blue-400 bg-blue-500/10 border-blue-500/20",
    "待总经理核准": "text-purple-400 bg-purple-500/10 border-purple-500/20",
    "财务已执行": "text-green-400 bg-green-500/10 border-green-500/20",
    "已驳回": "text-red-400 bg-red-500/10 border-red-500/20",
}

const STATUS_ICONS: Record<string, string> = {
    "待总监审批": "⏳",
    "待VP审批": "🔵",
    "待总经理核准": "🟣",
    "财务已执行": "✅",
    "已驳回": "❌",
}

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)

// ── localStorage 存取 ──
function loadExpenses(): ExpenseRequest[] {
    try {
        return JSON.parse(localStorage.getItem("sri_expenses") || "[]")
    } catch {
        return []
    }
}

function saveExpenses(reqs: ExpenseRequest[]) {
    localStorage.setItem("sri_expenses", JSON.stringify(reqs))
}

export function FinancePage() {
    const user = useAuthStore((s) => s.user)

    // ── Projects ──
    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
    const [loadingProjects, setLoadingProjects] = useState(false)

    // ── Form ──
    const [expType, setExpType] = useState(EXPENSE_TYPES[0])
    const [targetMonth, setTargetMonth] = useState(MONTHS[new Date().getMonth()])
    const [targetPerson, setTargetPerson] = useState("")
    const [amount, setAmount] = useState(0)
    const [reason, setReason] = useState("")
    const [submitting, setSubmitting] = useState(false)

    // ── Stakeholders for validation ──
    const [stakeholders, setStakeholders] = useState<string[]>([])
    const [loadingStakeholders, setLoadingStakeholders] = useState(false)

    // ── Expenses list ──
    const [expenses, setExpenses] = useState<ExpenseRequest[]>([])

    // ── Load projects ──
    const loadProjects = useCallback(async () => {
        setLoadingProjects(true)
        try {
            const { data } = await api.get("/api/projects")
            setProjects(data)
            if (data.length > 0 && !selectedProjectId) {
                setSelectedProjectId(data[0].id)
            }
        } catch {
            toast.error("加载项目列表失败")
        } finally {
            setLoadingProjects(false)
        }
    }, [selectedProjectId])

    useEffect(() => { loadProjects() }, [loadProjects])
    useEffect(() => { setExpenses(loadExpenses()) }, [])

    // ── Load stakeholders when project changes (for non 差旅费) ──
    useEffect(() => {
        if (!selectedProjectId || expType === "差旅费") return
        setLoadingStakeholders(true)
        api.get(`/api/projects/${selectedProjectId}/stakeholders`)
            .then(({ data }) => {
                const names = data.map((s: { name: string }) => s.name).filter(Boolean)
                setStakeholders(names)
                if (names.length > 0) setTargetPerson(names[0])
            })
            .catch(() => setStakeholders([]))
            .finally(() => setLoadingStakeholders(false))
    }, [selectedProjectId, expType])

    const selectedProject = projects.find((p) => p.id === selectedProjectId)

    // ── Submit expense ──
    const handleSubmit = async () => {
        if (!selectedProjectId || !selectedProject) { toast.error("请选择项目"); return }
        if (amount <= 0) { toast.error("金额必须大于 0"); return }
        if (!reason.trim()) { toast.error("必须填写申请事由"); return }
        if (expType !== "差旅费" && !targetPerson) {
            toast.error("⚠️ 提交失败：必须挂接具体的业务关联人员！")
            return
        }

        setSubmitting(true)
        // Simulate async
        await new Promise((r) => setTimeout(r, 500))

        const reqId = `EXP-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`

        let detailedReason = reason
        if (expType === "差旅费") {
            detailedReason = `[${targetMonth} 差旅] ${reason}`
        } else {
            detailedReason = `[定点作用于: ${targetPerson}] ${reason}`
        }

        const newReq: ExpenseRequest = {
            id: reqId,
            project: selectedProject.name,
            projectId: selectedProjectId,
            type: expType,
            amount,
            reason: detailedReason,
            applicant: user?.name || "未知",
            dept: user?.dept || "N/A",
            time: new Date().toLocaleString("zh-CN"),
            status: "待总监审批",
            targetPerson: expType === "差旅费" ? "" : targetPerson,
            targetMonth: expType === "差旅费" ? targetMonth : "",
            auditTrail: [`[${user?.name}] 提交申请。`],
        }

        const updated = [...expenses, newReq]
        setExpenses(updated)
        saveExpenses(updated)

        setAmount(0)
        setReason("")
        setSubmitting(false)
        toast.success(`✅ 申请已提交！流水号：${reqId}`)
    }

    // ── Approval actions ──
    const handleApprove = (reqId: string) => {
        setExpenses((prev) => {
            const updated = prev.map((r) => {
                if (r.id !== reqId) return r
                const flow = STATUS_FLOW[r.status]
                if (!flow) return r
                return {
                    ...r,
                    status: flow.next,
                    auditTrail: [...r.auditTrail, `[${user?.name}] 已审批通过 → ${flow.next}`],
                }
            })
            saveExpenses(updated)
            return updated
        })
        toast.success("✅ 审批通过")
    }

    const handleReject = (reqId: string) => {
        const note = prompt("驳回原因:")
        if (!note) return
        setExpenses((prev) => {
            const updated = prev.map((r) => {
                if (r.id !== reqId) return r
                return {
                    ...r,
                    status: "已驳回",
                    auditTrail: [...r.auditTrail, `[${user?.name}] 已驳回：${note}`],
                }
            })
            saveExpenses(updated)
            return updated
        })
        toast.success("❌ 已驳回")
    }

    // ── Filter visible requests ──
    const getVisibleRequests = () => {
        const role = user?.role
        return expenses.filter((r) => {
            if (role === "director" && r.status === "待总监审批" && r.dept === user?.dept) return true
            if (role === "vp" && (r.status === "待VP审批" || r.status === "待总经理核准")) return true
            if (role === "finance" && r.status === "待财务打款") return true
            if (role === "sales" && r.applicant === user?.name) return true
            // Admin sees all
            if (role === "admin") return true
            return false
        })
    }

    const visibleReqs = getVisibleRequests()
    const canSubmit = user?.role === "sales"
    const isTravelType = expType === "差旅费"

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-6">
            {/* ═══ Page Header ═══ */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center text-xl">
                        💸
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white/90">粮草战备库 (借款与费用追踪)</h1>
                        <p className="text-xs text-white/40 mt-0.5">
                            项目所有的血液(资金)消耗都在此留痕，AI 将实时监控资金效率与 ROI 风险
                        </p>
                    </div>
                </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* ═══ 双栏布局 ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ═══ 左栏: 发起资金申请 ═══ */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-green-400" />
                        <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">
                            📝 发起资金申请
                        </h2>
                    </div>

                    {canSubmit ? (
                        <>
                            {/* 关联项目 */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                                    <Folder size={11} /> 关联项目
                                </label>
                                <select
                                    value={selectedProjectId || ""}
                                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                                    disabled={loadingProjects}
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-green-500/40 focus:outline-none transition appearance-none cursor-pointer hover:bg-white/[0.06]"
                                >
                                    <option value="" className="bg-[hsl(222,47%,9%)]">-- 选择项目 --</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id} className="bg-[hsl(222,47%,9%)]">
                                            {p.name} — {p.client}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 资金类目 */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                                    <Tag size={11} /> 资金类目
                                </label>
                                <select
                                    value={expType}
                                    onChange={(e) => setExpType(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-green-500/40 focus:outline-none transition appearance-none cursor-pointer hover:bg-white/[0.06]"
                                >
                                    {EXPENSE_TYPES.map((t) => (
                                        <option key={t} value={t} className="bg-[hsl(222,47%,9%)]">{t}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 条件字段 */}
                            {isTravelType ? (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                                        <Calendar size={11} /> 归属月度
                                    </label>
                                    <select
                                        value={targetMonth}
                                        onChange={(e) => setTargetMonth(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-green-500/40 focus:outline-none transition appearance-none cursor-pointer hover:bg-white/[0.06]"
                                    >
                                        {MONTHS.map((m) => (
                                            <option key={m} value={m} className="bg-[hsl(222,47%,9%)]">{m}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                                        <Target size={11} /> 挂接目标人物 (仅限本项目已知人员)
                                    </label>
                                    {loadingStakeholders ? (
                                        <div className="flex items-center gap-2 text-xs text-white/30 py-3">
                                            <Loader2 size={12} className="animate-spin" /> 加载干系人...
                                        </div>
                                    ) : stakeholders.length > 0 ? (
                                        <select
                                            value={targetPerson}
                                            onChange={(e) => setTargetPerson(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-green-500/40 focus:outline-none transition appearance-none cursor-pointer hover:bg-white/[0.06]"
                                        >
                                            {stakeholders.map((s) => (
                                                <option key={s} value={s} className="bg-[hsl(222,47%,9%)]">{s}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/15 rounded-xl px-4 py-3">
                                            <AlertTriangle size={12} />
                                            <span>⚠️ 财务风控拦截：该项目尚未建立权力地图。请先在【作战沙盘 → 关键决策链】中添加具体人员，方可申请招待/客情费用！</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 申请金额 */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                                    <DollarSign size={11} /> 申请金额 (元)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400/60 text-sm font-bold">¥</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={500}
                                        value={amount || ""}
                                        onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                                        placeholder="0"
                                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm tabular-nums font-bold placeholder:text-white/15 focus:border-green-500/40 focus:outline-none transition hover:bg-white/[0.06]"
                                    />
                                </div>
                            </div>

                            {/* 申请事由 */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                                    ✍️ 申请事由
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="例如：需请关键决策人王总吃饭，推进二期图纸确认... (AI 将依据此判定资金效率)"
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm placeholder:text-white/15 focus:border-green-500/40 focus:outline-none transition resize-none hover:bg-white/[0.06] leading-relaxed"
                                />
                                <p className="text-[10px] text-white/20">AI 将依据此内容判定资金效率与 ROI 风险</p>
                            </div>

                            {/* 提交按钮 */}
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !selectedProjectId || amount <= 0 || (!isTravelType && !targetPerson)}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-red-500/20"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        提交中...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        🚀 提交借款/费用申请
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <ShieldCheck size={40} className="text-blue-400/40" />
                            <p className="text-sm text-blue-400/60 font-medium">💡 资金申请仅限前线销售人员发起</p>
                            <p className="text-xs text-white/30">您当前处于审批者/上帝视角</p>
                        </div>
                    )}
                </div>

                {/* ═══ 右栏: 审批流转中心 ═══ */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-purple-400" />
                            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">
                                🏦 审批流转中心
                            </h2>
                        </div>
                        <span className="text-[10px] text-white/20">
                            {visibleReqs.length} 条记录
                        </span>
                    </div>

                    {visibleReqs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Check size={40} className="text-green-400/30" />
                            <p className="text-sm text-green-400/50 font-medium">
                                🎉 当前您的待办/关注列表中没有费用申请
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                            {visibleReqs.map((req) => {
                                const statusColor = STATUS_COLORS[req.status] || STATUS_COLORS["待总监审批"]
                                const statusIcon = STATUS_ICONS[req.status] || "📋"
                                const canApprove = (
                                    (user?.role === "director" && req.status === "待总监审批" && req.dept === user.dept) ||
                                    (user?.role === "vp" && (req.status === "待VP审批" || req.status === "待总经理核准"))
                                )

                                return (
                                    <div key={req.id} className={`rounded-xl border p-4 space-y-3 ${statusColor.replace("text-", "").includes("green") ? "border-green-500/15 bg-green-500/[0.03]" : statusColor.replace("text-", "").includes("red") ? "border-red-500/15 bg-red-500/[0.03]" : "border-white/10 bg-white/[0.02]"}`}>
                                        {/* 头部 */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusColor}`}>
                                                    {statusIcon} {req.status}
                                                </span>
                                                <span className="text-xs text-white/60 font-bold">{req.type}</span>
                                                <span className="text-xs font-bold text-amber-400">¥{req.amount.toLocaleString()}</span>
                                            </div>
                                            <span className="text-[10px] text-white/20">{req.id}</span>
                                        </div>

                                        {/* 详情 */}
                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex items-center gap-1 text-white/40">
                                                <Folder size={10} /> 关联项目:
                                                <span className="text-white/70 font-medium">{req.project}</span>
                                            </div>
                                            <div className="text-white/50">
                                                <span className="text-white/30">申请事由:</span> {req.reason}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-white/25">
                                                <span>提报: {req.applicant}</span>
                                                <span>|</span>
                                                <span>战区: {req.dept}</span>
                                                <span>|</span>
                                                <span>{req.time}</span>
                                            </div>
                                        </div>

                                        {/* 审批轨迹 */}
                                        <div className="border-t border-white/5 pt-2">
                                            <div className="text-[10px] text-white/20 space-y-0.5">
                                                {req.auditTrail.map((trail, i) => (
                                                    <div key={i} className="flex items-center gap-1">
                                                        <ArrowRight size={8} className="text-white/10" />
                                                        {trail}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 审批按钮 */}
                                        {canApprove && (
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => handleApprove(req.id)}
                                                    className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                                                >
                                                    <Check size={12} /> 批准
                                                </button>
                                                <button
                                                    onClick={() => handleReject(req.id)}
                                                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                                                >
                                                    <X size={12} /> 驳回
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
