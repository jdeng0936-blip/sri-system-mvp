/**
 * FirstScenePage.tsx — 🎙️ 第一现场：沉浸式客户展厅与双向连线
 * ============================================================
 * 原 Streamlit 1:1 还原:
 *   左 (6) — 客户交互大屏: 7-tab 弹药包 + 实时客户问答 Chat
 *   右 (4) — 战术护目镜 (Sales Only): AI 战术分析 + SOS 呼叫 + 弹药接收雷达
 */
import { useState, useEffect, useCallback } from "react"
import { api, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    Loader2, Send, Shield, Radio, Trash2,
    AlertTriangle, Phone, Play, FileText, Ruler,
    Headphones, BarChart3, ClipboardList, Sparkles,
    MessageSquare, Eye,
} from "lucide-react"
import toast from "react-hot-toast"

// ── Media tab definition ──
const MEDIA_TABS = [
    { key: "video", label: "🎬 视频", icon: <Play size={12} /> },
    { key: "ppt", label: "📊 PPT", icon: <FileText size={12} /> },
    { key: "cad", label: "📐 CAD", icon: <Ruler size={12} /> },
    { key: "podcast", label: "🎙️ 播客", icon: <Headphones size={12} /> },
    { key: "infographic", label: "🗺️ 信息图", icon: <BarChart3 size={12} /> },
    { key: "selection", label: "📋 选型表", icon: <ClipboardList size={12} /> },
    { key: "ai_sim", label: "✨ AI 模拟", icon: <Sparkles size={12} /> },
]

const SIM_SCENES = ["极端工况抗压模拟", "TCO 投资回报率核算", "施工排期极限压缩方案"]

// ── Chat message type ──
interface ChatMsg { role: "user" | "assistant"; content: string }

// ── SOS ticket ──
interface SOSTicket {
    id: number; ticket_no: string; project_id: number
    client_query: string; ai_brief: string | null
    status: string; expert_reply: string | null
    resolved_by: string | null; created_at: string
}

