/**
 * ContractPage.tsx — 📋 合同联审 6 步流水线
 * =============================================
 * 状态机: 1_sales_init → 2_tech_review → 3_sales_pricing
 *         → 4_vp_approval → 5_approved → 6_commission
 * 每步严格 RBAC 角色锁。
 */
import { useState, useEffect, useCallback } from "react"
import { api, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    Loader2, Plus, Trash2, Check, X, Send, Lock,
    Package, DollarSign,
} from "lucide-react"
import toast from "react-hot-toast"

// ── Types ──
interface BOMItem {
    id: number; product_model: string; ai_extracted_qty: number
    sales_qty: number; tech_qty: number; final_qty: number
    unit_price: number; base_price: number; overalloc_note: string | null
    commission_ratio: number; remark: string | null
}
interface ContractDTO {
    id: number; project_id: number; step: string
    pay_method: string | null; delivery_time: string | null
    warranty_period: string | null
    ratio_advance: number; ratio_delivery: number
    ratio_accept: number; ratio_warranty: number
    delivery_address: string | null; receiver_contact: string | null
    commission_formula: string | null; freight_cost: number
    total_commission: number; bom_snapshot_hash: string | null
    bom_items: BOMItem[]; created_at: string; updated_at: string
}
interface DraftBOM { product_model: string; ai_extracted_qty: number; sales_qty: number; unit_price: number; remark: string }

const STEPS = [
    { key: "1_sales_init", label: "❶ 销售发起", color: "green", role: "sales" },
    { key: "2_tech_review", label: "❷ 技术审查", color: "yellow", role: "tech" },
    { key: "3_sales_pricing", label: "❸ 商务条款", color: "red", role: "sales" },
    { key: "4_vp_approval", label: "❹ VP终审", color: "blue", role: "vp" },
    { key: "5_approved", label: "❺ 合同发送", color: "cyan", role: "finance" },
    { key: "6_commission", label: "❻ 提成核算", color: "purple", role: "finance" },
]
const PAY_METHODS = ["电汇 (T/T)", "承兑汇票 (半年期)", "承兑汇票 (一年期)", "国内信用证 (L/C)"]

