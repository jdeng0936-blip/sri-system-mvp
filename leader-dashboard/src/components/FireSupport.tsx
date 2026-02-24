/**
 * 🛠️ 智能火力支援系统
 * 原版 app.py L1422-1737 完整复刻
 * - 渠道切换 (微信/邮件)
 * - 目标人物选择
 * - 项目阶段
 * - 高级技术配置 (竞品/现状/痛点/角色)
 * - 总监助销模式
 * - 内线教练弹药库 (领导态度/历史)
 * - 3个 AI 生成按钮
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useGlobalParams } from "@/store/globalParamsStore"
import { useSettings } from "@/contexts/SettingsContext"
import { cn } from "@/lib/utils"

interface FireSupportProps {
    projectId: number
    projectName: string
    stakeholders: { name: string }[]
    userRole?: string
}

type GeneratingTarget = "followup" | "tech" | "insider" | null

export function FireSupport({ projectId, projectName, stakeholders, userRole }: FireSupportProps) {
    const { params } = useGlobalParams()
    const { settings } = useSettings()

    // Channel
    const [channel, setChannel] = useState<"wechat" | "email">("wechat")

    // Target person
    const personOptions = ["综合/关键决策人 (默认)", ...stakeholders.filter(s => s.name).map(s => s.name)]
    const [targetPerson, setTargetPerson] = useState(personOptions[0])

    // Stage
    const [projectStage, setProjectStage] = useState(params.projectStages[0])

    // Historical value
    const [useHistorical, setUseHistorical] = useState(false)
    const [sharedHistory, setSharedHistory] = useState("")

    // Director mode
    const isDirector = userRole === "区域总监" || userRole === "销售VP"
    const [subordinateName, setSubordinateName] = useState("")

    // Tech config
    const [techCompetitor, setTechCompetitor] = useState("")
    const [techStatus, setTechStatus] = useState("")
    const [techPainPoints, setTechPainPoints] = useState<string[]>([])
    const [techRole, setTechRole] = useState<string[]>([])

    // Insider config
    const [leaderAttitude, setLeaderAttitude] = useState(params.leaderAttitudes[0] || "")
    const [leaderHistory, setLeaderHistory] = useState(params.leaderHistories[0] || "")

    // Generation state
    const [generating, setGenerating] = useState<GeneratingTarget>(null)
    const [generatedContent, setGeneratedContent] = useState("")
    const [generatedLabel, setGeneratedLabel] = useState("")
    const [error, setError] = useState("")

    const resolvedPerson = targetPerson === "综合/关键决策人 (默认)" ? "关键决策人" : targetPerson

    async function handleGenerate(type: GeneratingTarget) {
        if (!type) return
        setGenerating(type)
        setGeneratedContent("")
        setError("")

        const base = "http://localhost:8000"
        let url = ""
        let body: Record<string, unknown> = { project_id: projectId }

        if (type === "followup") {
            url = `${base}/api/ai/generate_followup`
            body = {
                ...body,
                channel,
                target_person: resolvedPerson,
                project_stage: projectStage,
                use_top_to_top: useHistorical,
                shared_history: sharedHistory,
                is_director: isDirector,
                subordinate_name: subordinateName,
            }
            setGeneratedLabel(channel === "wechat" ? "微信跟进话术" : "邮件跟进话术")
        } else if (type === "tech") {
            url = `${base}/api/ai/generate_tech_summary`
            body = {
                ...body,
                channel,
                tech_competitor: techCompetitor,
                tech_status: techStatus,
                tech_pain_points: techPainPoints,
                tech_role: techRole,
            }
            setGeneratedLabel("技术方案摘要")
        } else if (type === "insider") {
            url = `${base}/api/ai/generate_insider_ammo`
            body = {
                ...body,
                channel,
                target_person: resolvedPerson,
                project_stage: projectStage,
                leader_attitude: leaderAttitude,
                leader_history: leaderHistory,
            }
            setGeneratedLabel("内线专属话术")
        }

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": settings.apiKey || "",
                },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (data.success) {
                setGeneratedContent(data.content)
            } else {
                setError(data.error || "生成失败")
            }
        } catch (e) {
            setError(`网络错误: ${e}`)
        }
        setGenerating(null)
    }

    function togglePainPoint(p: string) {
        setTechPainPoints(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
    }
    function toggleRole(r: string) {
        setTechRole(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
    }

    return (
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                    🛠️ 智能火力支援 (弹药库)
                    <Badge variant="outline" className="text-[9px]">{projectName}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* ── 渠道切换 ── */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setChannel("wechat")}
                        className={cn(
                            "flex-1 py-1.5 text-xs rounded-md border transition-colors",
                            channel === "wechat"
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"
                        )}
                    >
                        🟢 微信/短信
                    </button>
                    <button
                        onClick={() => setChannel("email")}
                        className={cn(
                            "flex-1 py-1.5 text-xs rounded-md border transition-colors",
                            channel === "email"
                                ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"
                        )}
                    >
                        📧 正式邮件
                    </button>
                </div>

                {/* ── 目标人物 + 阶段 ── */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🎯 发送对象</label>
                        <select
                            value={targetPerson}
                            onChange={(e) => setTargetPerson(e.target.value)}
                            className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                        >
                            {personOptions.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">📊 项目阶段</label>
                        <select
                            value={projectStage}
                            onChange={(e) => setProjectStage(e.target.value)}
                            className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                        >
                            {params.projectStages.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {/* ── 历史价值调取 ── */}
                <label className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer">
                    <input type="checkbox" checked={useHistorical} onChange={(e) => setUseHistorical(e.target.checked)} className="rounded" />
                    🕰️ 调取历史价值 (引入过往交集/高层资源)
                </label>
                {useHistorical && (
                    <input
                        type="text"
                        value={sharedHistory}
                        onChange={(e) => setSharedHistory(e.target.value)}
                        placeholder="手动补充：例如 18年一期项目时的并肩作战..."
                        className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50"
                    />
                )}

                {/* ── 总监助销模式 ── */}
                {isDirector && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2 space-y-2">
                        <p className="text-[10px] text-amber-400">👑 已触发总监助销模式 — 以高管身份生成降维打击话术</p>
                        <input
                            type="text"
                            value={subordinateName}
                            onChange={(e) => setSubordinateName(e.target.value)}
                            placeholder="负责该项目的下属姓名（例：小王）"
                            className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))]"
                        />
                    </div>
                )}

                <Separator className="bg-[hsl(var(--border))]/30" />

                {/* ── 高级技术配置 (四维精准制导) ── */}
                <details className="group">
                    <summary className="cursor-pointer text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                        ⚙️ 高级技术方案配置 (四维精准制导)
                    </summary>
                    <div className="mt-3 space-y-3 pl-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">⚔️ 对比友商</label>
                                <input type="text" value={techCompetitor} onChange={(e) => setTechCompetitor(e.target.value)} placeholder="例：西门子、ABB" className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">📊 客户现状</label>
                                <input type="text" value={techStatus} onChange={(e) => setTechStatus(e.target.value)} placeholder="例：一期设备老化严重" className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))]" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🎯 核心痛点 (多选)</label>
                            <div className="flex flex-wrap gap-1.5">
                                {params.painPointOptions.map(p => (
                                    <button key={p} onClick={() => togglePainPoint(p)} className={cn(
                                        "px-2 py-0.5 text-[10px] rounded-full border transition-colors",
                                        techPainPoints.includes(p)
                                            ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]"
                                            : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                    )}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[hsl(var(--muted-foreground))]">👤 沟通对象角色 (多选)</label>
                            <div className="flex flex-wrap gap-1.5">
                                {params.roleOptions.map(r => (
                                    <button key={r} onClick={() => toggleRole(r)} className={cn(
                                        "px-2 py-0.5 text-[10px] rounded-full border transition-colors",
                                        techRole.includes(r)
                                            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                                            : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                                    )}>
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </details>

                <Separator className="bg-[hsl(var(--border))]/30" />

                {/* ── 生成按钮 ── */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        className="text-xs"
                        disabled={generating !== null}
                        onClick={() => handleGenerate("followup")}
                    >
                        {generating === "followup" ? "⏳ 生成中..." : "✉️ 一键跟进话术"}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={generating !== null}
                        onClick={() => handleGenerate("tech")}
                    >
                        {generating === "tech" ? "⏳ 生成中..." : "📄 技术方案摘要"}
                    </Button>
                </div>

                {/* ── 内线教练弹药库 ── */}
                <details className="group">
                    <summary className="cursor-pointer text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                        🕵️‍♂️ 内线专属通道 (教练弹药库)
                    </summary>
                    <div className="mt-3 space-y-3 pl-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🧠 领导态度</label>
                                <select
                                    value={leaderAttitude}
                                    onChange={(e) => setLeaderAttitude(e.target.value)}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-[10px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                >
                                    {params.leaderAttitudes.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🕰️ 历史轨迹</label>
                                <select
                                    value={leaderHistory}
                                    onChange={(e) => setLeaderHistory(e.target.value)}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-[10px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                >
                                    {params.leaderHistories.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full text-xs"
                            disabled={generating !== null}
                            onClick={() => handleGenerate("insider")}
                        >
                            {generating === "insider" ? "⏳ 生成中..." : "🔥 一键生成【内线向上汇报/控标】专属隐蔽话术"}
                        </Button>
                    </div>
                </details>

                {/* ── 生成结果 ── */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3">
                        <p className="text-xs text-red-400">❌ {error}</p>
                    </div>
                )}
                {generatedContent && (
                    <div className="bg-[hsl(var(--background))]/50 border border-[hsl(var(--border))]/50 rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-emerald-400">✅ {generatedLabel} — 可直接复制发送</p>
                            <button
                                onClick={() => { navigator.clipboard.writeText(generatedContent) }}
                                className="text-[10px] px-2 py-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))]/30 rounded transition-colors"
                            >
                                📋 复制
                            </button>
                        </div>
                        <pre className="text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                            {generatedContent}
                        </pre>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
