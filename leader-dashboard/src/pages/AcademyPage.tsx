/**
 * AcademyPage.tsx — 🧠 AI 军师伴学 (Grok-Style Co-Pilot Chat Arena)
 * ==================================================================
 * Phase 4.12: 全屏沉浸式对话场
 *   1. 上下文锚点 (全局/项目)
 *   2. Chat 瀑布流 (用户右侧/AI左侧 + 思考卡片 + Quick Replies)
 *   3. Omni-Input Bar (多行+附件+语音)
 *
 * Backend: POST /api/ai/generate-quiz  { project_id, prompt }
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { api, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    Send, Loader2, Paperclip, Mic, Square, Brain,
    ChevronDown, Sparkles, User, Bot,
} from "lucide-react"
import toast from "react-hot-toast"

/* ── Message Types ── */
interface ThinkingStep {
    emoji: string
    text: string
}

interface QuickReply {
    label: string
    value: string
}

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    thinkingSteps?: ThinkingStep[]
    quickReplies?: QuickReply[]
    modelUsed?: string
}

/* ── AI thinking simulation based on user input ── */
function generateThinkingSteps(input: string): ThinkingStep[] {
    const steps: ThinkingStep[] = []
    if (input.includes("见") || input.includes("拜访")) steps.push({ emoji: "🧠", text: "正在从对话中提取关键决策人..." })
    if (input.includes("价") || input.includes("贵") || input.includes("便宜")) steps.push({ emoji: "💰", text: "触发价格异议处理模块，搜索历史成功案例..." })
    if (input.includes("竞") || input.includes("友商") || input.includes("对手")) steps.push({ emoji: "⚔️", text: "激活竞品情报分析引擎..." })
    if (input.includes("技术") || input.includes("方案") || input.includes("参数")) steps.push({ emoji: "🔧", text: "检索产品技术优势数据库..." })
    if (input.includes("合同") || input.includes("签") || input.includes("成交")) steps.push({ emoji: "📋", text: "加载合同审批流程知识库..." })
    if (steps.length === 0) steps.push({ emoji: "🧠", text: "分析情报上下文，匹配最佳策略模型..." })
    steps.push({ emoji: "✍️", text: "正在生成战术建议报告..." })
    return steps
}

/* ── Generate quick replies based on AI response ── */
function generateQuickReplies(input: string): QuickReply[] {
    const replies: QuickReply[] = []
    if (input.includes("价") || input.includes("贵")) {
        replies.push({ label: "📊 帮我算一份 ROI 测算表", value: "请帮我针对当前项目生成一份 ROI 投资回报率测算大纲，突出全生命周期成本优势" })
        replies.push({ label: "💡 给我 3 种破价话术", value: "请给我3种应对客户嫌贵的实战话术，要具体到台词级别" })
    }
    if (input.includes("见") || input.includes("拜访")) {
        replies.push({ label: "📅 帮我定下次跟进计划", value: "请帮我制定下一步跟进计划，包含时间节点和行动项" })
        replies.push({ label: "📝 帮我写跟进邮件", value: "请帮我写一封专业的拜访后跟进邮件" })
    }
    if (input.includes("竞") || input.includes("友商")) {
        replies.push({ label: "⚔️ 深挖竞品弱点", value: "请详细分析竞品的核心弱点和我方可以攻击的差异化优势" })
    }
    if (replies.length === 0) {
        replies.push({ label: "🎯 帮我制定下一步行动", value: "请基于当前情况，帮我制定具体的下一步行动计划" })
        replies.push({ label: "📊 生成项目分析报告", value: "请帮我生成一份当前项目的全维度分析报告" })
    }
    return replies.slice(0, 3)
}

