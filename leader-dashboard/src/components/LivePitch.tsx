/**
 * 🎙️ 第一现场 — 沉浸式客户展厅与双向连线
 * 原版 app.py L1978-2278
 * Left: 客户交互大屏 (7种媒体 + 对话)
 * Right: 战术护目镜 (仅销售可见)
 */

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSettings } from "@/contexts/SettingsContext"
import { cn } from "@/lib/utils"

interface Project { id: number; name: string; stage: string }
interface ChatMessage { role: "user" | "assistant"; content: string }

export function LivePitch() {
    const { settings } = useSettings()
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState("")
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [tacticalAdvice, setTacticalAdvice] = useState("")
    const [mediaTab, setMediaTab] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetch("http://localhost:8000/api/projects")
            .then(r => r.json())
            .then((data: Project[]) => {
                setProjects(data)
                if (data.length > 0) setSelectedProject(data[0].name)
            })
            .catch(() => { })
    }, [])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages])

    const MEDIA_TABS = ["🎬 视频", "📊 PPT", "📐 CAD", "🎙️ 播客", "🗺️ 信息图", "📋 选型表", "✨ AI 模拟"]

    async function handleSend() {
        const q = input.trim()
        if (!q || loading) return

        const newMsgs: ChatMessage[] = [...messages, { role: "user", content: q }]
        setMessages(newMsgs)
        setInput("")
        setLoading(true)

        // Call chat endpoint for client-facing response
        try {
            const res = await fetch("http://localhost:8000/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-Key": settings.apiKey || "" },
                body: JSON.stringify({ project_id: null, messages: newMsgs }),
            })
            const data = await res.json()
            if (data.success) {
                setMessages(prev => [...prev, { role: "assistant", content: data.content }])
            }
        } catch { /* ignore */ }

        // Tactical goggles (sales-only advice)
        setTacticalAdvice(`🎯 话术拆解：客户问"${q.slice(0, 20)}..."，真正的担忧是技术可靠性和售后保障。\n💡 出牌建议：立即举出镇海炼化同规格案例，强调我方7×24小时本地化响应能力。`)

        setLoading(false)
    }

    const selectClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">🎙️ 第一现场</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">LIVE PITCH — 沉浸式客户展厅 & 双向连线 | 左: 客户大屏 / 右: 战术护目镜</p>
                </div>

                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className={selectClass}>
                    {projects.map(p => <option key={p.id} value={p.name}>🔗 {p.name} ({p.stage})</option>)}
                </select>

                {/* Dual-screen layout 6:4 */}
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                    {/* 🖥️ Client View (60%) */}
                    <div className="lg:col-span-6 space-y-4">
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">🖥️ 客户交互大屏 (Client View)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Media tabs */}
                                <div className="flex gap-1 overflow-x-auto">
                                    {MEDIA_TABS.map((tab, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setMediaTab(i)}
                                            className={cn(
                                                "px-2 py-1 text-[10px] rounded whitespace-nowrap border transition-colors",
                                                mediaTab === i
                                                    ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]"
                                                    : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                            )}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                {/* Media content placeholder */}
                                <div className="bg-[hsl(var(--background))]/50 rounded-md p-6 text-center min-h-[120px] flex items-center justify-center">
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                        {mediaTab === 0 && "🎬 演示视频：过往标杆项目设备吊装实录"}
                                        {mediaTab === 1 && "📊 交流 PPT：渲染对接企业云盘幻灯片"}
                                        {mediaTab === 2 && "📐 CAD 上图：预留 WebGL 三维模型接口"}
                                        {mediaTab === 3 && "🎙️ 行业播客：研发总工解读最新政策"}
                                        {mediaTab === 4 && "🗺️ TCO 全生命周期成本 vs 竞品 ROI 雷达图"}
                                        {mediaTab === 5 && "📋 选型对比表（旗舰 vs 标准型号）"}
                                        {mediaTab === 6 && "✨ 动态方案推演引擎 — 结合项目情报现场现编"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Chat area */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardContent className="pt-4 space-y-3">
                                <div ref={scrollRef} className="max-h-[200px] overflow-y-auto space-y-2">
                                    {messages.map((msg, i) => (
                                        <div key={i} className={cn(
                                            "text-xs rounded-md px-3 py-2",
                                            msg.role === "user"
                                                ? "bg-blue-500/10 text-blue-300 ml-8"
                                                : "bg-[hsl(var(--background))]/50 text-[hsl(var(--foreground))] mr-4"
                                        )}>
                                            <pre className="whitespace-pre-wrap">{msg.content}</pre>
                                        </div>
                                    ))}
                                    {loading && <p className="text-xs text-[hsl(var(--muted-foreground))] animate-pulse">🧠 AI 大脑正在分析...</p>}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleSend()}
                                        placeholder="🎙️ 现场遇阻？输入客户的刁钻发难..."
                                        className={selectClass}
                                    />
                                    <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()}>📤</Button>
                                </div>

                                {messages.length > 0 && (
                                    <button onClick={() => { setMessages([]); setTacticalAdvice("") }} className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-red-400">
                                        🧹 结束会议 (清空现场)
                                    </button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* 🥽 Sales Tactical Goggles (40%) */}
                    <div className="lg:col-span-4 space-y-4">
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50 border-l-4 border-l-amber-500/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    🥽 战术护目镜
                                    <Badge variant="outline" className="text-[9px]">Sales Only</Badge>
                                </CardTitle>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">🤫 仅销售可见的实时底牌与战术指导</p>
                            </CardHeader>
                            <CardContent>
                                {tacticalAdvice ? (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
                                        <pre className="text-xs text-amber-300 whitespace-pre-wrap leading-relaxed">{tacticalAdvice}</pre>
                                    </div>
                                ) : (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">*（等待捕捉现场客户提问...）*</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* SOS Button */}
                        <Button
                            variant="destructive"
                            className="w-full text-xs py-3"
                            disabled={!tacticalAdvice}
                        >
                            🆘 一键呼叫后方技术群 (企业微信连线)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
