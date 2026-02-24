import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettings } from "@/contexts/SettingsContext"
import { generatePitch, type PitchRequest } from "@/lib/apiClient"
import { cn } from "@/lib/utils"

// ── Types ──

type PitchType = "wechat_msg" | "email" | "internal_strategy" | "tech_solution"

interface TacticButton {
    type: PitchType
    icon: string
    label: string
    activeColor: string
}

const TACTICS: TacticButton[] = [
    { type: "wechat_msg", icon: "💬", label: "微信话术", activeColor: "border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)]" },
    { type: "email", icon: "📧", label: "商务邮件", activeColor: "border-blue-400 bg-blue-500/10 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.15)]" },
    { type: "internal_strategy", icon: "🕵️", label: "内部攻防", activeColor: "border-violet-400 bg-violet-500/10 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]" },
    { type: "tech_solution", icon: "📐", label: "技术方案", activeColor: "border-amber-400 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]" },
]

const PROJECT_STAGES = [
    { value: "初期接触", label: "🔍 初期接触" },
    { value: "方案报价", label: "📋 方案报价" },
    { value: "商务谈判", label: "💰 商务谈判" },
    { value: "技术僵持", label: "⚙️ 技术僵持" },
    { value: "逼单/签约", label: "🔥 逼单/签约" },
    { value: "丢单归档", label: "📦 丢单归档" },
]


// ── Component ──

interface Stakeholder {
    name: string
    title: string
    tags: string
}

interface AIAssistantProps {
    projectId: number | null
    projectName: string
    stakeholders: Stakeholder[]
}

