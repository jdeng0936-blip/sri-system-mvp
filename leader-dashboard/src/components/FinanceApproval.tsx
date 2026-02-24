/**
 * 💸 粮草审批 — 借款与费用追踪
 * 原版 app.py L2665-2800
 * Left: 发起资金申请 (类目联动/人员挂接/合规拦截)
 * Right: 审批流转中心 (4级审批链)
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

interface Project { id: number; name: string; stage: string }

interface ExpenseRequest {
    id: string
    project: string
    type: string
    amount: number
    reason: string
    applicant: string
    time: string
    status: string
    auditTrail: string[]
}

const EXPENSE_TYPES = ["差旅费", "招待费", "客情维护专属", "项目运作/招投标费"]
const STATUS_FLOW: Record<string, string> = {
    "待总监审批": "待VP审批",
    "待VP审批": "待总经理核准",
    "待总经理核准": "待财务打款",
    "待财务打款": "✅ 财务已打款闭环",
}

export function FinanceApproval() {
    const { user } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [expProject, setExpProject] = useState("")
    const [expType, setExpType] = useState(EXPENSE_TYPES[0])
    const [expAmount, setExpAmount] = useState("")
    const [expReason, setExpReason] = useState("")
    const [targetPerson, setTargetPerson] = useState("")
    const [requests, setRequests] = useState<ExpenseRequest[]>([])
    const [msg, setMsg] = useState("")

    const currentRole = user?.title || "一线销售"
    const currentUser = user?.name || "未知"

    useEffect(() => {
        fetch("http://localhost:8000/api/projects")
            .then(r => r.json())
            .then((data: Project[]) => {
                setProjects(data)
                if (data.length > 0) setExpProject(data[0].name)
            })
            .catch(() => { })
    }, [])

    function handleSubmit() {
        const amount = Number(expAmount)
        if (amount <= 0 || !expReason.trim()) {
            setMsg("⚠️ 金额必须大于0，且必须填写详细事由！")
            return
        }
        if (expType !== "差旅费" && !targetPerson.trim()) {
            setMsg("⚠️ 非差旅费用必须挂接目标人物！")
            return
        }

        const now = new Date()
        const reqId = `EXP-${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`

        const detailedReason = expType === "差旅费" ? `[差旅] ${expReason}` : `[定点作用于: ${targetPerson}] ${expReason}`

        const newReq: ExpenseRequest = {
            id: reqId,
            project: expProject,
            type: expType,
            amount,
            reason: detailedReason,
            applicant: currentUser,
            time: now.toLocaleString("zh-CN"),
            status: "待总监审批",
            auditTrail: [`[${currentUser}] 提交申请。`],
        }
        setRequests(prev => [...prev, newReq])
        setMsg(`✅ 申请已提交！流水号：${reqId}`)
        setExpAmount("")
        setExpReason("")
        setTargetPerson("")
        setTimeout(() => setMsg(""), 5000)
    }

    function handleApprove(reqId: string) {
        setRequests(prev => prev.map(r => {
            if (r.id === reqId) {
                const nextStatus = STATUS_FLOW[r.status] || r.status
                return {
                    ...r,
                    status: nextStatus,
                    auditTrail: [...r.auditTrail, `[${currentUser}] 已同意，流转至下一环节。`],
                }
            }
            return r
        }))
    }

    function handleReject(reqId: string) {
        setRequests(prev => prev.map(r =>
            r.id === reqId ? { ...r, status: "已驳回", auditTrail: [...r.auditTrail, `[${currentUser}] 驳回了该申请。`] } : r
        ))
    }

    const selectClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">💸 粮草战备库</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">FINANCE APPROVAL — 借款与费用追踪 / AI 实时监控资金效率与 ROI 风险</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: 发起申请 */}
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardHeader>
                            <CardTitle className="text-sm">📝 发起资金申请</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">📂 关联项目</label>
                                <select value={expProject} onChange={e => setExpProject(e.target.value)} className={selectClass}>
                                    {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🏷️ 资金类目</label>
                                <select value={expType} onChange={e => setExpType(e.target.value)} className={selectClass}>
                                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            {expType !== "差旅费" && (
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🎯 挂接目标人物</label>
                                    <input type="text" value={targetPerson} onChange={e => setTargetPerson(e.target.value)} placeholder="例：客户王总" className={selectClass} />
                                    <p className="text-[9px] text-amber-400">⚠️ 非差旅费用必须挂接具体的业务关联人员</p>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">💰 申请金额 (元)</label>
                                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} className={selectClass} min={0} step={500} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">✍️ 申请事由</label>
                                <textarea value={expReason} onChange={e => setExpReason(e.target.value)} placeholder="需请关键决策人王总吃饭，推进二期图纸确认..." className={`${selectClass} resize-none`} rows={3} />
                            </div>
                            <Button variant="default" className="w-full text-xs" onClick={handleSubmit}>
                                🚀 提交借款/费用申请
                            </Button>
                            {msg && <p className={cn("text-[10px]", msg.startsWith("✅") ? "text-emerald-400" : "text-amber-400")}>{msg}</p>}
                        </CardContent>
                    </Card>

                    {/* Right: 审批流转 */}
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                🏦 审批流转中心
                                <Badge variant="outline" className="text-[9px]">{currentRole}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {requests.length === 0 ? (
                                <p className="text-xs text-emerald-400">🎉 当前没有费用申请。</p>
                            ) : (
                                <div className="space-y-3">
                                    {requests.map(r => (
                                        <div key={r.id} className="bg-[hsl(var(--background))]/50 rounded-md p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Badge variant={r.status.includes("驳回") ? "destructive" : r.status.includes("✅") ? "success" : "outline"} className="text-[9px]">
                                                    {r.status}
                                                </Badge>
                                                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{r.id}</span>
                                            </div>
                                            <p className="text-xs text-[hsl(var(--foreground))]">{r.type} — ¥{r.amount.toLocaleString()}</p>
                                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">项目: {r.project} | 提报: {r.applicant}</p>
                                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">事由: {r.reason}</p>
                                            <div className="text-[9px] text-[hsl(var(--muted-foreground))] space-y-0.5">
                                                {r.auditTrail.map((t, i) => <p key={i}>{t}</p>)}
                                            </div>
                                            {r.status.includes("待") && (
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="default" className="flex-1 text-[10px]" onClick={() => handleApprove(r.id)}>✅ 同意流转</Button>
                                                    <Button size="sm" variant="destructive" className="flex-1 text-[10px]" onClick={() => handleReject(r.id)}>❌ 驳回</Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
