/**
 * 💬 AI 参谋部 — 项目级对话式问答
 * 原版 app.py L1741-1791 复刻
 * - 项目上下文感知
 * - 聊天历史记录
 * - 清空功能
 */

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSettings } from "@/contexts/SettingsContext"
import { cn } from "@/lib/utils"

interface Message {
    role: "user" | "assistant"
    content: string
}

interface AdvisorChatProps {
    projectId: number | null
    projectName: string
}

export function AdvisorChat({ projectId, projectName }: AdvisorChatProps) {
    const { settings } = useSettings()
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    async function handleSend() {
        const query = input.trim()
        if (!query || loading) return

        const userMsg: Message = { role: "user", content: query }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput("")
        setLoading(true)
        setError("")

        try {
            const res = await fetch("http://localhost:8000/api/ai/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": settings.apiKey || "",
                },
                body: JSON.stringify({
                    project_id: projectId,
                    messages: newMessages,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setMessages(prev => [...prev, { role: "assistant", content: data.content }])
            } else {
                setError(data.error || "参谋部无响应")
            }
        } catch (e) {
            setError(`网络错误: ${e}`)
        }
        setLoading(false)
    }

    return (
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                        💬 AI 参谋部
                        <Badge variant="outline" className="text-[9px]">{projectName || "未选择项目"}</Badge>
                    </CardTitle>
                    {messages.length > 0 && (
                        <button
                            onClick={() => { setMessages([]); setError("") }}
                            className="text-[10px] px-2 py-0.5 text-[hsl(var(--muted-foreground))] hover:text-red-400 border border-[hsl(var(--border))]/30 rounded transition-colors"
                        >
                            🧹 清空
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Chat messages */}
                <div
                    ref={scrollRef}
                    className="max-h-[300px] overflow-y-auto space-y-2 pr-1"
                >
                    {messages.length === 0 && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">
                            🎖️ 参谋部待命中 — 输入任何关于当前项目的问题
                        </p>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={cn(
                            "text-xs rounded-md px-3 py-2",
                            msg.role === "user"
                                ? "bg-blue-500/10 text-blue-300 ml-8"
                                : "bg-[hsl(var(--background))]/50 text-[hsl(var(--foreground))] mr-4"
                        )}>
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                {msg.role === "user" ? "🫵 你" : "🎖️ 参谋"}
                            </span>
                            <pre className="whitespace-pre-wrap mt-1 leading-relaxed">{msg.content}</pre>
                        </div>
                    ))}
                    {loading && (
                        <div className="text-xs text-[hsl(var(--muted-foreground))] animate-pulse px-3 py-2">
                            🧠 参谋正在分析项目情报并拟定建议...
                        </div>
                    )}
                    {error && (
                        <div className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
                            ❌ {error}
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                        placeholder="例：这个项目谁是真正拍板的人？竞品有什么弱点？"
                        disabled={loading}
                        className="flex-1 bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                    />
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="text-xs px-3"
                    >
                        {loading ? "⏳" : "📤"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
