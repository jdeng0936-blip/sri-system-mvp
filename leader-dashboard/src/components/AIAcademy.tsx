/**
 * 🎓 AI 实战伴学中心
 * 原版 app.py L1794-1922
 * - 项目选择 → AI出题 → 用户作答 → 4维100分评分 → 满分示范
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSettings } from "@/contexts/SettingsContext"

interface Project { id: number; name: string; stage: string }

export function AIAcademy() {
    const { settings } = useSettings()
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<number>(0)
    const [quiz, setQuiz] = useState("")
    const [answer, setAnswer] = useState("")
    const [feedback, setFeedback] = useState("")
    const [loadingQuiz, setLoadingQuiz] = useState(false)
    const [loadingEval, setLoadingEval] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        fetch("http://localhost:8000/api/projects")
            .then(r => r.json())
            .then((data: Project[]) => {
                setProjects(data)
                if (data.length > 0) setSelectedProjectId(data[0].id)
            })
            .catch(() => { })
    }, [])

    async function handleGenerateQuiz() {
        setLoadingQuiz(true)
        setQuiz("")
        setFeedback("")
        setAnswer("")
        setError("")
        try {
            const res = await fetch("http://localhost:8000/api/ai/generate_quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-Key": settings.apiKey || "" },
                body: JSON.stringify({ project_id: selectedProjectId }),
            })
            const data = await res.json()
            if (data.success) setQuiz(data.quiz)
            else setError(data.error || "出题失败")
        } catch (e) { setError(`${e}`) }
        setLoadingQuiz(false)
    }

    async function handleSubmitAnswer() {
        if (!answer.trim()) { setError("请先输入您的应对话术"); return }
        setLoadingEval(true)
        setFeedback("")
        setError("")
        try {
            const res = await fetch("http://localhost:8000/api/ai/coach_evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-Key": settings.apiKey || "" },
                body: JSON.stringify({ project_id: selectedProjectId, quiz, answer }),
            })
            const data = await res.json()
            if (data.success) setFeedback(data.feedback)
            else setError(data.error || "点评失败")
        } catch (e) { setError(`${e}`) }
        setLoadingEval(false)
    }

    const selectClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">🎓 AI 实战伴学中心</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">SALES COMBAT ACADEMY — 基于真实项目情报，AI 教练量身定制刁钻实战演练题</p>
                </div>

                {/* Project selector */}
                <select value={selectedProjectId} onChange={e => setSelectedProjectId(Number(e.target.value))} className={selectClass}>
                    {projects.map(p => <option key={p.id} value={p.id}>📂 {p.name} ({p.stage})</option>)}
                </select>

                {/* Generate quiz */}
                <Button variant="default" className="w-full text-sm py-3" disabled={loadingQuiz} onClick={handleGenerateQuiz}>
                    {loadingQuiz ? "⏳ AI 教练正在基于三维框架出题..." : "🎯 生成今日实战测验卡"}
                </Button>

                {/* Quiz display */}
                {quiz && (
                    <Card className="bg-amber-500/5 border border-amber-500/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-amber-400">📋 今日实战题</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed">{quiz}</pre>
                        </CardContent>
                    </Card>
                )}

                {/* Answer area */}
                {quiz && (
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">🗣️ 实战模拟与破局演练</CardTitle>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">场景：假设你是负责该项目的销售，面对 AI 教头给出的刁钻局势，请写出具体的战术动作或应对话术。</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <textarea
                                value={answer}
                                onChange={e => setAnswer(e.target.value)}
                                placeholder="请写下你的应对话术或策略..."
                                rows={6}
                                className={`${selectClass} resize-none`}
                            />
                            <Button variant="default" className="w-full text-sm" disabled={loadingEval || !answer.trim()} onClick={handleSubmitAnswer}>
                                {loadingEval ? "⏳ 王牌教头正在逐句拆解您的话术..." : "📮 提交策略并获取 AI 点评"}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Coach feedback */}
                {feedback && (
                    <Card className="bg-emerald-500/5 border border-emerald-500/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-emerald-400">✅ AI 销售教头诊断报告</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed">{feedback}</pre>
                        </CardContent>
                    </Card>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 text-xs text-red-400">❌ {error}</div>
                )}
            </div>
        </div>
    )
}
