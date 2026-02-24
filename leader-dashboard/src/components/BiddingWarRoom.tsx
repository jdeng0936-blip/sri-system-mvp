/**
 * 📑 招投标控标 — 雷区 & 控标中心
 * 原版 app.py L2801-2872
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"


interface Project { id: number; name: string; stage: string }

const COMPETITOR_OPTIONS = ["西门子", "ABB", "施耐德", "江苏大全", "其他竞品"]

export function BiddingWarRoom() {
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState("")
    const [defenseFile, setDefenseFile] = useState<File | null>(null)
    const [targetCompetitor, setTargetCompetitor] = useState(COMPETITOR_OPTIONS[0])
    const [coreAdvantages, setCoreAdvantages] = useState("")
    const [customAdv, setCustomAdv] = useState("")
    const [defenseReport, setDefenseReport] = useState("")
    const [attackReport, setAttackReport] = useState("")
    const [loading, setLoading] = useState<"defense" | "attack" | null>(null)

    useEffect(() => {
        fetch("http://localhost:8000/api/projects")
            .then(r => r.json())
            .then((data: Project[]) => {
                setProjects(data)
                if (data.length > 0) setSelectedProject(data[0].name)
            })
            .catch(() => { })
    }, [])

    async function handleDefense() {
        if (!defenseFile) return
        setLoading("defense")
        // Placeholder — In production this would upload the file and call AI
        setTimeout(() => {
            setDefenseReport("🔌 (AI 拆标排雷引擎) 标书条款分析完成。\n\n⚠️ 风险项 1：第4.2条要求IP68级别防护，疑似为友商定制条款\n⚠️ 风险项 2：第6.1条质保期要求5年，超出行业惯例\n✅ 安全项：其余技术参数与我方产品完全匹配\n\n📌 建议：针对IP68条款，建议与客户沟通降级为IP67（我方标准配置），并提供权威第三方检测数据佐证。")
            setLoading(null)
        }, 1500)
    }

    async function handleAttack() {
        const fullAdv = [coreAdvantages, customAdv].filter(Boolean).join("；")
        if (!fullAdv) return
        setLoading("attack")
        setTimeout(() => {
            setAttackReport(`🔌 (AI 控标参数生成引擎)\n\n针对假想敌【${targetCompetitor}】，基于我方优势【${fullAdv}】生成以下控标建议：\n\n📌 技术参数控标：\n1. 要求提供"全密封免维护"设计认证（${targetCompetitor}目前不具备）\n2. 要求通过C5-M海洋级防腐标准测试\n\n📌 商务条款控标：\n1. 要求提供同行业≥3个同规格项目案例\n2. 要求具备本地化售后团队（≤2h响应）`)
            setLoading(null)
        }, 1500)
    }

    const selectClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">📑 招投标"雷区"与控标中心</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">BIDDING WAR ROOM — 拆解对手标书陷阱 / AI 生成排他性控标参数</p>
                </div>

                {/* Project selector */}
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className={selectClass}>
                    {projects.map(p => <option key={p.id} value={p.name}>{p.name} ({p.stage})</option>)}
                </select>

                {/* Defense / Attack columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 🛡️ Defense: 排雷 */}
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50 border-l-4 border-l-blue-500/50">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                🛡️ 标书拆解与防守 (排雷)
                                <Badge variant="outline" className="text-[9px]">防御分析</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                上传客户发来的 RFP / 招标文件，AI 将瞬间标出哪些参数是友商提前埋好的"雷"。
                            </p>
                            <div className="border border-dashed border-[hsl(var(--border))]/50 rounded-md p-4 text-center">
                                <input
                                    type="file"
                                    accept=".pdf,.docx"
                                    onChange={e => setDefenseFile(e.target.files?.[0] || null)}
                                    className="text-xs text-[hsl(var(--muted-foreground))]"
                                />
                                {defenseFile && (
                                    <p className="text-[10px] text-emerald-400 mt-1">📎 {defenseFile.name}</p>
                                )}
                            </div>
                            <Button
                                variant="default"
                                className="w-full text-xs"
                                disabled={!defenseFile || loading !== null}
                                onClick={handleDefense}
                            >
                                {loading === "defense" ? "⏳ AI 正在深度拆标..." : "🔍 AI 一键深度拆标排雷"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* ⚔️ Attack: 控标 */}
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50 border-l-4 border-l-red-500/50">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                ⚔️ 控标参数与进攻 (埋雷)
                                <Badge variant="destructive" className="text-[9px]">进攻模式</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                处于"领跑"身位时，让 AI 结合我方独家优势，生成极其隐蔽的排他性控标参数。
                            </p>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🎯 假想敌 (重点防范友商)</label>
                                <select value={targetCompetitor} onChange={e => setTargetCompetitor(e.target.value)} className={selectClass}>
                                    {COMPETITOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">💎 我方核心差异化优势</label>
                                <input
                                    type="text"
                                    value={coreAdvantages}
                                    onChange={e => setCoreAdvantages(e.target.value)}
                                    placeholder="例：全密封免维护/C5-M海洋级防腐"
                                    className={selectClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">✍️ 临时补充项目优势 (可选)</label>
                                <input
                                    type="text"
                                    value={customAdv}
                                    onChange={e => setCustomAdv(e.target.value)}
                                    placeholder="针对此项目临时想到的绝活..."
                                    className={selectClass}
                                />
                            </div>
                            <Button
                                variant="destructive"
                                className="w-full text-xs"
                                disabled={(!coreAdvantages && !customAdv) || loading !== null}
                                onClick={handleAttack}
                            >
                                {loading === "attack" ? "⏳ AI 正在生成控标参数..." : "💣 生成极具伪装性的控标参数"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Reports */}
                {defenseReport && (
                    <Card className="bg-[hsl(var(--card))] border border-blue-500/30">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">🚨 AI 标书深度排雷战报</CardTitle>
                                <button onClick={() => setDefenseReport("")} className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-red-400">🗑️ 清除</button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <pre className="text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed">{defenseReport}</pre>
                        </CardContent>
                    </Card>
                )}
                {attackReport && (
                    <Card className="bg-[hsl(var(--card))] border border-red-500/30">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">💣 AI 控标参数战报</CardTitle>
                                <button onClick={() => setAttackReport("")} className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-red-400">🗑️ 清除</button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <pre className="text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed">{attackReport}</pre>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