export function AcademyPage() {
    const user = useAuthStore((s) => s.user)

    /* ── State ── */
    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [contextMode, setContextMode] = useState<"global" | number>("global")
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputText, setInputText] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const [currentThinkingSteps, setCurrentThinkingSteps] = useState<ThinkingStep[]>([])
    const [thinkingIndex, setThinkingIndex] = useState(0)

    // Voice
    const [isRecording, setIsRecording] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    /* ── Load projects ── */
    const loadProjects = useCallback(async () => {
        try {
            const { data } = await api.get("/api/projects")
            setProjects(data)
        } catch (_e) { /* */ }
    }, [])
    useEffect(() => { loadProjects() }, [loadProjects])

    /* ── Auto-scroll ── */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, currentThinkingSteps, thinkingIndex])

    /* ── Welcome message ── */
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                id: "welcome",
                role: "assistant",
                content: `${user?.name || "战士"}你好！我是你的 AI 军师 🧠\n\n我已接入全公司的作战沙盘、情报库和知识武器库。无论你在拜访现场遇到了什么卡点，还是需要准备方案、分析竞品、处理价格异议，随时告诉我。\n\n💡 试试对我说：\n• "我刚见完东风的李总，他嫌贵"\n• "帮我分析一下西门子的弱点"\n• "下周要做技术交流，帮我准备大纲"`,
                timestamp: new Date(),
                quickReplies: [
                    { label: "🗺️ 查看我的作战全局", value: "请帮我review一下当前所有在跟项目的整体局势" },
                    { label: "📊 今日情报速递", value: "请帮我汇总今天最新录入的情报，给出关键变化和风险提示" },
                    { label: "🎯 今天应该打哪个项目", value: "请根据各项目的紧急程度和赢率，推荐我今天应该优先跟进哪个项目" },
                ],
            }])
        }
    }, [user?.name, messages.length])

    /* ── Send message ── */
    const sendMessage = async (text?: string) => {
        const msgText = text || inputText.trim()
        if (!msgText) return
        if (!text) setInputText("")

        // Add user message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: msgText,
            timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMsg])

        // Show thinking animation
        setIsThinking(true)
        const steps = generateThinkingSteps(msgText)
        setCurrentThinkingSteps(steps)
        setThinkingIndex(0)

        // Animate through thinking steps
        for (let i = 0; i < steps.length; i++) {
            await new Promise((r) => setTimeout(r, 600 + Math.random() * 400))
            setThinkingIndex(i + 1)
        }

        // Call AI
        try {
            const projectId = contextMode === "global" ? (projects[0]?.id || 1) : contextMode
            const contextLabel = contextMode === "global" ? "全局模式" : projects.find((p) => p.id === contextMode)?.name || ""
            const { data } = await api.post("/api/ai/generate-quiz", {
                project_id: projectId,
                prompt: `你是一名顶级的工业电气销售AI军师。请以对话式、有温度的方式回复。
上下文模式: ${contextLabel}
销售人员说: "${msgText}"

请给出：
1. 对情况的快速判断
2. 具体的战术建议（要到台词级别）
3. 下一步行动建议

用简洁有力的中文回复，不要用markdown标题，直接说人话。`,
            })
            const aiContent = data.result || data.error || "抱歉，AI 暂时无法回复，请稍后重试。"
            const quickReplies = generateQuickReplies(msgText)

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: aiContent,
                timestamp: new Date(),
                thinkingSteps: steps,
                quickReplies,
                modelUsed: data.model_used,
            }
            setMessages((prev) => [...prev, aiMsg])
        } catch (_e) {
            // Fallback demo response
            const fallbackReplies = generateQuickReplies(msgText)
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `收到！让我分析一下你说的情况。\n\n基于你提到的内容，这是我的初步判断：\n• 这种情况在 B2B 销售中很常见，关键是要把"价格"话题转为"价值"话题\n• 建议从全生命周期成本（TCO）角度切入 — 我们的产品虽然初始采购价高 10-15%，但运维成本低 30%+\n• 同时要注意这可能是竞品在背后恶意杀价的信号\n\n⚡ 下一步建议：\n1. 准备一份 ROI 对比表，用数据说话\n2. 找到项目中的"技术派"决策人作为突破口\n3. 安排一次工厂参观或样板工程考察`,
                timestamp: new Date(),
                thinkingSteps: generateThinkingSteps(msgText),
                quickReplies: fallbackReplies,
            }
            setMessages((prev) => [...prev, aiMsg])
        }
        setIsThinking(false)
        setCurrentThinkingSteps([])
        setThinkingIndex(0)
    }

    /* ── Voice recording ── */
    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop()
            setIsRecording(false)
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const recorder = new MediaRecorder(stream)
            chunksRef.current = []
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
            recorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop())
                setInputText((prev) => prev ? prev + "\n[🎙️ 已录入语音，请补充关键要点]" : "[🎙️ 已录入语音，请补充关键要点]")
                toast.success("✅ 录音完成！请补充要点后发送")
            }
            recorder.start()
            mediaRecorderRef.current = recorder
            setIsRecording(true)
            toast.success("🎙️ 开始录音...")
        } catch (_e) {
            toast.error("无法访问麦克风")
        }
    }

    /* ── Key handler ── */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const contextLabel = contextMode === "global"
        ? "🌐 全局模式"
        : `📂 ${projects.find((p) => p.id === contextMode)?.name || "项目"}`

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] relative">
            {/* ═══ Top bar: Context anchor ═══ */}
            <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-2">
                    <Brain size={16} className="text-indigo-400" />
                    <span className="text-sm font-bold text-white/70">AI 军师伴学</span>
                    <span className="text-[9px] text-white/15 hidden sm:inline">Grok-Style Co-Pilot</span>
                </div>
                <div className="relative">
                    <select
                        value={contextMode}
                        onChange={(e) => setContextMode(e.target.value === "global" ? "global" : Number(e.target.value))}
                        className="appearance-none px-3 py-1.5 pr-7 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] text-white/50 cursor-pointer focus:outline-none focus:border-indigo-500/30 transition"
                    >
                        <option value="global" className="bg-[hsl(222,47%,9%)]">🌐 全局模式</option>
                        {projects.map((p) => <option key={p.id} value={p.id} className="bg-[hsl(222,47%,9%)]">📂 {p.name}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                </div>
            </div>

            {/* ═══ Chat stream ═══ */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] lg:max-w-[70%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                            {/* Avatar + time */}
                            <div className={`flex items-center gap-1.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${msg.role === "user"
                                        ? "bg-blue-500/20 border border-blue-500/30"
                                        : "bg-indigo-500/20 border border-indigo-500/30"
                                    }`}>
                                    {msg.role === "user" ? <User size={10} className="text-blue-400" /> : <Bot size={10} className="text-indigo-400" />}
                                </div>
                                <span className="text-[8px] text-white/10">{msg.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                                {msg.modelUsed && <span className="text-[7px] text-white/5">via {msg.modelUsed}</span>}
                            </div>

                            {/* Thinking steps (only for AI) */}
                            {msg.role === "assistant" && msg.thinkingSteps && msg.id !== "welcome" && (
                                <div className="space-y-0.5 pl-2">
                                    {msg.thinkingSteps.map((step, i) => (
                                        <div key={i} className="text-[9px] text-white/15 flex items-center gap-1">
                                            <span>{step.emoji}</span>
                                            <span className="italic">[{step.text}]</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Bubble */}
                            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                                    ? "bg-blue-600/20 border border-blue-500/20 text-white/80 rounded-tr-sm"
                                    : "bg-white/[0.03] border border-white/5 text-white/60 rounded-tl-sm"
                                }`}>
                                {msg.content}
                            </div>

                            {/* Quick replies */}
                            {msg.quickReplies && msg.quickReplies.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {msg.quickReplies.map((qr, i) => (
                                        <button key={i} onClick={() => sendMessage(qr.value)}
                                            disabled={isThinking}
                                            className="px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] text-[10px] text-indigo-300/60 hover:bg-indigo-500/10 hover:text-indigo-300/80 active:scale-[0.97] disabled:opacity-30 transition-all">
                                            {qr.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Live thinking animation */}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="max-w-[85%] lg:max-w-[70%] space-y-2">
                            <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                    <Bot size={10} className="text-indigo-400 animate-pulse" />
                                </div>
                                <span className="text-[8px] text-white/10">正在思考...</span>
                            </div>
                            <div className="space-y-1 pl-2">
                                {currentThinkingSteps.slice(0, thinkingIndex).map((step, i) => (
                                    <div key={i} className={`text-[9px] flex items-center gap-1 transition-opacity duration-500 ${i === thinkingIndex - 1 ? "text-indigo-400/60 animate-pulse" : "text-white/15"
                                        }`}>
                                        <span>{step.emoji}</span>
                                        <span className="italic">[{step.text}]</span>
                                    </div>
                                ))}
                                {thinkingIndex === currentThinkingSteps.length && (
                                    <div className="rounded-2xl rounded-tl-sm bg-white/[0.03] border border-white/5 px-4 py-3">
                                        <div className="flex items-center gap-2 text-xs text-white/20">
                                            <Loader2 size={12} className="animate-spin" /> 正在组织语言...
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ═══ Omni-Input Bar ═══ */}
            <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-white/5 bg-white/[0.01]">
                {/* Context indicator */}
                <div className="text-[9px] text-white/10 mb-1.5 flex items-center gap-1">
                    <Sparkles size={8} /> {contextLabel} · AI 军师随时待命
                </div>

                <div className="flex items-end gap-2">
                    {/* Attachment button */}
                    <div className="relative flex-shrink-0">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.wav,.mp3"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                    setInputText((prev) => prev ? prev + `\n[📎 附件: ${file.name}]` : `[📎 附件: ${file.name}]`)
                                    toast.success(`📎 ${file.name} 已附加`)
                                }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-8 h-8" />
                        <button className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/20 hover:text-white/40 hover:bg-white/[0.06] transition">
                            <Paperclip size={14} />
                        </button>
                    </div>

                    {/* Voice button */}
                    <button onClick={toggleRecording}
                        className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center transition ${isRecording
                                ? "bg-red-600 text-white animate-pulse"
                                : "bg-white/[0.04] border border-white/10 text-white/20 hover:text-white/40 hover:bg-white/[0.06]"
                            }`}>
                        {isRecording ? <Square size={10} /> : <Mic size={14} />}
                    </button>

                    {/* Text input */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="遇到卡点了？或者有什么新情报？随时告诉我，我来帮你处理..."
                            rows={1}
                            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/70 placeholder:text-white/12 resize-none focus:outline-none focus:border-indigo-500/30 transition leading-relaxed"
                            style={{ minHeight: "40px", maxHeight: "120px" }}
                            onInput={(e) => {
                                const t = e.currentTarget
                                t.style.height = "40px"
                                t.style.height = Math.min(t.scrollHeight, 120) + "px"
                            }}
                        />
                    </div>

                    {/* Send button */}
                    <button onClick={() => sendMessage()} disabled={isThinking || !inputText.trim()}
                        className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex-shrink-0 flex items-center justify-center text-white hover:brightness-110 active:scale-[0.95] disabled:opacity-30 transition-all shadow-lg shadow-indigo-500/10">
                        {isThinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>
        </div>
    )
}