export function FirstScenePage() {
    const user = useAuthStore((s) => s.user)

    // ── State ──
    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [projectId, setProjectId] = useState<number | null>(null)
    const projectName = projects.find((p) => p.id === projectId)?.name || "—"

    // Media tabs
    const [activeTab, setActiveTab] = useState("video")
    const [simScene, setSimScene] = useState(SIM_SCENES[0])
    const [simResult, setSimResult] = useState("")
    const [simLoading, setSimLoading] = useState(false)

    // Chat (client Q&A)
    const [chatHistory, setChatHistory] = useState<ChatMsg[]>([])
    const [chatInput, setChatInput] = useState("")
    const [chatLoading, setChatLoading] = useState(false)

    // Tactical goggles (right column)
    const [lastQuery, setLastQuery] = useState("")
    const [tacticalAdvice, setTacticalAdvice] = useState("")
    const [tacticalLoading, setTacticalLoading] = useState(false)
    const [pitchAnswer, setPitchAnswer] = useState("")

    // SOS
    const [sosLoading, setSosLoading] = useState(false)
    const [sosTickets, setSosTickets] = useState<SOSTicket[]>([])

    // ── Load projects ──
    const loadProjects = useCallback(async () => {
        try {
            const { data } = await api.get("/api/projects")
            setProjects(data)
            if (data.length > 0 && !projectId) setProjectId(data[0].id)
        } catch { /* */ }
    }, [projectId])
    useEffect(() => { loadProjects() }, [loadProjects])

    // ── Load SOS tickets for this project ──
    const loadSOS = useCallback(async () => {
        try {
            const { data } = await api.get("/api/sos")
            setSosTickets(data.filter((t: SOSTicket) => t.project_id === projectId))
        } catch { /* no permission or no tickets */ }
    }, [projectId])
    useEffect(() => { if (projectId) loadSOS() }, [loadSOS, projectId])

    // ── Client chat: send question → display + trigger goggles ──
    const handleChatSend = async () => {
        if (!chatInput.trim() || !projectId) return
        const query = chatInput.trim()
        setChatInput("")
        setLastQuery(query)
        toast("📡 捕捉到现场交流信号！", { icon: "📡" })

        // Add user message
        const newHistory: ChatMsg[] = [...chatHistory, { role: "user", content: query }]
        setChatHistory(newHistory)

        // 1) Generate client-facing AI answer (left column)
        setChatLoading(true)
        try {
            const { data } = await api.post("/api/intel/daily-log", {
                project_id: projectId,
                text: `[第一现场客户提问] ${query}`,
            })
            const aiParsed = data.ai_parsed_json || ""
            const aiAnswer = aiParsed.length > 10 ? aiParsed : "AI 正在分析工况... 请稍候"
            setChatHistory([...newHistory, { role: "assistant", content: aiAnswer }])
        } catch {
            setChatHistory([...newHistory, { role: "assistant", content: "(AI 连接中断，请重试)" }])
        } finally { setChatLoading(false) }

        // 2) Generate tactical goggles advice (right column) — simulated locally
        setTacticalLoading(true)
        setTacticalAdvice("")
        setPitchAnswer("")
        try {
            // Use the same intel endpoint but with a tactical prompt prefix
            const { data } = await api.post("/api/intel/daily-log", {
                project_id: projectId,
                text: `[战术护目镜分析] 客户在现场提问："${query}"。请给出：1) 话术拆解 (客户真正担忧是什么) 2) 出牌建议 (该用什么案例或筹码回击)`,
            })
            setTacticalAdvice(data.ai_parsed_json || "战术分析生成中...")
            setPitchAnswer(`针对客户提问"${query.slice(0, 30)}..."的应对话术已生成。请直接复述。`)
        } catch {
            setTacticalAdvice("护目镜信号暂时中断")
        } finally { setTacticalLoading(false) }
    }

    // ── SOS: one-click call experts ──
    const handleSOS = async () => {
        if (!lastQuery) { toast.error("⚠️ 暂未捕捉到现场交锋上下文，请先在左侧输入客户提问"); return }
        if (!projectId) return
        setSosLoading(true)
        try {
            const { data } = await api.post("/api/sos", {
                project_id: projectId,
                client_query: lastQuery,
            })
            toast.success(`✅ 紧急工单已派发 (${data.ticket_no})`)
            setSosTickets((prev) => [data, ...prev])
        } catch (e: unknown) {
            toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "SOS 发射失败")
        } finally { setSosLoading(false) }
    }

    // ── Clear meeting ──
    const clearMeeting = () => {
        setChatHistory([]); setLastQuery(""); setTacticalAdvice(""); setPitchAnswer("")
        toast("🧹 现场已清空，准备迎接下一波战斗")
    }

    // ── Resolved ammo for current project ──
    const incomingAmmo = sosTickets.filter((t) => t.status === "resolved")

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-5">
            {/* ═══ Header ═══ */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center text-xl">🎙️</div>
                <div>
                    <h1 className="text-xl font-bold text-white/90">第一现场：沉浸式客户展厅与双向连线</h1>
                    <p className="text-xs text-white/40 mt-0.5">🎯 在此模式下，系统分为【客户明面交互】与【销售战术暗线】。</p>
                </div>
            </div>

            {/* Project selector */}
            <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs text-white/40">🔗 绑定本次拜访作战项目 (继承沙盘数据):</label>
                <select value={projectId || ""} onChange={(e) => { setProjectId(Number(e.target.value)); setChatHistory([]); setLastQuery("") }}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-sm focus:border-blue-500/40 focus:outline-none transition appearance-none cursor-pointer min-w-[300px]">
                    {projects.map((p) => <option key={p.id} value={p.id} className="bg-[hsl(222,47%,9%)]">{p.name} — {p.client}</option>)}
                </select>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* ═══ 6:4 Dual Column Layout ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

                {/* ══════ LEFT: 客户交互大屏 (6/10) ══════ */}
                <div className="lg:col-span-6 space-y-5">
                    <h2 className="text-sm font-bold text-white/70 flex items-center gap-2">🖥️ 客户交互大屏 (Client View)</h2>

                    {/* ── 现场弹药包 (7 tabs) ── */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                        <h3 className="text-xs font-bold text-white/60">🧰 现场弹药包</h3>
                        {/* Tab bar */}
                        <div className="flex flex-wrap gap-1">
                            {MEDIA_TABS.map((t) => (
                                <button key={t.key} onClick={() => setActiveTab(t.key)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${activeTab === t.key ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/50"
                                        }`}>{t.icon} {t.label}</button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div className="min-h-[200px]">
                            {activeTab === "video" && (
                                <div className="space-y-2">
                                    <video controls className="w-full rounded-xl bg-black/50" poster="">
                                        <source src="/assets/promo.mp4" type="video/mp4" />
                                        <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
                                    </video>
                                    <p className="text-[10px] text-white/20">🎬 演示视频：过往标杆项目设备吊装实录</p>
                                </div>
                            )}
                            {activeTab === "ppt" && <InfoBox color="blue" text="📊 交流 PPT：这里将直接渲染对接企业云盘的幻灯片组件，支持客户手势滑动。" />}
                            {activeTab === "cad" && <InfoBox color="amber" text="📐 CAD 上图模块：此处预留 WebGL 接口，用于三维模型旋转及爆炸图拆解演示。" />}
                            {activeTab === "podcast" && (
                                <div className="space-y-2">
                                    <audio controls className="w-full">
                                        <source src="/assets/expert_voice.mp3" type="audio/mpeg" />
                                        <source src="https://www.w3schools.com/html/horse.ogg" type="audio/ogg" />
                                    </audio>
                                    <p className="text-[10px] text-white/20">🎙️ 行业播客：研发总工解读最新环保排污政策</p>
                                </div>
                            )}
                            {activeTab === "infographic" && <InfoBox color="green" text="🗺️ 信息图：此处渲染 TCO (全生命周期成本) 与竞品 ROI 对比雷达图。" />}
                            {activeTab === "selection" && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead><tr className="bg-white/[0.04] border-b border-white/10">
                                            <th className="text-left px-3 py-2 text-white/40">参数维度</th>
                                            <th className="text-center px-3 py-2 text-blue-400/70">旗舰型号 (推荐)</th>
                                            <th className="text-center px-3 py-2 text-white/40">标准型号</th>
                                        </tr></thead>
                                        <tbody>
                                            {[
                                                ["额定功率", "500kW", "300kW"],
                                                ["防护等级", "IP67", "IP65"],
                                                ["防腐标准", "C5-M (海洋级)", "C3 (工业级)"],
                                                ["交付周期", "30天", "15天"],
                                            ].map(([dim, flag, std]) => (
                                                <tr key={dim} className="border-b border-white/5">
                                                    <td className="px-3 py-2 text-white/60">{dim}</td>
                                                    <td className="text-center px-3 py-2 text-blue-300/80 font-medium">{flag}</td>
                                                    <td className="text-center px-3 py-2 text-white/40">{std}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {activeTab === "ai_sim" && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-white/60">🚀 动态方案推演引擎</h4>
                                    <p className="text-[10px] text-white/30">基于全局项目情报，由 AI 现场现编极具针对性的应对方案。</p>
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1 space-y-1">
                                            <label className="text-[10px] text-white/30">🎯 选择推演场景</label>
                                            <select value={simScene} onChange={(e) => setSimScene(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/80 text-xs focus:outline-none appearance-none cursor-pointer">
                                                {SIM_SCENES.map((s) => <option key={s} className="bg-[hsl(222,47%,9%)]">{s}</option>)}
                                            </select>
                                        </div>
                                        <button onClick={async () => {
                                            setSimLoading(true); setSimResult("")
                                            try {
                                                const { data } = await api.post("/api/intel/daily-log", {
                                                    project_id: projectId,
                                                    text: `[AI推演] 项目:${projectName} 场景:${simScene}。请直接输出一段约200字、极具专业度的方案推演结论，包含具体数据预测。`,
                                                })
                                                setSimResult(data.ai_parsed_json || "推演报告生成中...")
                                            } catch { setSimResult("推演失败，请检查 AI 服务") }
                                            finally { setSimLoading(false) }
                                        }} disabled={simLoading}
                                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 disabled:opacity-40 transition whitespace-nowrap">
                                            {simLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} 🧠 一键推演
                                        </button>
                                    </div>
                                    {simResult && (
                                        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-white/60 leading-relaxed">
                                            <span className="text-blue-400/70 font-bold">✅ 推演报告 ({simScene})：</span><br />{simResult}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 实时客户问答 Chat ── */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                        {/* Chat history */}
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === "user" ? "bg-blue-500/15 text-blue-200/80 border border-blue-500/15" : "bg-white/[0.04] text-white/70 border border-white/5"
                                        }`}>
                                        {msg.role === "user" && <span className="text-[9px] text-blue-300/40 font-bold block mb-0.5">客户提问</span>}
                                        {msg.role === "assistant" && <span className="text-[9px] text-green-300/40 font-bold block mb-0.5">AI 解答 (对客户可见)</span>}
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-white/30 flex items-center gap-1.5">
                                        <Loader2 size={10} className="animate-spin" /> 🧠 AI 大脑正在分析工况...
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Clear + Input */}
                        <div className="flex gap-2 items-center">
                            <button onClick={clearMeeting} className="shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] text-white/30 hover:text-white/50 flex items-center gap-1 transition">
                                <Trash2 size={10} /> 结束会议
                            </button>
                            <div className="flex-1 flex gap-2">
                                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                                    placeholder="🎙️ 现场遇阻？输入客户的刁钻发难 (例: 你们的设备散热不如西门子)..."
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/80 placeholder:text-white/15 focus:outline-none focus:border-blue-500/30 transition" />
                                <button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold flex items-center gap-1 hover:brightness-110 disabled:opacity-40 transition">
                                    <Send size={12} /> 发送
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════ RIGHT: 战术护目镜 (4/10) ══════ */}
                <div className="lg:col-span-4 space-y-5">
                    <h2 className="text-sm font-bold text-white/70 flex items-center gap-2">
                        <Eye size={14} /> 🥽 战术护目镜 (Sales Only)
                    </h2>
                    <p className="text-[10px] text-amber-400/40">🤫 仅销售可见的实时底牌与战术指导</p>

                    {/* ── Tactical AI Analysis ── */}
                    <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.02] p-4 space-y-3">
                        {lastQuery ? (
                            <>
                                {tacticalLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-amber-400/50"><Loader2 size={12} className="animate-spin" /> 🥽 护目镜实时透视客户意图...</div>
                                ) : tacticalAdvice ? (
                                    <div className="space-y-2">
                                        <div className="text-xs text-amber-400/70 font-bold">🥽 战术护目镜实时解析：</div>
                                        <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">{tacticalAdvice.slice(0, 500)}</div>
                                    </div>
                                ) : null}
                                {pitchAnswer && (
                                    <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 text-xs text-green-400/70">
                                        <span className="font-bold">🎯 AI 隐形提词器 (建议直接原话复述)：</span><br />{pitchAnswer}
                                    </div>
                                )}

                                {/* SOS Button */}
                                <button onClick={handleSOS} disabled={sosLoading}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-red-500/20 mt-2">
                                    {sosLoading ? <><Loader2 size={14} className="animate-spin" /> 📡 AI 正在提炼火力需求...</> : <><Phone size={14} /> 🆘 一键呼叫后方技术群 (企业微信连线)</>}
                                </button>
                            </>
                        ) : pitchAnswer ? (
                            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 text-xs text-green-400/70">
                                <span className="font-bold">🎯 AI 隐形提词器：</span><br />{pitchAnswer}
                            </div>
                        ) : (
                            <p className="text-xs text-white/20 italic py-4 text-center">(等待捕捉现场客户提问...)</p>
                        )}
                    </div>

                    {/* ── SOS Tickets Timeline ── */}
                    {sosTickets.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                            <h3 className="text-xs font-bold text-white/50">📋 SOS 工单状态</h3>
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {sosTickets.map((t) => (
                                    <div key={t.id} className={`rounded-xl border p-3 space-y-1.5 ${t.status === "resolved" ? "border-green-500/15 bg-green-500/[0.02]" : "border-red-500/15 bg-red-500/[0.03]"
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.status === "resolved" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400 animate-pulse"
                                                }`}>{t.status === "resolved" ? "🟢 支援已送达" : "🔴 紧急待支援"}</span>
                                            <span className="text-[9px] text-white/20 font-mono">{t.ticket_no}</span>
                                        </div>
                                        <p className="text-[10px] text-white/40 line-clamp-2">{t.client_query}</p>
                                        {t.ai_brief && <p className="text-[10px] text-amber-400/40 italic line-clamp-2">AI: {t.ai_brief}</p>}
                                        {t.status === "resolved" && t.expert_reply && (
                                            <div className="bg-green-500/5 border border-green-500/10 rounded-lg px-2 py-1.5 text-[10px] text-green-400/70">
                                                <span className="text-green-300/50">{t.resolved_by}:</span> {t.expert_reply}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 后方空投弹药已到达 ── */}
                    {incomingAmmo.length > 0 && (
                        <div className="rounded-2xl border border-green-500/15 bg-green-500/[0.03] p-4 space-y-3">
                            <h3 className="text-xs font-bold text-green-400/70">🚁 后方空投弹药已到达</h3>
                            {incomingAmmo.map((t) => (
                                <div key={t.id} className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 text-xs text-green-400/60">
                                    <span className="font-bold text-green-300/50">来自总部的特批指示 ({new Date(t.created_at).toLocaleTimeString("zh-CN")})：</span><br />
                                    {t.expert_reply || "（总部已查收，执行特批预案）"}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Helpers ──
function InfoBox({ color, text }: { color: string; text: string }) {
    const colors: Record<string, string> = {
        blue: "bg-blue-500/5 border-blue-500/10 text-blue-400/60",
        amber: "bg-amber-500/5 border-amber-500/10 text-amber-400/60",
        green: "bg-green-500/5 border-green-500/10 text-green-400/60",
    }
    return <div className={`p-4 rounded-xl border text-xs ${colors[color] || colors.blue}`}>{text}</div>
}
