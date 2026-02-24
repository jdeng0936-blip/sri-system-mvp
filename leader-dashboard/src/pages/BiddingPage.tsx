/**
 * BiddingPage.tsx — 📑 招投标"雷区"与控标中心 (Bidding War Room)
 * =============================================================
 * Streamlit app.py L2799-2870 还原:
 *   顶部 — 4阶段漏斗卡片 (标前评估→标书编制→内部联审→封标开标)
 *   中部 — 双栏作战: 左=🛡️排雷(标书拆解) / 右=⚔️控标(参数生成)
 *   底部 — AI 排雷/控标战报展示
 *
 * Backend:
 *   GET  /api/projects
 *   POST /api/ai/generate-quiz  (复用: bidding analysis)
 */
import { useState, useEffect, useCallback } from "react"
import { api, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    Loader2, Shield, Swords, Upload, Search, Bomb,
    ChevronRight, Trash2, Sparkles,
    AlertTriangle,
} from "lucide-react"
import toast from "react-hot-toast"

/* ── Funnel stages ── */
const FUNNEL_STAGES = [
    { id: "eval", label: "标前评估", icon: "🔍", desc: "资质审查 · 竞争格局 · 投标决策", color: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/20" },
    { id: "draft", label: "标书编制", icon: "📝", desc: "方案编写 · 价格策略 · 控标参数", color: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/20" },
    { id: "review", label: "内部联审", icon: "⚖️", desc: "技术审核 · 商务审核 · VP审批", color: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/20" },
    { id: "seal", label: "封标开标", icon: "📦", desc: "封装投递 · 开标现场 · 结果跟踪", color: "from-green-500/20 to-green-500/5", border: "border-green-500/20" },
]

/* ── Competitors ── */
const COMPETITORS = ["西门子", "ABB", "施耐德", "江苏大全", "正泰", "其他竞品"]

/* ── Core advantages ── */
const DEFAULT_ADVANTAGES = [
    "自主研发消弧选线核心算法，业内唯一通过国网认证",
    "整柜IP67防护等级，盐雾试验超4000小时",
    "全生命周期TCO低于竞品15-20%",
    "3分钟快速换模技术，维护停机时间减少80%",
    "具备智能自诊断+远程运维能力",
]

export function BiddingPage() {

    /* ── State ── */
    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [projectId, setProjectId] = useState<number | null>(null)

    // Defense (排雷)
    const [fileName, setFileName] = useState("")
    const [fileContent, setFileContent] = useState("")
    const [analyzing, setAnalyzing] = useState(false)
    const [defenseReport, setDefenseReport] = useState("")

    // Attack (控标)
    const [competitor, setCompetitor] = useState(COMPETITORS[0])
    const [selectedAdvs, setSelectedAdvs] = useState<string[]>([DEFAULT_ADVANTAGES[0]])
    const [customAdv, setCustomAdv] = useState("")
    const [generating, setGenerating] = useState(false)
    const [attackReport, setAttackReport] = useState("")

    // Funnel
    const [activeFunnel, setActiveFunnel] = useState("eval")

    /* ── Load projects ── */
    const loadProjects = useCallback(async () => {
        try {
            const { data } = await api.get("/api/projects")
            setProjects(data)
            if (data.length > 0 && !projectId) setProjectId(data[0].id)
        } catch (_e) { /* */ }
    }, [projectId])
    useEffect(() => { loadProjects() }, [loadProjects])

    const projectName = projects.find((p) => p.id === projectId)?.name || "—"

    /* ── File "upload" (read as text for demo) ── */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (ev) => setFileContent(ev.target?.result as string || "")
        reader.readAsText(file)
    }

    /* ── AI: 排雷分析 ── */
    const runDefenseAnalysis = async () => {
        if (!projectId) { toast.error("请先选择项目"); return }
        if (!fileContent && !fileName) { toast.error("请先上传招标文件"); return }
        setAnalyzing(true); setDefenseReport("")
        try {
            const { data } = await api.post("/api/ai/generate-quiz", {
                project_id: projectId,
                context: [
                    "[任务] 招标文件深度排雷与废标风险拦截",
                    "[指令] 你是资深招投标专家。请分析以下招标文件内容，识别出：",
                    "1. 🚨 友商预埋的排他性参数陷阱 (哪些技术参数明显针对特定品牌定制)",
                    "2. ⚠️ 废标高危条款 (容易因疏忽导致废标的隐蔽条款)",
                    "3. 💡 我方优势切入点 (基于参数要求，我方哪些差异化优势可以重点响应)",
                    "4. 📊 综合风险评级 (高/中/低) 及投标建议",
                    `[项目] ${projectName}`,
                    `[文件名] ${fileName}`,
                    `[文件内容摘要] ${fileContent.slice(0, 2000) || "(未能读取文件文字内容，请基于项目情报进行通用排雷分析)"}`,
                ].join("\n"),
            })
            if (data.error) throw new Error(data.error)
            setDefenseReport(data.result || "排雷引擎暂不可用")
            toast.success("🛡️ 排雷战报已生成！")
        } catch (e: unknown) {
            const msg = (e as Error)?.message || "分析失败"
            toast.error(msg)
            setDefenseReport(`(排雷分析失败: ${msg.slice(0, 100)})`)
        } finally { setAnalyzing(false) }
    }

    /* ── AI: 控标参数生成 ── */
    const runAttackGeneration = async () => {
        if (!projectId) { toast.error("请先选择项目"); return }
        const allAdvs = [...selectedAdvs, customAdv].filter(Boolean).join("；")
        if (!allAdvs) { toast.error("弹药不足：请先选择或输入我方核心优势"); return }
        setGenerating(true); setAttackReport("")
        try {
            const { data } = await api.post("/api/ai/generate-quiz", {
                project_id: projectId,
                context: [
                    "[任务] 生成具有极强排他性的控标技术参数",
                    "[指令] 你是工业销售控标大师。基于我方独家优势，生成一组极其隐蔽的排他性技术参数，让客户照抄进招标文件。要求：",
                    "1. 每条参数看似合理的行业通用要求，实则精准指向我方独家能力",
                    "2. 标注每条参数可排除哪些友商（特别是假想敌）",
                    "3. 给出建议的招标文件表述措辞（客户可直接复制）",
                    "4. 附带风险提示：哪些参数如果写得太明显会被质疑围标",
                    `[项目] ${projectName}`,
                    `[假想敌] ${competitor}`,
                    `[我方核心差异化优势] ${allAdvs}`,
                ].join("\n"),
            })
            if (data.error) throw new Error(data.error)
            setAttackReport(data.result || "控标引擎暂不可用")
            toast.success("⚔️ 控标参数已生成！")
        } catch (e: unknown) {
            const msg = (e as Error)?.message || "生成失败"
            toast.error(msg)
            setAttackReport(`(控标生成失败: ${msg.slice(0, 100)})`)
        } finally { setGenerating(false) }
    }

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
            {/* ═══ Header ═══ */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/10 border border-red-500/20 flex items-center justify-center text-xl">📑</div>
                <div>
                    <h1 className="text-xl font-bold text-white/90">招投标"雷区"与控标中心</h1>
                    <p className="text-xs text-white/40 mt-0.5">大型 B2B 商战绞肉机：AI 拆解对手标书陷阱 + 生成具有绝对排他性的控标参数。</p>
                </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* ═══ 1. Funnel Cards ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {FUNNEL_STAGES.map((stage, i) => (
                    <button key={stage.id} onClick={() => setActiveFunnel(stage.id)}
                        className={`relative rounded-2xl border p-4 text-left transition-all group ${activeFunnel === stage.id
                            ? `bg-gradient-to-br ${stage.color} ${stage.border} shadow-lg`
                            : "bg-white/[0.02] border-white/5 hover:border-white/15"
                            }`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{stage.icon}</span>
                            <span className={`text-xs font-bold ${activeFunnel === stage.id ? "text-white/80" : "text-white/40"}`}>{stage.label}</span>
                            {i < FUNNEL_STAGES.length - 1 && (
                                <ChevronRight size={10} className="text-white/10 ml-auto" />
                            )}
                        </div>
                        <p className={`text-[10px] leading-relaxed ${activeFunnel === stage.id ? "text-white/40" : "text-white/15"}`}>{stage.desc}</p>
                        {/* Step number badge */}
                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${activeFunnel === stage.id ? "bg-white/10 text-white/60" : "bg-white/[0.03] text-white/15"
                            }`}>{i + 1}</div>
                    </button>
                ))}
            </div>

            {/* ═══ Project Selector ═══ */}
            <div className="space-y-1">
                <label className="text-[10px] text-white/30">📂 选择正在运作的打单项目</label>
                <select value={projectId || ""} onChange={(e) => { setProjectId(Number(e.target.value)); setDefenseReport(""); setAttackReport("") }}
                    className="w-full max-w-md px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-xs focus:border-purple-500/40 focus:outline-none transition appearance-none cursor-pointer">
                    {projects.map((p) => <option key={p.id} value={p.id} className="bg-[hsl(222,47%,9%)]">{p.name}</option>)}
                </select>
            </div>

            {/* ═══ 2. Dual Column: Defense + Attack ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ══ LEFT: 🛡️ 排雷 (Defense) ══ */}
                <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.02] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Shield size={16} className="text-blue-400" />
                        <h3 className="text-sm font-bold text-white/70">🛡️ 标书拆解与防守 (排雷)</h3>
                    </div>
                    <p className="text-[10px] text-white/20 leading-relaxed">
                        上传客户发来的 RFP / 招标文件，AI 将瞬间标出哪些参数是友商提前埋好的"雷"。
                    </p>

                    {/* File upload */}
                    <div className="space-y-2">
                        <label className="text-[10px] text-white/30">📎 上传招标文件 (PDF/Word/TXT)</label>
                        <div className="relative">
                            <input type="file" accept=".pdf,.docx,.txt,.doc" onChange={handleFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            <div className={`px-4 py-3 rounded-xl border border-dashed transition flex items-center gap-2 ${fileName ? "border-blue-500/30 bg-blue-500/[0.05]" : "border-white/10 bg-white/[0.02]"
                                }`}>
                                <Upload size={14} className={fileName ? "text-blue-400" : "text-white/15"} />
                                <span className={`text-xs ${fileName ? "text-blue-300/70" : "text-white/20"}`}>
                                    {fileName || "点击选择文件或拖拽上传..."}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Analyze button */}
                    <button onClick={runDefenseAnalysis} disabled={analyzing}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all">
                        {analyzing
                            ? <><Loader2 size={12} className="animate-spin" /> AI 正在深度拆标排雷...</>
                            : <><Search size={12} /> 🔍 AI 一键深度拆标排雷</>}
                    </button>
                </div>

                {/* ══ RIGHT: ⚔️ 控标 (Attack) ══ */}
                <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.02] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Swords size={16} className="text-red-400" />
                        <h3 className="text-sm font-bold text-white/70">⚔️ 控标参数与进攻 (埋雷)</h3>
                    </div>
                    <p className="text-[10px] text-white/20 leading-relaxed">
                        让 AI 结合我方独家优势，生成极其隐蔽的排他性控标参数，教客户怎么写标书。
                    </p>

                    {/* Competitor */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/30">🎯 假想敌 (本次重点防范友商)</label>
                        <select value={competitor} onChange={(e) => setCompetitor(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 text-xs focus:border-red-500/30 focus:outline-none transition appearance-none cursor-pointer">
                            {COMPETITORS.map((c) => <option key={c} value={c} className="bg-[hsl(222,47%,9%)]">{c}</option>)}
                        </select>
                    </div>

                    {/* Core advantages multi-select */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-white/30">💎 调取我方核心差异化优势 (可多选)</label>
                        <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                            {DEFAULT_ADVANTAGES.map((adv) => {
                                const isSelected = selectedAdvs.includes(adv)
                                return (
                                    <button key={adv} onClick={() => {
                                        setSelectedAdvs(isSelected ? selectedAdvs.filter((a) => a !== adv) : [...selectedAdvs, adv])
                                    }}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-[10px] leading-relaxed transition ${isSelected
                                            ? "bg-red-500/10 border-red-500/20 text-red-200/70"
                                            : "bg-white/[0.02] border-white/5 text-white/30 hover:border-white/15"
                                            }`}>
                                        <span className="mr-1">{isSelected ? "✅" : "⬜"}</span>{adv}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Custom advantage */}
                    <input type="text" value={customAdv} onChange={(e) => setCustomAdv(e.target.value)}
                        placeholder="✍️ 临时补充特定项目优势 (可选)..."
                        className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 placeholder:text-white/15 focus:outline-none focus:border-red-500/20 transition" />

                    {/* Generate button */}
                    <button onClick={runAttackGeneration} disabled={generating}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all">
                        {generating
                            ? <><Loader2 size={12} className="animate-spin" /> AI 正在锻造毒辣控标参数...</>
                            : <><Bomb size={12} /> 💣 生成极具伪装性的控标参数</>}
                    </button>
                </div>
            </div>

            {/* ═══ 3. Reports ═══ */}
            {(defenseReport || attackReport) && (
                <div className="space-y-4">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Defense report */}
                    {defenseReport && (
                        <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.02] p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white/70 flex items-center gap-1.5">
                                    <AlertTriangle size={14} className="text-amber-400" /> 🚨 AI 标书深度排雷战报
                                </h3>
                                <button onClick={() => setDefenseReport("")}
                                    className="text-[10px] text-white/20 hover:text-white/40 flex items-center gap-1 transition">
                                    <Trash2 size={10} /> 清除
                                </button>
                            </div>
                            <div className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                {defenseReport}
                            </div>
                        </div>
                    )}

                    {/* Attack report */}
                    {attackReport && (
                        <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.02] p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white/70 flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-red-400" /> ⚔️ AI 控标参数战报
                                </h3>
                                <button onClick={() => setAttackReport("")}
                                    className="text-[10px] text-white/20 hover:text-white/40 flex items-center gap-1 transition">
                                    <Trash2 size={10} /> 清除
                                </button>
                            </div>
                            <div className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                {attackReport}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
