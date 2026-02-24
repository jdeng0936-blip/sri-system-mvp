/**
 * ➕ 新建作战项目 — 完整 3 步向导
 * 原版 app.py L412-727 100% 复刻
 *
 * Step 1: 锁定终端客户 — 搜索下拉(已有客户) + 手动新增
 * Step 2: 确立作战项目 — 该客户下已有项目 or 新建
 * Step 3: 关联生态伙伴 — 设计院搜索下拉(8 预设 + 历史) + 总包
 *
 * 提报人 = 当前登录用户 (auto-fill)
 * 撞单查重 = 客户名模糊匹配 + 申诉通道
 */

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

interface ProjectCreatorProps {
    onCreated?: (projectId: number, projectName: string) => void
}

interface ProjectRecord {
    id: number; name: string; stage: string
    client: string; design_institute: string
    applicant: string; dept: string
}

const STAGE_OPTIONS = ["线索", "初期接触", "技术交流", "报价谈判", "招投标", "签约"]
const DEPT_OPTIONS = ["华东区", "华南区", "华北区", "西南区", "海外事业部", "直营"]

// 原版 app.py L488-497 预设行业头部设计院
const PRESET_DESIGNS = [
    "中国石化工程建设公司 (SEI)",
    "华陆工程科技 (原化工部第六设计院)",
    "中国寰球工程公司 (HQCEC)",
    "中国天辰工程 (TCC)",
    "赛鼎工程 (原化工部第二设计院)",
    "中建三局",
    "中建八局",
    "华东建筑设计研究院",
]