// ═════════════════════ Stepper ═════════════════════
function Stepper({ currentStep }: { currentStep: string }) {
    const idx = STEPS.findIndex((s) => s.key === currentStep)
    return (
        <div className="flex items-center gap-1 overflow-x-auto py-3">
            {STEPS.map((s, i) => {
                const done = i < idx; const active = i === idx
                return (
                    <div key={s.key} className="flex items-center gap-1">
                        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${active ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10 scale-105"
                            : done ? "bg-green-500/10 text-green-400/70 border border-green-500/15"
                                : "bg-white/[0.03] text-white/25 border border-white/5"
                            }`}>
                            {done ? <Check size={10} /> : active ? <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> : <Lock size={9} />}
                            {s.label}
                        </div>
                        {i < STEPS.length - 1 && <div className={`w-4 h-px ${i < idx ? "bg-green-500/40" : "bg-white/10"}`} />}
                    </div>
                )
            })}
        </div>
    )
}

// ═════════════════════ Main ═════════════════════
export function ContractPage() {
    const user = useAuthStore((s) => s.user)
    const role = user?.role || "sales"

    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [projectId, setProjectId] = useState<number | null>(null)
    const [contract, setContract] = useState<ContractDTO | null>(null)
    const [loading, setLoading] = useState(false)
    const [acting, setActing] = useState(false)

    // Step 1 draft BOM
    const [draftBOM, setDraftBOM] = useState<DraftBOM[]>([
        { product_model: "XGN15-12 环网柜", ai_extracted_qty: 10, sales_qty: 10, unit_price: 15000, remark: "" },
        { product_model: "KYN28A-12 中置柜", ai_extracted_qty: 5, sales_qty: 5, unit_price: 8000, remark: "" },
    ])

    // Step 2 tech review
    const [techRows, setTechRows] = useState<{ bom_item_id: number; tech_qty: number; overalloc_note: string }[]>([])

    // Step 3 pricing + terms
    const [payMethod, setPayMethod] = useState(PAY_METHODS[0])
    const [deliveryTime, setDeliveryTime] = useState("")
    const [warrantyPeriod, setWarrantyPeriod] = useState("")
    const [ratios, setRatios] = useState([30, 30, 30, 10])
    const [deliveryAddr, setDeliveryAddr] = useState("")
    const [receiverContact, setReceiverContact] = useState("")
    const [pricingRows, setPricingRows] = useState<{ bom_item_id: number; final_qty: number; unit_price: number }[]>([])

    // Step 6 commission
    const [formula, setFormula] = useState("毛利提成：(单价-底价)*数量*比例")
    const [freight, setFreight] = useState(0)
    const [commRows, setCommRows] = useState<{ bom_item_id: number; base_price: number; commission_ratio: number }[]>([])

    // Load projects
    const loadProjects = useCallback(async () => {
        try { const { data } = await api.get("/api/projects"); setProjects(data); if (data.length > 0 && !projectId) setProjectId(data[0].id) } catch { /* */ }
    }, [projectId])
    useEffect(() => { loadProjects() }, [loadProjects])

    // Load contract for project
    const loadContract = useCallback(async () => {
        if (!projectId) return
        setLoading(true)
        try {
            const { data } = await api.get(`/api/contracts`, { params: { project_id: projectId } })
            if (Array.isArray(data) && data.length > 0) {
                const c = data[data.length - 1] as ContractDTO
                setContract(c)
                // Populate tech rows
                setTechRows(c.bom_items.map((b) => ({ bom_item_id: b.id, tech_qty: b.tech_qty, overalloc_note: b.overalloc_note || "" })))
                setPricingRows(c.bom_items.map((b) => ({ bom_item_id: b.id, final_qty: b.final_qty, unit_price: b.unit_price })))
                setCommRows(c.bom_items.map((b) => ({ bom_item_id: b.id, base_price: b.base_price, commission_ratio: b.commission_ratio || 0.1 })))
            } else { setContract(null) }
        } catch { setContract(null) }
        finally { setLoading(false) }
    }, [projectId])
    useEffect(() => { loadContract() }, [loadContract])

    const step = contract?.step || "1_sales_init"
    const canAct = (r: string) => role === r || role === "admin"

    // ── Actions ──
    const createContract = async () => {
        if (!projectId) return; setActing(true)
        try {
            const { data } = await api.post("/api/contracts", { project_id: projectId, bom_items: draftBOM.filter((r) => r.product_model.trim()).map((r) => ({ product_model: r.product_model, ai_extracted_qty: r.ai_extracted_qty, sales_qty: r.sales_qty, unit_price: r.unit_price, remark: r.remark })) })
            setContract(data)
            toast.success("合同已创建")
        } catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "创建失败") }
        finally { setActing(false) }
    }

    const submitToTech = async () => {
        if (!contract) return; setActing(true)
        try { const { data } = await api.post(`/api/contracts/${contract.id}/submit-to-tech`); setContract(data); toast.success("已提交至技术部") }
        catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "提交失败") }
        finally { setActing(false) }
    }

    const submitTechReview = async () => {
        if (!contract) return; setActing(true)
        try { const { data } = await api.post(`/api/contracts/${contract.id}/tech-review`, { items: techRows }); setContract(data); toast.success("技术审查完成") }
        catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "提交失败") }
        finally { setActing(false) }
    }

    const submitPricing = async () => {
        if (!contract) return
        const totalR = ratios.reduce((a, b) => a + b, 0)
        if (totalR !== 100) { toast.error(`🚨 付款比例总和必须为 100% (当前 ${totalR}%)`); return }
        if (!deliveryTime || !deliveryAddr || !receiverContact) { toast.error("请完整填写货期/地址/收货人"); return }
        setActing(true)
        try {
            const { data } = await api.post(`/api/contracts/${contract.id}/submit-pricing`, { items: pricingRows, pay_method: payMethod, delivery_time: deliveryTime, warranty_period: warrantyPeriod, ratio_advance: ratios[0], ratio_delivery: ratios[1], ratio_accept: ratios[2], ratio_warranty: ratios[3], delivery_address: deliveryAddr, receiver_contact: receiverContact })
            setContract(data); toast.success("商务条款已锁定，提交VP审批")
        } catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "提交失败") }
        finally { setActing(false) }
    }

    const vpApprove = async () => {
        if (!contract) return; setActing(true)
        try { const { data } = await api.post(`/api/contracts/${contract.id}/approve`); setContract(data); toast.success("✅ 合同已获批!") }
        catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "失败") }
        finally { setActing(false) }
    }

    const vpReject = async () => {
        if (!contract) return; setActing(true)
        try { const { data } = await api.post(`/api/contracts/${contract.id}/reject`); setContract(data); toast.success("已驳回至销售重新定价") }
        catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "失败") }
        finally { setActing(false) }
    }

    const calcCommission = async () => {
        if (!contract) return; setActing(true)
        try {
            const { data } = await api.post(`/api/contracts/${contract.id}/calculate-commission`, { commission_formula: formula, freight_cost: freight, items: commRows })
            setContract(data); toast.success(`提成已核算: ¥${data.total_commission.toLocaleString()}`)
        } catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "失败") }
        finally { setActing(false) }
    }

    // ── Helpers ──
    const updateDraft = (i: number, f: keyof DraftBOM, v: string | number) => setDraftBOM((p) => p.map((r, j) => j === i ? { ...r, [f]: v } : r))
    const RoleLock = ({ msg }: { msg: string }) => (
        <div className="flex items-center gap-2 text-xs text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3"><Lock size={12} /> 🔒 {msg}</div>
    )
    const WaitMsg = ({ msg }: { msg: string }) => (
        <div className="flex items-center gap-2 text-xs text-white/30 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3"><Loader2 size={12} className="animate-spin" /> ⏳ {msg}</div>
    )
    const bom = contract?.bom_items || []
    const stepIdx = STEPS.findIndex((s) => s.key === step)

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center text-xl">📋</div>
                <div>
                    <h1 className="text-xl font-bold text-white/90">合同联审流水线</h1>
                    <p className="text-xs text-white/40 mt-0.5">销售发起 → 技术超配审查 → 销售定价 → VP审批 → 合同发送 → 提成核算 | 全链路防篡改</p>
                </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Project selector */}
            <div className="flex items-center gap-3">
                <label className="text-xs text-white/40 flex items-center gap-1"><Package size={11} /> 关联项目:</label>
                <select value={projectId || ""} onChange={(e) => { setProjectId(Number(e.target.value)); setContract(null) }}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-indigo-500/40 focus:outline-none transition appearance-none cursor-pointer min-w-[300px]">
                    <option value="" className="bg-[hsl(222,47%,9%)]">-- 选择项目 --</option>
                    {projects.map((p) => <option key={p.id} value={p.id} className="bg-[hsl(222,47%,9%)]">{p.name} — {p.client}</option>)}
                </select>
                {loading && <Loader2 size={14} className="animate-spin text-white/30" />}
            </div>

            {/* Stepper */}
            {projectId && <Stepper currentStep={step} />}

            {/* ═══════ Step Panels ═══════ */}
            {projectId && (
                <div className="space-y-4">

                    {/* ❶ 销售发起 */}
                    <StepCard title="🟢 第一步：销售发起合同请求 (录入 BOM)" open={step === "1_sales_init"} done={stepIdx > 0}>
                        {step === "1_sales_init" ? (
                            canAct("sales") ? (
                                <div className="space-y-3">
                                    <table className="w-full text-xs"><thead><tr className="bg-white/[0.03] border-b border-white/10">
                                        <th className="text-left px-3 py-2 text-white/40">产品型号</th><th className="text-center px-2 py-2 text-white/40 w-20">AI数量</th>
                                        <th className="text-center px-2 py-2 text-white/40 w-20">销售核定</th><th className="text-center px-2 py-2 text-white/40 w-24">单价(元)</th><th className="w-10" />
                                    </tr></thead><tbody>
                                            {draftBOM.map((r, i) => (
                                                <tr key={i} className="border-b border-white/5">
                                                    <td className="px-2 py-1"><input value={r.product_model} onChange={(e) => updateDraft(i, "product_model", e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-indigo-500/40 text-white/80 focus:outline-none" /></td>
                                                    <td className="text-center"><input type="number" value={r.ai_extracted_qty} onChange={(e) => updateDraft(i, "ai_extracted_qty", +e.target.value)} className="w-14 text-center bg-transparent border border-transparent hover:border-white/10 focus:border-indigo-500/40 text-white/60 rounded-md py-1 focus:outline-none" /></td>
                                                    <td className="text-center"><input type="number" value={r.sales_qty} onChange={(e) => updateDraft(i, "sales_qty", +e.target.value)} className="w-14 text-center bg-transparent border border-transparent hover:border-white/10 focus:border-indigo-500/40 text-white/80 font-bold rounded-md py-1 focus:outline-none" /></td>
                                                    <td className="text-center"><input type="number" value={r.unit_price} onChange={(e) => updateDraft(i, "unit_price", +e.target.value)} className="w-20 text-center bg-transparent border border-transparent hover:border-white/10 focus:border-indigo-500/40 text-white/80 rounded-md py-1 focus:outline-none" /></td>
                                                    <td><button onClick={() => setDraftBOM((p) => p.filter((_, j) => j !== i))} className="p-1 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded transition"><Trash2 size={11} /></button></td>
                                                </tr>
                                            ))}
                                        </tbody></table>
                                    <button onClick={() => setDraftBOM((p) => [...p, { product_model: "", ai_extracted_qty: 0, sales_qty: 0, unit_price: 0, remark: "" }])} className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1"><Plus size={10} /> 新增行</button>
                                    {!contract ? (
                                        <RedBtn onClick={createContract} loading={acting} icon={<Send size={14} />} text="创建合同草稿并提交至技术部" />
                                    ) : (
                                        <RedBtn onClick={submitToTech} loading={acting} icon={<Send size={14} />} text="➡️ 提交至技术部超配审查" />
                                    )}
                                </div>
                            ) : <RoleLock msg="请由负责该项目的【一线销售】发起合同" />
                        ) : <div className="text-xs text-green-400/60 flex items-center gap-1"><Check size={12} /> 已提交</div>}
                    </StepCard>

                    {/* ❷ 技术超配审查 */}
                    <StepCard title="🟡 第二步：技术部超配与工况审查" open={step === "2_tech_review"} done={stepIdx > 1}>
                        {stepIdx < 1 ? <WaitMsg msg="等待销售提交..." /> :
                            step === "2_tech_review" ? (
                                canAct("tech") ? (
                                    <div className="space-y-3">
                                        <p className="text-xs text-yellow-400/60">🔧 技术部请核查每行物料的实际工况需求，填写技术核定数量与超配说明。</p>
                                        <table className="w-full text-xs"><thead><tr className="bg-white/[0.03] border-b border-white/10">
                                            <th className="text-left px-3 py-2 text-white/40">产品型号</th><th className="text-center px-2 py-2 text-white/40 w-20">销售核定</th>
                                            <th className="text-center px-2 py-2 text-yellow-400/60 w-20">✏️ 技术核定</th><th className="text-left px-2 py-2 text-yellow-400/60">超配说明</th>
                                        </tr></thead><tbody>
                                                {bom.map((b, i) => (
                                                    <tr key={b.id} className="border-b border-white/5">
                                                        <td className="px-3 py-1.5 text-white/60">{b.product_model}</td>
                                                        <td className="text-center text-white/30">{b.sales_qty}</td>
                                                        <td className="text-center"><input type="number" value={techRows[i]?.tech_qty ?? b.tech_qty} onChange={(e) => setTechRows((p) => p.map((r, j) => j === i ? { ...r, tech_qty: +e.target.value } : r))} className={`w-14 text-center rounded-md py-1 border focus:outline-none ${(techRows[i]?.tech_qty ?? 0) > b.sales_qty ? "border-red-500/30 bg-red-500/10 text-red-400 font-bold" : "border-transparent bg-transparent text-white/80"}`} /></td>
                                                        <td className="px-2"><input value={techRows[i]?.overalloc_note ?? ""} onChange={(e) => setTechRows((p) => p.map((r, j) => j === i ? { ...r, overalloc_note: e.target.value } : r))} placeholder="超配原因..." className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-white/10 focus:border-yellow-500/40 text-white/60 text-[11px] rounded-md focus:outline-none" /></td>
                                                    </tr>
                                                ))}
                                            </tbody></table>
                                        <RedBtn onClick={submitTechReview} loading={acting} icon={<Send size={14} />} text="➡️ 技术审查完成，提交销售定价" />
                                    </div>
                                ) : <RoleLock msg="请由【技术工程师】进行超配审查" />
                            ) : <div className="text-xs text-green-400/60 flex items-center gap-1"><Check size={12} /> 技术审查已完成</div>}
                    </StepCard>

                    {/* ❸ 销售定价 + 商务条款 */}
                    <StepCard title="🔴 第三步：销售最终定价与商务条款" open={step === "3_sales_pricing"} done={stepIdx > 2}>
                        {stepIdx < 2 ? <WaitMsg msg="等待前置环节完成..." /> :
                            step === "3_sales_pricing" ? (
                                canAct("sales") ? (
                                    <div className="space-y-4">
                                        <p className="text-xs text-amber-400/60">⚠️ 技术部已添加超配信息，请调整最终合同数量与单价！</p>
                                        <table className="w-full text-xs"><thead><tr className="bg-white/[0.03] border-b border-white/10">
                                            <th className="text-left px-3 py-2 text-white/40">型号</th><th className="text-center px-2 py-2 text-white/40 w-16">技术核定</th>
                                            <th className="text-center px-2 py-2 text-red-400/60 w-20">✏️ 最终数量</th><th className="text-center px-2 py-2 text-red-400/60 w-24">✏️ 单价</th><th className="text-right px-3 py-2 text-white/40 w-24">小计</th>
                                        </tr></thead><tbody>
                                                {bom.map((b, i) => (
                                                    <tr key={b.id} className="border-b border-white/5">
                                                        <td className="px-3 py-1.5 text-white/60">{b.product_model}</td>
                                                        <td className="text-center text-white/30">{b.tech_qty}</td>
                                                        <td className="text-center"><input type="number" value={pricingRows[i]?.final_qty ?? b.final_qty} onChange={(e) => setPricingRows((p) => p.map((r, j) => j === i ? { ...r, final_qty: +e.target.value } : r))} className="w-14 text-center bg-transparent border border-transparent hover:border-white/10 focus:border-red-500/40 text-white/80 font-bold rounded-md py-1 focus:outline-none" /></td>
                                                        <td className="text-center"><input type="number" value={pricingRows[i]?.unit_price ?? b.unit_price} onChange={(e) => setPricingRows((p) => p.map((r, j) => j === i ? { ...r, unit_price: +e.target.value } : r))} className="w-20 text-center bg-transparent border border-transparent hover:border-white/10 focus:border-red-500/40 text-white/80 rounded-md py-1 focus:outline-none" /></td>
                                                        <td className="text-right px-3 tabular-nums text-amber-400/70">¥{((pricingRows[i]?.final_qty ?? b.final_qty) * (pricingRows[i]?.unit_price ?? b.unit_price)).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody></table>
                                        {/* Commercial terms */}
                                        <div className="border-t border-white/5 pt-4 space-y-3">
                                            <h3 className="text-xs font-bold text-white/60">📝 核心商务与履约条款</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="💳 支付方式"><select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="inp">{PAY_METHODS.map((m) => <option key={m} value={m} className="bg-[hsl(222,47%,9%)]">{m}</option>)}</select></Field>
                                                <Field label="🚚 货期承诺"><input value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="合同签订后30个工作日" className="inp" /></Field>
                                                <Field label="🛡️ 质保期限"><input value={warrantyPeriod} onChange={(e) => setWarrantyPeriod(e.target.value)} placeholder="货到现场12个月" className="inp" /></Field>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-white/40">💰 付款比例 (总和=100%)</label>
                                                    <div className="grid grid-cols-4 gap-1">
                                                        {["预付%", "发货%", "验收%", "质保%"].map((l, i) => (
                                                            <div key={l} className="flex flex-col items-center">
                                                                <input type="number" min={0} max={100} value={ratios[i]} onChange={(e) => setRatios((p) => p.map((v, j) => j === i ? +e.target.value : v))} className="w-full text-center bg-white/[0.04] border border-white/10 rounded-lg py-1.5 text-white/80 text-xs focus:outline-none focus:border-indigo-500/40" />
                                                                <span className="text-[9px] text-white/20 mt-0.5">{l}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {ratios.reduce((a, b) => a + b, 0) !== 100 && <p className="text-[10px] text-red-400">⚠️ 当前总和: {ratios.reduce((a, b) => a + b, 0)}%</p>}
                                                </div>
                                                <Field label="📍 发货地址"><textarea value={deliveryAddr} onChange={(e) => setDeliveryAddr(e.target.value)} placeholder="山东省烟台市..." rows={2} className="inp resize-none" /></Field>
                                                <Field label="👤 收货人"><input value={receiverContact} onChange={(e) => setReceiverContact(e.target.value)} placeholder="王工 138xxxx5678" className="inp" /></Field>
                                            </div>
                                        </div>
                                        <RedBtn onClick={submitPricing} loading={acting} icon={<Send size={14} />} text="📤 锁定价格与条款，提交 VP 审批" />
                                    </div>
                                ) : <RoleLock msg="请由【一线销售】进行最终合同金额与条款确认" />
                            ) : <div className="text-xs text-green-400/60 flex items-center gap-1"><Check size={12} /> 商务条款已锁定</div>}
                    </StepCard>

                    {/* ❹ VP 终审 */}
                    <StepCard title="🔵 第四步：VP 合同终审" open={step === "4_vp_approval"} done={stepIdx > 3}>
                        {stepIdx < 3 ? <WaitMsg msg="等待销售提交终版合同..." /> :
                            step === "4_vp_approval" ? (
                                canAct("vp") ? (
                                    <div className="space-y-4">
                                        <p className="text-xs text-blue-400/60">👑 请核阅技术超配情况、最终价格及核心商务条款。</p>
                                        <BOMDisplay items={bom} />
                                        {contract && <TermsDisplay contract={contract} />}
                                        <div className="flex gap-3">
                                            <button onClick={vpApprove} disabled={acting} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40"><Check size={14} /> 同意并加盖公章</button>
                                            <button onClick={vpReject} disabled={acting} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40"><X size={14} /> 驳回重审</button>
                                        </div>
                                    </div>
                                ) : <RoleLock msg="仅限【VP/高管】审批合同" />
                            ) : <div className="text-xs text-green-400/60 flex items-center gap-1"><Check size={12} /> VP已审批</div>}
                    </StepCard>

                    {/* ❺ 合同发送 */}
                    <StepCard title="🔵 第五步：合同已获批 & 发送" open={step === "5_approved"} done={stepIdx > 4}>
                        {stepIdx < 4 ? <WaitMsg msg="等待VP审批..." /> :
                            step === "5_approved" ? (
                                <div className="space-y-3">
                                    <div className="text-xs text-green-400/60">🎉 合同已获批生效！系统已自动生成防篡改电子合同。</div>
                                    <BOMDisplay items={bom} />
                                    {contract && <TermsDisplay contract={contract} />}
                                    <div className="text-center text-[10px] text-red-400 font-bold mt-2">【此件已加盖企业骑缝章及电子合同专用章】</div>
                                    <RedBtn onClick={async () => { if (!contract) return; setContract({ ...contract, step: "6_commission" }); toast.success("合同已发送，进入提成核算"); }} loading={false} icon={<Send size={14} />} text="🚀 一键发送合同" />
                                </div>
                            ) : <div className="text-xs text-green-400/60 flex items-center gap-1"><Check size={12} /> 已发送</div>}
                    </StepCard>

                    {/* ❻ 提成核算 */}
                    <StepCard title="🟣 第六步：项目销售提成自动核算" open={step === "6_commission"} done={false}>
                        {stepIdx < 5 ? <WaitMsg msg="等待合同发送后解锁..." /> :
                            (canAct("finance") || canAct("vp")) ? (
                                <div className="space-y-4">
                                    <p className="text-xs text-purple-400/60">💡 请补充【公司结算底价】与【运费】，系统将自动生成提成核算单。</p>
                                    <table className="w-full text-xs"><thead><tr className="bg-white/[0.03] border-b border-white/10">
                                        <th className="text-left px-3 py-2 text-white/40">型号</th><th className="text-center px-2 py-2 text-white/40 w-16">数量</th><th className="text-center px-2 py-2 text-white/40 w-20">单价</th>
                                        <th className="text-center px-2 py-2 text-purple-400/60 w-24">✏️ 底价</th><th className="text-center px-2 py-2 text-purple-400/60 w-20">✏️ 比例</th>
                                    </tr></thead><tbody>
                                            {bom.map((b, i) => (
                                                <tr key={b.id} className="border-b border-white/5">
                                                    <td className="px-3 py-1.5 text-white/60">{b.product_model}</td>
                                                    <td className="text-center text-white/40">{b.final_qty}</td>
                                                    <td className="text-center text-white/40">¥{b.unit_price.toLocaleString()}</td>
                                                    <td className="text-center"><input type="number" value={commRows[i]?.base_price ?? 0} onChange={(e) => setCommRows((p) => p.map((r, j) => j === i ? { ...r, base_price: +e.target.value } : r))} className="w-20 text-center bg-transparent border border-transparent hover:border-white/10 focus:border-purple-500/40 text-white/80 rounded-md py-1 focus:outline-none" /></td>
                                                    <td className="text-center"><input type="number" step={0.01} min={0} max={1} value={commRows[i]?.commission_ratio ?? 0.1} onChange={(e) => setCommRows((p) => p.map((r, j) => j === i ? { ...r, commission_ratio: +e.target.value } : r))} className="w-16 text-center bg-transparent border border-transparent hover:border-white/10 focus:border-purple-500/40 text-white/80 rounded-md py-1 focus:outline-none" /></td>
                                                </tr>
                                            ))}
                                        </tbody></table>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="🧮 提成公式"><select value={formula} onChange={(e) => setFormula(e.target.value)} className="inp"><option className="bg-[hsl(222,47%,9%)]">毛利提成：(单价-底价)*数量*比例</option><option className="bg-[hsl(222,47%,9%)]">全额提成：单价*数量*比例</option></select></Field>
                                        <Field label="🚚 运费扣减(元)"><input type="number" value={freight} onChange={(e) => setFreight(+e.target.value)} className="inp" /></Field>
                                    </div>
                                    {contract?.total_commission != null && contract.total_commission > 0 && (
                                        <div className="text-center py-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/15 rounded-xl">
                                            <span className="text-xs text-white/40">最终应发提成: </span>
                                            <span className="text-lg font-bold text-red-400">¥{contract.total_commission.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <RedBtn onClick={calcCommission} loading={acting} icon={<DollarSign size={14} />} text="💵 一键核算并生成《标准提成单》" />
                                </div>
                            ) : <RoleLock msg="仅限【财务/VP】核算提成" />}
                    </StepCard>

                </div>
            )}
        </div>
    )
}

// ── Sub-components ──
function StepCard({ title, open, done, children }: { title: string; open: boolean; done: boolean; children: React.ReactNode }) {
    const [expanded, setExpanded] = useState(open)
    return (
        <div className={`rounded-2xl border p-5 transition-all ${open ? "border-blue-500/20 bg-blue-500/[0.03]" : done ? "border-green-500/10 bg-green-500/[0.02]" : "border-white/5 bg-white/[0.01]"}`}>
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
                <span className="text-sm font-bold text-white/80">{title}</span>
                <span className="text-[10px] text-white/20">{expanded ? "▲" : "▼"}</span>
            </button>
            {expanded && <div className="mt-4">{children}</div>}
        </div>
    )
}

function RedBtn({ onClick, loading, icon, text }: { onClick: () => void; loading: boolean; icon: React.ReactNode; text: string }) {
    return (
        <button onClick={onClick} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-red-500/20">
            {loading ? <Loader2 size={14} className="animate-spin" /> : icon} {text}
        </button>
    )
}

function BOMDisplay({ items }: { items: BOMItem[] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs"><thead><tr className="bg-white/[0.03] border-b border-white/10">
                <th className="text-left px-3 py-2 text-white/40">型号</th><th className="text-center px-2 py-2 text-white/40 w-16">数量</th>
                <th className="text-center px-2 py-2 text-white/40 w-20">单价</th><th className="text-right px-3 py-2 text-white/40 w-24">小计</th>
            </tr></thead><tbody>
                    {items.map((b) => (
                        <tr key={b.id} className="border-b border-white/5">
                            <td className="px-3 py-1.5 text-white/60">{b.product_model}</td>
                            <td className="text-center text-white/50">{b.final_qty}</td>
                            <td className="text-center text-white/50">¥{b.unit_price.toLocaleString()}</td>
                            <td className="text-right px-3 text-amber-400/70 tabular-nums">¥{(b.final_qty * b.unit_price).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody></table>
        </div>
    )
}

function TermsDisplay({ contract: c }: { contract: ContractDTO }) {
    if (!c.pay_method) return null
    return (
        <div className="grid grid-cols-2 gap-2 text-[11px] p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <div><span className="text-white/30">💳 支付:</span> <span className="text-white/60">{c.pay_method}</span></div>
            <div><span className="text-white/30">💰 比例:</span> <span className="text-white/60">{c.ratio_advance}/{c.ratio_delivery}/{c.ratio_accept}/{c.ratio_warranty}%</span></div>
            <div><span className="text-white/30">🚚 货期:</span> <span className="text-white/60">{c.delivery_time}</span></div>
            <div><span className="text-white/30">🛡️ 质保:</span> <span className="text-white/60">{c.warranty_period}</span></div>
            <div><span className="text-white/30">📍 地址:</span> <span className="text-white/60">{c.delivery_address}</span></div>
            <div><span className="text-white/30">👤 收货:</span> <span className="text-white/60">{c.receiver_contact}</span></div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="space-y-1"><label className="text-[10px] text-white/40">{label}</label>{children}</div>
}