export function AIAssistant({ projectId, projectName, stakeholders }: AIAssistantProps) {
    const { settings } = useSettings()

    // Tactic
    const [pitchType, setPitchType] = useState<PitchType | null>(null)

    // Precision guidance
    const [projectStage, setProjectStage] = useState("")
    const [targetRole, setTargetRole] = useState("")
    const [useHistory, setUseHistory] = useState(false)
    const [customInput, setCustomInput] = useState("")

    // Advanced tech config (collapsible)
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [competitor, setCompetitor] = useState("")
    const [currentStatus, setCurrentStatus] = useState("")
    const [painPoints, setPainPoints] = useState("")

    // Request state
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Tactic selection (reset result/error)
    const handleTacticSelect = (type: PitchType) => {
        if (pitchType === type) {
            setPitchType(null)
        } else {
            setPitchType(type)
            setResult(null)
            setError(null)
        }
    }

    // Generate
    const handleGenerate = useCallback(async () => {
        if (!projectId) {
            setError("请先在上方选择一个项目")
            return
        }
        if (!pitchType) return

        const hasAnyKey = settings.apiKey ||
            settings.llmConfigs.openai.apiKey ||
            settings.llmConfigs.gemini.apiKey ||
            settings.llmConfigs.anthropic.apiKey ||
            settings.llmConfigs.xai.apiKey
        if (!hasAnyKey) {
            setError("⚠️ 请先在右上角 ⚙️ 系统设置中配置 AI 引擎 Key")
            return
        }

        setLoading(true)
        setResult(null)
        setError(null)

        const req: PitchRequest = {
            project_id: projectId,
            pitch_type: pitchType,
        }
        if (targetRole && targetRole !== "default") req.target_role = targetRole
        if (customInput.trim()) req.custom_input = customInput.trim()
        if (projectStage) req.project_stage = projectStage
        if (useHistory) req.use_history = true
        if (competitor.trim()) req.competitor = competitor.trim()
        if (currentStatus.trim()) req.current_status = currentStatus.trim()
        if (painPoints.trim()) req.pain_points = painPoints.trim()

        const data = await generatePitch(req, settings.apiKey, settings.llmConfigs)

        if (data.error) {
            setError(data.error)
        } else if (data.pitch) {
            setResult(data.pitch)
        }
        setLoading(false)
    }, [projectId, pitchType, targetRole, customInput, projectStage, useHistory, competitor, currentStatus, painPoints, settings])

    // Copy
    const handleCopy = () => {
        if (!result) return
        navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50 overflow-hidden">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">✨</span>
                        <span className="text-sm font-bold text-[hsl(var(--foreground))]">AI 军师</span>
                    </div>
                    {projectName && (
                        <Badge variant="outline" className="text-[9px] font-mono max-w-[140px] truncate">
                            {projectName}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* ── Tactic Buttons ── */}
                <div className="grid grid-cols-4 gap-2">
                    {TACTICS.map((t) => (
                        <button
                            key={t.type}
                            onClick={() => handleTacticSelect(t.type)}
                            className={cn(
                                "flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-xs transition-all",
                                pitchType === t.type
                                    ? t.activeColor
                                    : "border-[hsl(var(--border))]/20 bg-[hsl(var(--background))]/30 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))]/60"
                            )}
                        >
                            <span className="text-base">{t.icon}</span>
                            <span className="font-medium truncate w-full text-center text-[11px]">{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Precision Guidance Form ── */}
                {pitchType && (
                    <div className="space-y-3 p-3 rounded-lg bg-[hsl(var(--background))]/40 border border-[hsl(var(--border))]/20">
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                            🎯 精准制导参数
                        </p>

                        {/* Row 1: Project Stage + Target Role */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* Project Stage */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">当前项目阶段</label>
                                <Select value={projectStage} onValueChange={setProjectStage}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="选择阶段..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROJECT_STAGES.map((s) => (
                                            <SelectItem key={s.value} value={s.value}>
                                                {s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Target Role (Dynamic Stakeholders) */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">发送对象</label>
                                <Select value={targetRole} onValueChange={setTargetRole}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="🎯 综合/通用策略" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">
                                            🎯 综合/通用策略 (未指定具体人物)
                                        </SelectItem>
                                        {stakeholders.map((s, i) => (
                                            <SelectItem key={i} value={`${s.name}|${s.title}|${s.tags}`}>
                                                {s.name} - {s.title} [{s.tags}]
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* History Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <button
                                type="button"
                                onClick={() => setUseHistory(!useHistory)}
                                className={cn(
                                    "w-4 h-4 rounded border transition-all flex items-center justify-center shrink-0",
                                    useHistory
                                        ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
                                        : "border-[hsl(var(--border))]/50 hover:border-[hsl(var(--primary))]/50"
                                )}
                            >
                                {useHistory && <span className="text-[10px]">✓</span>}
                            </button>
                            <span className="text-xs text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors">
                                🕰️ 调取历史价值 <span className="opacity-60">(引入过往交集/高层资源/历史项目)</span>
                            </span>
                        </label>

                        {/* ── Advanced Tech Config (Collapsible) ── */}
                        <div className="rounded-md border border-[hsl(var(--border))]/20 overflow-hidden">
                            <button
                                onClick={() => setAdvancedOpen(!advancedOpen)}
                                className="w-full flex items-center justify-between px-2.5 py-2 bg-[hsl(var(--background))]/30 hover:bg-[hsl(var(--background))]/50 transition-colors"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px]">{advancedOpen ? "▾" : "▸"}</span>
                                    <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                                        🔬 高级技术方案配置
                                    </span>
                                </div>
                                {(competitor || currentStatus || painPoints) && (
                                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                )}
                            </button>

                            {advancedOpen && (
                                <div className="px-2.5 pb-2.5 pt-2 space-y-2 border-t border-[hsl(var(--border))]/10">
                                    {/* Competitor */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                            ⚔️ 明确对比友商
                                        </label>
                                        <Input
                                            type="text"
                                            value={competitor}
                                            onChange={(e) => setCompetitor(e.target.value)}
                                            placeholder="例: 西门子、ABB"
                                            className="h-7 text-xs"
                                        />
                                    </div>

                                    {/* Current Status */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                            🏭 客户当前系统现状
                                        </label>
                                        <textarea
                                            value={currentStatus}
                                            onChange={(e) => setCurrentStatus(e.target.value)}
                                            placeholder="例: 一期设备老化严重，经常跳闸..."
                                            rows={2}
                                            className="w-full rounded-md border border-[hsl(var(--border))]/30 bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]/50 resize-none"
                                        />
                                    </div>

                                    {/* Pain Points */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                            🔥 客户核心痛点
                                        </label>
                                        <Input
                                            type="text"
                                            value={painPoints}
                                            onChange={(e) => setPainPoints(e.target.value)}
                                            placeholder="输入核心痛点"
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Custom Input (前线情报) */}
                        <div className="space-y-1">
                            <label className="text-[10px] text-[hsl(var(--muted-foreground))]">💡 补充前线情报（可选）</label>
                            <textarea
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                placeholder="例如：客户今天刚被集团大老板痛批，急需降本增效..."
                                rows={3}
                                className="w-full rounded-md border border-[hsl(var(--border))]/30 bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]/50 resize-none"
                            />
                        </div>

                        {/* Generate Button */}
                        <Button
                            onClick={handleGenerate}
                            disabled={loading || !projectId}
                            className="w-full h-9 text-xs font-bold gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    AI 正在生成...
                                </>
                            ) : (
                                <>⚡ 生成专属策略</>
                            )}
                        </Button>
                    </div>
                )}

                {/* Loading Skeleton */}
                {loading && (
                    <div className="space-y-2 p-4 rounded-lg bg-[hsl(var(--background))]/60 border border-[hsl(var(--border))]/20">
                        <div className="h-3 w-4/5 rounded bg-[hsl(var(--muted))]/30 animate-pulse" />
                        <div className="h-3 w-full rounded bg-[hsl(var(--muted))]/20 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <div className="h-3 w-3/5 rounded bg-[hsl(var(--muted))]/25 animate-pulse" style={{ animationDelay: "300ms" }} />
                        <div className="h-3 w-4/5 rounded bg-[hsl(var(--muted))]/20 animate-pulse" style={{ animationDelay: "450ms" }} />
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                            <span className="inline-block w-1.5 h-3.5 bg-[hsl(var(--primary))] rounded-sm animate-[blink_1s_infinite]" />
                            AI 军师正在分析情报、生成策略...
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-400">
                        {error}
                    </div>
                )}

                {/* Result */}
                {result && !loading && (
                    <div className="relative group">
                        <pre className="p-4 rounded-lg bg-[hsl(var(--background))]/80 border border-[hsl(var(--border))]/30 text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap break-words leading-relaxed max-h-[400px] overflow-y-auto">
                            {result}
                        </pre>
                        <button
                            onClick={handleCopy}
                            className={cn(
                                "absolute top-2 right-2 px-2 py-1 rounded text-[10px] border transition-all",
                                copied
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                    : "bg-[hsl(var(--background))]/80 border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 hover:text-[hsl(var(--foreground))]"
                            )}
                        >
                            {copied ? "✅ 已复制" : "📋 复制"}
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
