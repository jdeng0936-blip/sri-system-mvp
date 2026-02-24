/**
 * AIAdvisor.tsx — AI 参谋部 (流式聊天)
 * ======================================
 * 基于项目情报上下文的战术对话界面
 * 支持消息历史 + 清空 + 项目切换时重置
 */

import { useState, useRef, useEffect } from "react"
import { chatWithProject } from "@/lib/apiClient"
import {
    MessageSquare,
    Send,
    Trash2,
    Loader2,
    Bot,
    User,
} from "lucide-react"

interface Message {
    role: "user" | "assistant"
    content: string
}

export function AIAdvisor({ projectId }: { projectId: number }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const prevProjectId = useRef(projectId)

    // 项目切换时重置
    useEffect(() => {
        if (prevProjectId.current !== projectId) {
            setMessages([])
            setInput("")
            prevProjectId.current = projectId
        }
    }, [projectId])

    // 自动滚动到底部
    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        })
    }, [messages])

    const handleSend = async () => {
        const trimmed = input.trim()
        if (!trimmed || loading) return

        const userMsg: Message = { role: "user", content: trimmed }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput("")
        setLoading(true)

        try {
            const res = await chatWithProject(projectId, newMessages)
            setMessages([
                ...newMessages,
                { role: "assistant", content: res.result || res.error || "无返回" },
            ])
        } catch (err: unknown) {
            const msg = (err as { message?: string })?.message || "调用失败"
            setMessages([
                ...newMessages,
                { role: "assistant", content: `❌ ${msg}` },
            ])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-base">💬</span>
                    <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                        AI 参谋部
                    </h3>
                    <div className="flex-1 h-px bg-white/5" />
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={() => setMessages([])}
                        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-white/5"
                    >
                        <Trash2 size={10} />
                        清空推演记录
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="rounded-xl border border-white/5 bg-white/[0.02] min-h-[200px] max-h-[400px] overflow-y-auto p-4 space-y-4 mb-3"
            >
                {messages.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-8 text-white/15">
                        <MessageSquare size={32} className="mb-2 opacity-30" />
                        <div className="text-xs">向参谋长提问…</div>
                        <div className="text-[10px] mt-1">
                            如：分析当前赢单率 / 生成周报 / 该项目的致命盲区
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                    >
                        {msg.role === "assistant" && (
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                <Bot size={14} className="text-emerald-400" />
                            </div>
                        )}
                        <div
                            className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                    ? "bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 text-white/80"
                                    : "bg-white/[0.04] border border-white/5 text-white/70"
                                }`}
                        >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                        {msg.role === "user" && (
                            <div className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))]/15 flex items-center justify-center shrink-0">
                                <User size={14} className="text-[hsl(var(--primary))]" />
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                            <Bot size={14} className="text-emerald-400" />
                        </div>
                        <div className="bg-white/[0.04] border border-white/5 rounded-xl px-4 py-3 text-sm text-white/40 flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            参谋长正在推演战局...
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="向参谋长提问（分析赢单率 / 生成周报 / 定点爆破策略）..."
                    disabled={loading}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition disabled:opacity-40"
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-sm flex items-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-emerald-500/20"
                >
                    <Send size={14} />
                </button>
            </div>
        </div>
    )
}
