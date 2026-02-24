/**
 * DealDeskPage.tsx — 💰 智能报价与自动审批流水线
 * ================================================
 * 左右双栏布局:
 *  左: 询价文件解析 (AI 提取)
 *  右: 人工校对与制式报价 (BOM DataGrid + 提交审批)
 *
 * 后端: /api/dealdesk  (Create, PATCH BOM, Submit, Approve/Reject, Verify)
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { api, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    FileText,
    Upload,
    Brain,
    Loader2,
    Send,
    Trash2,
    Plus,
    Shield,
    Check,
    AlertTriangle,
    Eye,
    Package,
    RefreshCw,
} from "lucide-react"
import toast from "react-hot-toast"

// ── DTOs ──
interface BOMItemRow {
    product_model: string
    ai_extracted_qty: number
    sales_qty: number
    unit_price: number
    remark: string
}

interface DealDeskDTO {
    id: number
    project_id: number
    inquiry_client: string | null
    inquiry_contact: string | null
    status: "draft" | "pending" | "approved" | "rejected"
    submitted_by: string | null
    approved_by: string | null
    reject_reason: string | null
    total_amount: number
    tamper_hash: string | null
    diff_summary: string | null
    bom_items: {
        id: number
        product_model: string
        ai_extracted_qty: number
        sales_qty: number
        unit_price: number
        subtotal: number
        remark: string | null
    }[]
    created_at: string
    updated_at: string
    approved_at: string | null
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: "草稿", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: "📝" },
    pending: { label: "待审批", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: "⏳" },
    approved: { label: "已获批", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: "✅" },
    rejected: { label: "已驳回", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: "❌" },
}

const PRESET_CLIENTS = ["江苏大全", "上海正泰", "西门子", "施耐德", "ABB"]

export function DealDeskPage() {
    const user = useAuthStore((s) => s.user)

    // ── Project list ──
    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
    const [loadingProjects, setLoadingProjects] = useState(false)

    // ── Deal state ──
    const [currentDeal, setCurrentDeal] = useState<DealDeskDTO | null>(null)
    const [inquiryClient, setInquiryClient] = useState("")
    const [inquiryContact, setInquiryContact] = useState("")
    const [customClient, setCustomClient] = useState("")
    const [clientMode, setClientMode] = useState<"select" | "custom">("select")

    // ── BOM state ──
    const [bomRows, setBomRows] = useState<BOMItemRow[]>([])

    // ── UI state ──
    const [parsing, setParsing] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [files, setFiles] = useState<File[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

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

    // ── File handling ──
    const handleFiles = (newFiles: FileList | File[]) => {
        const accepted = Array.from(newFiles).filter((f) =>
            /\.(pdf|docx|doc|png|jpg|jpeg)$/i.test(f.name),
        )
        setFiles((prev) => [...prev, ...accepted])
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
    }

    // ── AI Parse ──
    const handleAIParse = async () => {
        if (!selectedProjectId) { toast.error("请先选择关联项目"); return }
        setParsing(true)
        try {
            // Simulate AI parsing — in production this calls the AI extract endpoint
            // For now, generate mock BOM data as the Streamlit version does
            await new Promise((r) => setTimeout(r, 1500))
            const mockBOM: BOMItemRow[] = [
                { product_model: "XGN15-12 环网柜", ai_extracted_qty: 8, sales_qty: 8, unit_price: 45000, remark: "" },
                { product_model: "GGD 低压开关柜", ai_extracted_qty: 12, sales_qty: 12, unit_price: 12000, remark: "" },
                { product_model: "KYN28A-12 中置柜", ai_extracted_qty: 4, sales_qty: 4, unit_price: 85000, remark: "" },
                { product_model: "SC(B)10 干式变压器", ai_extracted_qty: 2, sales_qty: 2, unit_price: 120000, remark: "" },
            ]
            setBomRows(mockBOM)
            toast.success("🧠 AI 解析完成! 已提取 4 个物料行")
        } catch {
            toast.error("AI 解析失败")
        } finally {
            setParsing(false)
        }
    }

    // ── Create deal & submit ──
    const handleSubmitApproval = async () => {
        if (!selectedProjectId) { toast.error("请先选择关联项目"); return }
        const validRows = bomRows.filter((r) => r.product_model.trim())
        if (validRows.length === 0) { toast.error("BOM 清单不能为空"); return }

        setSubmitting(true)
        try {
            const client = clientMode === "custom" ? customClient : inquiryClient

            if (currentDeal) {
                // Update BOM then submit
                await api.patch(`/api/dealdesk/${currentDeal.id}/bom`, validRows)
                const { data } = await api.post(`/api/dealdesk/${currentDeal.id}/submit`)
                setCurrentDeal(data)
                toast.success(`📤 底单 #${data.id} 已提交审批!`)
            } else {
                // Create new deal
                const { data: newDeal } = await api.post("/api/dealdesk", {
                    project_id: selectedProjectId,
                    inquiry_client: client,
                    inquiry_contact: inquiryContact,
                    bom_items: validRows.map((r) => ({
                        product_model: r.product_model,
                        ai_extracted_qty: r.ai_extracted_qty,
                        sales_qty: r.sales_qty,
                        unit_price: r.unit_price,
                        remark: r.remark,
                    })),
                })
                // Then submit
                const { data: submitted } = await api.post(`/api/dealdesk/${newDeal.id}/submit`)
                setCurrentDeal(submitted)
                toast.success(`📤 底单 #${submitted.id} 已创建并提交审批!`)
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            toast.error(msg || "提交失败")
        } finally {
            setSubmitting(false)
        }
    }

    // ── Save draft ──
    const handleSaveDraft = async () => {
        if (!selectedProjectId) { toast.error("请先选择项目"); return }
        const validRows = bomRows.filter((r) => r.product_model.trim())
        if (validRows.length === 0) { toast.error("BOM 不能为空"); return }

        setSaving(true)
        try {
            const client = clientMode === "custom" ? customClient : inquiryClient
            if (currentDeal) {
                const { data } = await api.patch(`/api/dealdesk/${currentDeal.id}/bom`, validRows)
                setCurrentDeal(data)
            } else {
                const { data } = await api.post("/api/dealdesk", {
                    project_id: selectedProjectId,
                    inquiry_client: client,
                    inquiry_contact: inquiryContact,
                    bom_items: validRows.map((r) => ({
                        product_model: r.product_model,
                        ai_extracted_qty: r.ai_extracted_qty,
                        sales_qty: r.sales_qty,
                        unit_price: r.unit_price,
                        remark: r.remark,
                    })),
                })
                setCurrentDeal(data)
            }
            toast.success("💾 草稿已保存")
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            toast.error(msg || "保存失败")
        } finally {
            setSaving(false)
        }
    }

    // ── BOM editing ──
    const updateBOM = (idx: number, field: keyof BOMItemRow, value: string | number) => {
        setBomRows((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
        )
    }

    const addBOMRow = () => {
        setBomRows((prev) => [...prev, { product_model: "", ai_extracted_qty: 0, sales_qty: 0, unit_price: 0, remark: "" }])
    }

    const removeBOMRow = (idx: number) => {
        setBomRows((prev) => prev.filter((_, i) => i !== idx))
    }

    const totalAmount = bomRows.reduce((s, r) => s + r.sales_qty * r.unit_price, 0)
    const selectedProject = projects.find((p) => p.id === selectedProjectId)

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-6">
            {/* ═══ Page Header ═══ */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
                        💰
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white/90">智能报价与自动审批流水线</h1>
                        <p className="text-xs text-white/40 mt-0.5">
                            AI 自动解析询价文件 → 销售校对 BOM → 制式报价 → VP 审批盖章 | 天眼防篡改引擎
                        </p>
                    </div>
                </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* ═══ 当前底单状态 ═══ */}
            {currentDeal && (
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${STATUS_MAP[currentDeal.status]?.color}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{STATUS_MAP[currentDeal.status]?.icon}</span>
                        <div>
                            <div className="text-sm font-bold">
                                底单 #{currentDeal.id} · {STATUS_MAP[currentDeal.status]?.label}
                            </div>
                            <div className="text-[10px] opacity-60">
                                提交人: {currentDeal.submitted_by} | 总额: ¥{currentDeal.total_amount?.toLocaleString()}
                                {currentDeal.approved_by && ` | 审批人: ${currentDeal.approved_by}`}
                            </div>
                        </div>
                    </div>
                    {currentDeal.diff_summary && (
                        <div className="flex items-center gap-1 text-[10px] text-red-400">
                            <Eye size={10} /> {currentDeal.diff_summary}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ 双栏布局 ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ═══ 左栏: 询价文件解析 ═══ */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-amber-400" />
                        <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">
                            1. 询价文件解析 (AI 提取)
                        </h2>
                    </div>

                    {/* 关联项目 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                            <Package size={11} /> 关联业务项目
                        </label>
                        <select
                            value={selectedProjectId || ""}
                            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                            disabled={loadingProjects}
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-amber-500/40 focus:outline-none transition appearance-none cursor-pointer hover:bg-white/[0.06]"
                        >
                            <option value="" className="bg-[hsl(222,47%,9%)]">-- 选择项目 --</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id} className="bg-[hsl(222,47%,9%)]">
                                    [{p.stage}] {p.name} — {p.client}
                                </option>
                            ))}
                        </select>
                        {selectedProject && (
                            <div className="text-[10px] text-white/30 flex items-center gap-2 mt-1">
                                <span>赢率: {selectedProject.win_rate}%</span>
                                <span>·</span>
                                <span>金额: ¥{selectedProject.estimated_amount?.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    {/* 询价客户 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                            🏢 询价客户主体
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={() => setClientMode("select")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition ${clientMode === "select" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-white/[0.04] text-white/40 border border-white/10 hover:bg-white/[0.06]"}`}
                            >
                                从已知客户选择
                            </button>
                            <button
                                onClick={() => setClientMode("custom")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition ${clientMode === "custom" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-white/[0.04] text-white/40 border border-white/10 hover:bg-white/[0.06]"}`}
                            >
                                ➕ 手动录入新客户
                            </button>
                        </div>
                        {clientMode === "select" ? (
                            <select
                                value={inquiryClient}
                                onChange={(e) => setInquiryClient(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-amber-500/40 focus:outline-none transition appearance-none cursor-pointer hover:bg-white/[0.06]"
                            >
                                <option value="" className="bg-[hsl(222,47%,9%)]">-- 选择客户 --</option>
                                {PRESET_CLIENTS.map((c) => (
                                    <option key={c} value={c} className="bg-[hsl(222,47%,9%)]">{c}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                value={customClient}
                                onChange={(e) => setCustomClient(e.target.value)}
                                placeholder="输入新客户全称..."
                                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm placeholder:text-white/20 focus:border-amber-500/40 focus:outline-none transition hover:bg-white/[0.06]"
                            />
                        )}
                    </div>

                    {/* 文件上传 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                            📎 上传询价资料
                        </label>
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragOver
                                ? "border-amber-400/60 bg-amber-500/10"
                                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                                }`}
                        >
                            <Upload size={32} className={`mb-3 ${dragOver ? "text-amber-400" : "text-white/20"}`} />
                            <p className="text-sm text-white/40 font-medium">
                                拖拽文件到此处, 或 <span className="text-amber-400/80 underline">点击上传</span>
                            </p>
                            <p className="text-[10px] text-white/20 mt-1">支持 PDF / DOCX / 图片</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                                className="hidden"
                            />
                        </div>
                        {files.length > 0 && (
                            <div className="space-y-1 mt-2">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/5">
                                        <span className="text-xs text-white/60 truncate flex items-center gap-1.5">
                                            <FileText size={10} className="text-amber-400/60" /> {f.name}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)) }}
                                            className="text-white/20 hover:text-red-400 transition"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI 解析按钮 */}
                    <button
                        onClick={handleAIParse}
                        disabled={parsing || !selectedProjectId}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-red-500/20"
                    >
                        {parsing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                多模态大模型正在深度解析...
                            </>
                        ) : (
                            <>
                                <Brain size={16} />
                                🧠 AI 一键解析图纸与清单
                            </>
                        )}
                    </button>
                </div>

                {/* ═══ 右栏: 人工校对与制式报价 ═══ */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-red-400" />
                            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">
                                2. 人工校对与制式报价
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={addBOMRow}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] text-white/50 hover:text-white/80 transition"
                            >
                                <Plus size={10} /> 新增行
                            </button>
                            <button
                                onClick={handleSaveDraft}
                                disabled={saving || bomRows.length === 0}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] text-white/50 hover:text-white/80 transition disabled:opacity-30"
                            >
                                {saving ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} 保存草稿
                            </button>
                        </div>
                    </div>

                    {/* BOM DataGrid */}
                    {bomRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-white/15">
                            <Package size={48} className="mb-3 opacity-40" />
                            <p className="text-sm font-medium">BOM 清单为空</p>
                            <p className="text-[10px] mt-1">请先在左栏上传文件并点击 AI 解析</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-white/[0.03] border-b border-white/10">
                                        <th className="text-left px-3 py-2.5 font-medium text-white/40 w-[200px]">产品型号</th>
                                        <th className="text-center px-3 py-2.5 font-medium text-white/40 w-[90px]">AI提取数量</th>
                                        <th className="text-center px-3 py-2.5 font-medium text-red-400/60 w-[90px]">
                                            <span className="flex items-center justify-center gap-1">
                                                ✏️ 销售核定
                                            </span>
                                        </th>
                                        <th className="text-center px-3 py-2.5 font-medium text-white/40 w-[100px]">单价(元)</th>
                                        <th className="text-right px-3 py-2.5 font-medium text-white/40 w-[100px]">小计</th>
                                        <th className="text-center px-3 py-2.5 font-medium text-white/40 w-[50px]">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bomRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                            <td className="px-2 py-1.5">
                                                <input
                                                    value={row.product_model}
                                                    onChange={(e) => updateBOM(idx, "product_model", e.target.value)}
                                                    className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-amber-500/40 text-white/80 placeholder:text-white/15 focus:outline-none transition"
                                                />
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className="text-white/30 tabular-nums">{row.ai_extracted_qty}</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={row.sales_qty}
                                                    onChange={(e) => updateBOM(idx, "sales_qty", Math.max(0, Number(e.target.value)))}
                                                    className={`w-16 mx-auto px-2 py-1.5 rounded-md border text-center tabular-nums font-bold focus:outline-none transition ${row.sales_qty !== row.ai_extracted_qty
                                                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                                                        : "border-transparent bg-transparent text-white/80 hover:border-white/10 focus:border-amber-500/40"
                                                        }`}
                                                />
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={row.unit_price}
                                                    onChange={(e) => updateBOM(idx, "unit_price", Math.max(0, Number(e.target.value)))}
                                                    className="w-20 mx-auto px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-amber-500/40 text-white/80 text-center tabular-nums focus:outline-none transition"
                                                />
                                            </td>
                                            <td className="px-2 py-1.5 text-right tabular-nums font-bold text-amber-400/80">
                                                ¥{(row.sales_qty * row.unit_price).toLocaleString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <button onClick={() => removeBOMRow(idx)} className="p-1 rounded-md hover:bg-red-500/10 text-white/20 hover:text-red-400 transition">
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* 底部合计 */}
                            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-t border-white/10">
                                <div className="text-[10px] text-white/30">
                                    共 {bomRows.filter((r) => r.product_model.trim()).length} 行物料
                                </div>
                                <div className="text-sm font-bold text-amber-400">
                                    合计: ¥{totalAmount.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 天眼引擎标识 */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <Eye size={11} className="text-red-400/50" />
                        <span className="text-[10px] text-white/25">
                            🔒 天眼防篡改引擎: 提交后 BOM 将生成 SHA-256 哈希锁定，任何未授权修改将被自动拦截
                        </span>
                    </div>

                    {/* 提交审批按钮 */}
                    <button
                        onClick={handleSubmitApproval}
                        disabled={submitting || bomRows.length === 0 || !selectedProjectId}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-red-500/20"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                正在提交至审批流水线...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                📤 提交直属上级与 VP 审批
                            </>
                        )}
                    </button>

                    {/* VP 审批面板 (仅 VP/Director 可见) */}
                    {(user?.role === "vp" || user?.role === "director") && currentDeal?.status === "pending" && (
                        <div className="mt-4 p-4 rounded-xl border border-purple-500/15 bg-purple-500/5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                                <Shield size={12} /> VP 审批面板
                            </div>
                            {currentDeal.diff_summary && (
                                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2">
                                    <AlertTriangle size={12} /> {currentDeal.diff_summary}
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        try {
                                            const { data } = await api.post(`/api/dealdesk/${currentDeal.id}/approve`)
                                            setCurrentDeal(data)
                                            toast.success("✅ 已批准!")
                                        } catch { toast.error("批准失败") }
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition"
                                >
                                    <Check size={14} /> 批准
                                </button>
                                <button
                                    onClick={async () => {
                                        const reason = prompt("驳回原因:")
                                        if (!reason) return
                                        try {
                                            const { data } = await api.post(`/api/dealdesk/${currentDeal.id}/reject`, { reason })
                                            setCurrentDeal(data)
                                            toast.success("❌ 已驳回")
                                        } catch { toast.error("驳回失败") }
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition"
                                >
                                    <AlertTriangle size={14} /> 驳回
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