// ── 搜索式下拉组件 ──
function SearchableSelect({ options, value, onChange, placeholder, label }: {
    options: string[]; value: string; onChange: (v: string) => void
    placeholder: string; label: string
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const ref = useRef<HTMLDivElement>(null)

    const filtered = useMemo(() => {
        if (!search.trim()) return options
        const q = search.toLowerCase()
        return options.filter(o => o.toLowerCase().includes(q))
    }, [options, search])

    // click-outside close
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    // Enter key: select exact match or first filtered result
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault()
            const q = search.trim()
            if (!q) return
            // prefer exact match (case-insensitive)
            const exact = filtered.find(o => o.toLowerCase() === q.toLowerCase())
            const pick = exact || (filtered.length > 0 ? filtered[0] : null)
            if (pick) {
                onChange(pick)
                setOpen(false)
                setSearch("")
            }
        }
    }

    const inputClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="space-y-1" ref={ref}>
            <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    value={open ? search : value}
                    placeholder={placeholder}
                    className={inputClass}
                    onFocus={() => { setOpen(true); setSearch("") }}
                    onChange={e => { setSearch(e.target.value); setOpen(true) }}
                    onKeyDown={handleKeyDown}
                />
                {open && search.trim() && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-40 overflow-y-auto rounded-md border border-[hsl(var(--border))]/50 bg-[hsl(var(--card))] shadow-lg">
                        {filtered.length > 0 ? filtered.map(opt => (
                            <button
                                key={opt}
                                className="w-full text-left px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--primary))]/10 transition-colors"
                                onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); setSearch("") }}
                            >
                                {opt}
                            </button>
                        )) : (
                            <p className="px-2.5 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                                无匹配客户，请使用「手动录入新客户」
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export function ProjectCreator({ onCreated }: ProjectCreatorProps) {
    const { user } = useAuth()

    // ── Data from API ──
    const [allProjects, setAllProjects] = useState<ProjectRecord[]>([])

    useEffect(() => {
        fetch("http://localhost:8000/api/projects")
            .then(r => r.json())
            .then((data: ProjectRecord[]) => setAllProjects(data))
            .catch(() => { })
    }, [])

    // ── Derived lists for searchable dropdowns ──
    const existingClients = useMemo(() => {
        const set = new Set(allProjects.map(p => p.client).filter(Boolean))
        return Array.from(set).sort()
    }, [allProjects])

    const existingDesigns = useMemo(() => {
        const fromProjects = allProjects.map(p => p.design_institute).filter(Boolean)
        const merged = new Set([...PRESET_DESIGNS, ...fromProjects])
        return Array.from(merged).sort()
    }, [allProjects])

    // ── Step state ──
    const [step, setStep] = useState(1)

    // Step 1: Client
    const [clientMode, setClientMode] = useState<"select" | "manual">("select")
    const [selectedClient, setSelectedClient] = useState("")
    const [manualClient, setManualClient] = useState("")
    const client = clientMode === "manual" ? manualClient : selectedClient

    // Step 2: Project
    const [projectMode, setProjectMode] = useState<"new" | "existing">("new")
    const [projectName, setProjectName] = useState("")
    const [selectedExistingProject, setSelectedExistingProject] = useState("")

    // Projects under the current client
    const clientProjects = useMemo(() => {
        if (!client) return []
        return allProjects.filter(p => p.client === client).map(p => p.name)
    }, [allProjects, client])

    // Step 3: Ecosystem
    const [designMode, setDesignMode] = useState<"select" | "manual" | "none">("select")
    const [selectedDesign, setSelectedDesign] = useState("")
    const [manualDesign, setManualDesign] = useState("")
    const designInstitute = designMode === "manual" ? manualDesign : designMode === "none" ? "" : selectedDesign
    const [generalContractor, setGeneralContractor] = useState("")

    // Meta fields
    const [stage, setStage] = useState(STAGE_OPTIONS[0])
    const [dept, setDept] = useState(DEPT_OPTIONS[0])
    // 提报人 = 当前登录用户 (auto-fill, readonly)
    const applicant = user?.name || "当前用户"

    // Form state
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState("")
    const [expanded, setExpanded] = useState(false)

    // ── 审批流状态 ──
    const [conflict, setConflict] = useState<{
        project: string; type: string; owner: string
    } | null>(null)
    const [appealReason, setAppealReason] = useState("")
    const [appealSaving, setAppealSaving] = useState(false)

    // ── Progress when client is set ──
    useEffect(() => { if (client && step === 1) setStep(2) }, [client, step])
    useEffect(() => {
        const name = projectMode === "new" ? projectName : selectedExistingProject
        if (name && step === 2) setStep(3)
    }, [projectName, selectedExistingProject, projectMode, step])

    const finalProjectName = projectMode === "new" ? projectName : selectedExistingProject
    const fullProjectId = client && finalProjectName ? `${client} - ${finalProjectName}` : ""
    const isNewProject = projectMode === "new"

    function resetForm() {
        setStep(1); setClientMode("select"); setSelectedClient(""); setManualClient("")
        setProjectMode("new"); setProjectName(""); setSelectedExistingProject("")
        setDesignMode("select"); setSelectedDesign(""); setManualDesign("")
        setGeneralContractor(""); setConflict(null); setAppealReason("")
        fetch("http://localhost:8000/api/projects")
            .then(r => r.json()).then((d: ProjectRecord[]) => setAllProjects(d)).catch(() => { })
    }

    async function handleSubmit() {
        if (!fullProjectId) { setMsg("❌ 请先完成客户和项目信息"); return }
        setSaving(true); setMsg(""); setConflict(null)

        try {
            const res = await fetch("http://localhost:8000/api/projects/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fullProjectId,
                    client: client.trim(),
                    applicant,
                    stage, dept,
                    design_institute: designInstitute.trim(),
                    general_contractor: generalContractor.trim(),
                }),
            })
            const data = await res.json()
            if (data.conflict) {
                // 撞单拦截
                setConflict({
                    project: data.conflictProject,
                    type: data.conflictType,
                    owner: data.conflictOwner,
                })
            } else if (data.success) {
                setMsg(`✅ ${data.message}`)
                resetForm()
            } else {
                setMsg(`❌ ${data.error || "提交失败"}`)
            }
        } catch (e) { setMsg(`❌ 网络错误: ${e}`) }
        setSaving(false)
        setTimeout(() => setMsg(""), 8000)
    }

    async function handleAppeal() {
        if (!appealReason.trim()) { setMsg("⚠️ 驳回：请必须填写申诉依据！"); return }
        setAppealSaving(true); setMsg("")
        try {
            const res = await fetch("http://localhost:8000/api/projects/appeal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    new_project: fullProjectId,
                    conflict_with: conflict?.project || "",
                    original_owner: conflict?.owner || "",
                    applicant,
                    reason: appealReason,
                    has_evidence: false,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setMsg(`✅ ${data.message}`)
                setConflict(null); setAppealReason("")
                resetForm()
            } else {
                setMsg(`❌ ${data.error || "申诉失败"}`)
            }
        } catch (e) { setMsg(`❌ 网络错误: ${e}`) }
        setAppealSaving(false)
        setTimeout(() => setMsg(""), 8000)
    }

    const inputClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
    const selectClass = inputClass

    return (
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        ➕ 新建作战项目
                        <Badge variant="outline" className="text-[9px]">登记/申报</Badge>
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))] text-xs">{expanded ? "▲" : "▼"}</span>
                </CardTitle>
            </CardHeader>
            {expanded && (
                <CardContent className="space-y-4">

                    {/* ── Step 1: 锁定客户 ── */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-[hsl(var(--primary))]">📝 第一步：锁定终端客户</p>

                        {/* Mode switch */}
                        <div className="flex gap-1.5">
                            <button onClick={() => setClientMode("select")} className={cn(
                                "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                clientMode === "select" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                            )}>🔍 搜索已有客户</button>
                            <button onClick={() => setClientMode("manual")} className={cn(
                                "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                clientMode === "manual" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                            )}>➕ 手动录入新客户</button>
                        </div>

                        {clientMode === "select" ? (
                            <SearchableSelect
                                options={existingClients}
                                value={selectedClient}
                                onChange={v => { setSelectedClient(v); setStep(2) }}
                                placeholder="🔍 键入搜索客户名称..."
                                label="🏢 客户/企业名称"
                            />
                        ) : (
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">✍️ 输入新客户全称</label>
                                <input type="text" value={manualClient} onChange={e => setManualClient(e.target.value)} placeholder="例：万华化学" className={inputClass} />
                            </div>
                        )}

                        {/* 撞单风险提示：手动输入时模糊匹配已有客户 */}
                        {clientMode === "manual" && manualClient.trim().length >= 2 && (() => {
                            const q = manualClient.trim().toLowerCase()
                            const hits = existingClients.filter(c => c.toLowerCase().includes(q) || q.includes(c.toLowerCase()))
                            return hits.length > 0 ? (
                                <div className="flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5">
                                    <span className="text-amber-400 text-xs leading-none mt-0.5">⚠️</span>
                                    <div>
                                        <p className="text-[10px] font-medium text-amber-400">撞单风险提示</p>
                                        <p className="text-[10px] text-amber-400/80">系统中已存在相似客户：{hits.join("、")}</p>
                                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">请确认是否为同一客户，避免重复立项。如需使用已有客户请切换至"搜索已有客户"。</p>
                                    </div>
                                </div>
                            ) : null
                        })()}
                    </div>

                    {/* ── Step 2: 确立项目 ── */}
                    {step >= 2 && client && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-[hsl(var(--primary))]">🎯 第二步：确立作战项目</p>

                            {clientProjects.length > 0 && (
                                <div className="flex gap-1.5">
                                    <button onClick={() => setProjectMode("new")} className={cn(
                                        "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                        projectMode === "new" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                    )}>➕ 新建项目</button>
                                    <button onClick={() => setProjectMode("existing")} className={cn(
                                        "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                        projectMode === "existing" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                    )}>📂 调用历史项目</button>
                                </div>
                            )}

                            {projectMode === "new" ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">🏗️ 新项目名称</label>
                                    <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="例：二期 MDI 技改项目" className={inputClass} />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">🏗️ 选择已有项目</label>
                                    <select value={selectedExistingProject} onChange={e => setSelectedExistingProject(e.target.value)} className={selectClass}>
                                        <option value="">请选择...</option>
                                        {clientProjects.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 3: 关联生态 + 元信息 ── */}
                    {step >= 3 && finalProjectName && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-semibold text-[hsl(var(--primary))]">🤝 第三步：关联生态伙伴 & 元信息</p>

                            <div className="grid grid-cols-2 gap-3">
                                {/* 提报人 - readonly, auto-filled */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">👤 提报人</label>
                                    <input type="text" value={applicant} readOnly className={cn(inputClass, "opacity-70 cursor-not-allowed")} />
                                </div>

                                {/* 所属战区 */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">📍 所属战区</label>
                                    <select value={dept} onChange={e => setDept(e.target.value)} className={selectClass}>
                                        {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>

                                {/* 项目阶段 */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">📊 项目阶段</label>
                                    <select value={stage} onChange={e => setStage(e.target.value)} className={selectClass}>
                                        {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {/* 总包方 */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">🔧 总包方</label>
                                    <input type="text" value={generalContractor} onChange={e => setGeneralContractor(e.target.value)} placeholder="选填" className={inputClass} />
                                </div>
                            </div>

                            {/* 设计院 — 搜索式下拉 */}
                            <div className="space-y-1.5">
                                <div className="flex gap-1.5">
                                    <button onClick={() => setDesignMode("select")} className={cn(
                                        "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                        designMode === "select" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                    )}>🔍 搜索设计院</button>
                                    <button onClick={() => setDesignMode("manual")} className={cn(
                                        "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                        designMode === "manual" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                    )}>✍️ 手动录入</button>
                                    <button onClick={() => setDesignMode("none")} className={cn(
                                        "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                        designMode === "none" ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                    )}>🚫 暂无</button>
                                </div>

                                {designMode === "select" && (
                                    <SearchableSelect
                                        options={existingDesigns}
                                        value={selectedDesign}
                                        onChange={setSelectedDesign}
                                        placeholder="🔍 搜索行业院所 (选填)"
                                        label="📐 设计院/总包"
                                    />
                                )}
                                {designMode === "manual" && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">✍️ 设计院全称</label>
                                        <input type="text" value={manualDesign} onChange={e => setManualDesign(e.target.value)} placeholder="例：浙江省天正设计工程有限公司" className={inputClass} />
                                    </div>
                                )}
                                {designInstitute && <p className="text-[10px] text-emerald-400">✅ 已关联：{designInstitute}</p>}
                            </div>

                            {/* Full project ID preview */}
                            {fullProjectId && (
                                <div className="bg-[hsl(var(--background))]/50 rounded-md p-2 text-center">
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">项目全称预览</p>
                                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">{fullProjectId}</p>
                                </div>
                            )}

                            {/* ── 审批按钮 / 撞单拦截 / 申诉 UI ── */}
                            {isNewProject ? (
                                <>
                                    {/* 提交按钮 (仅新建项目) */}
                                    {!conflict && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="w-full text-xs"
                                            disabled={saving || !fullProjectId}
                                            onClick={handleSubmit}
                                        >
                                            {saving ? "⏳ 查重 & 提报中..." : "🚀 提交立项审核并查重"}
                                        </Button>
                                    )}

                                    {/* 🚨 撞单拦截 UI */}
                                    {conflict && (
                                        <div className="space-y-2">
                                            <div className="bg-red-500/10 border border-red-500/40 rounded-md p-3 space-y-1">
                                                <p className="text-xs font-semibold text-red-400">🚨 AI 撞单拦截！</p>
                                                <p className="text-[10px] text-red-400/90">
                                                    系统侦测到您提报的客户与以下项目高度相似：
                                                </p>
                                                <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                                                    【{conflict.project}】（{conflict.type}）
                                                </p>
                                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                    当前归属权：<span className="text-[hsl(var(--foreground))] font-medium">{conflict.owner}</span>
                                                </p>
                                            </div>

                                            {/* ⚖️ 申诉表单 */}
                                            <div className="border border-[hsl(var(--border))]/50 rounded-md p-3 space-y-2">
                                                <p className="text-[10px] font-semibold text-[hsl(var(--foreground))]">⚖️ 提起归属权复核申诉</p>
                                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                    如果您确信这是不同的标段，或您掌握了更核心的独家关系，请提交证据由 VP 裁决。
                                                </p>
                                                <textarea
                                                    value={appealReason}
                                                    onChange={e => setAppealReason(e.target.value)}
                                                    placeholder="例如：虽是同客户，但我这是三期扩建独立标段，且我有关键人微信证明..."
                                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] resize-none h-20"
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="flex-1 text-xs"
                                                        disabled={appealSaving || !appealReason.trim()}
                                                        onClick={handleAppeal}
                                                    >
                                                        {appealSaving ? "⏳ 提交中..." : "📨 提交证据至 VP 仲裁法庭"}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => setConflict(null)}
                                                    >
                                                        取消
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // 如果调用的是老项目，隐藏审批按钮
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-md px-3 py-2">
                                    <p className="text-[10px] text-blue-400">
                                        💡 该项目已是正式在建项目。请直接在【⚔️ 前线】沙盘中调取并录入现场情报。
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {msg && (
                        <p className={cn("text-[10px]", msg.startsWith("✅") ? "text-emerald-400" : msg.startsWith("⚠️") ? "text-amber-400" : "text-red-400")}>{msg}</p>
                    )}
                </CardContent>
            )}
        </Card>
    )
}
