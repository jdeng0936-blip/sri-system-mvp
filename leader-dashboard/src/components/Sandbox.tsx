import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { AIAssistant } from "@/components/AIAssistant"
import { AIHeadquarters } from "@/components/AIHeadquarters"
import { PowerMap } from "@/components/PowerMap"
import { FireSupport } from "@/components/FireSupport"
import { AdvisorChat } from "@/components/AdvisorChat"

// ── Types ──

interface ProjectOption {
    id: number
    name: string
    stage: string
}

interface ControlPoint {
    text: string
    risk: "high" | "medium" | "low"
}

interface RejectionRisk {
    text: string
    severity: "critical" | "warning"
}

interface Competitor {
    name: string
    quote: string | null
    strengths: string
    weaknesses: string
    recentActions: string
}

interface Stakeholder {
    name: string
    title: string
    tags: string
}

interface SandboxData {
    project: {
        id: number
        name: string
        stage: string
        client: string
        applicant: string
        dept: string
        stakeholderCount: number
        designInstitute: string
        generalContractor: string
    }
    bidAnalysis: {
        controlPoints: ControlPoint[]
        rejectionRisks: RejectionRisk[]
        maxPrice: number | null
        competitors: Competitor[]
    }
    intelSummary: {
        currentStatus: string
        nextSteps: string
        logCount: number
        latestLogTime: string | null
    }
    stakeholders: Stakeholder[]
}

// ── Component ──

export function Sandbox() {
    // Project list
    const [projects, setProjects] = useState<ProjectOption[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string>("")

    // Sandbox data from API
    const [sandboxData, setSandboxData] = useState<SandboxData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Simulator state
    const [contractAmount, setContractAmount] = useState(2800)
    const [equipmentDiscount, setEquipmentDiscount] = useState(12)
    const [constructionReserve, setConstructionReserve] = useState(15)
    const [giftCost, setGiftCost] = useState(5)

    // Effect 1: Load project list on mount
    useEffect(() => {
        fetch("http://localhost:8000/api/crm/projects")
            .then((res) => res.json())
            .then((data: ProjectOption[]) => {
                setProjects(data)
                if (data.length > 0) {
                    setSelectedProjectId(String(data[0].id))
                }
            })
            .catch(() => {
                // Fallback
                setProjects([{ id: 1, name: "万华化学二期改造", stage: "立项" }])
                setSelectedProjectId("1")
            })
    }, [])

    // Effect 2: Fetch sandbox data when project changes
    useEffect(() => {
        if (!selectedProjectId) return
        setIsLoading(true)
        fetch(`http://localhost:8000/api/sandbox/projects/${selectedProjectId}`)
            .then((res) => res.json())
            .then((data: SandboxData) => {
                setSandboxData(data)
                // Sync maxPrice to contract amount if available
                if (data.bidAnalysis?.maxPrice) {
                    setContractAmount(Math.round(data.bidAnalysis.maxPrice * 0.85))
                }
                setIsLoading(false)
            })
            .catch(() => {
                setSandboxData(null)
                setIsLoading(false)
            })
    }, [selectedProjectId])

    // Derived calculations
    const analysis = useMemo(() => {
        const equipmentBase = contractAmount * 0.65
        const discountedEquipment = equipmentBase * (1 - equipmentDiscount / 100)
        const installationCost = contractAmount * 0.20
        const totalCost = discountedEquipment + installationCost + constructionReserve + giftCost
        const grossProfit = contractAmount - totalCost
        const grossMargin = contractAmount > 0 ? (grossProfit / contractAmount) * 100 : 0
        return { totalCost, grossProfit, grossMargin }
    }, [contractAmount, equipmentDiscount, constructionReserve, giftCost])

    const marginColor =
        analysis.grossMargin < 15 ? "text-red-500" :
            analysis.grossMargin < 30 ? "text-amber-400" :
                "text-emerald-400"

    const marginBg =
        analysis.grossMargin < 15 ? "bg-red-500/10 border-red-500/30" :
            analysis.grossMargin < 30 ? "bg-amber-500/10 border-amber-500/30" :
                "bg-emerald-500/10 border-emerald-500/30"

    const marginBadge =
        analysis.grossMargin < 15 ? "destructive" :
            analysis.grossMargin < 30 ? "warning" :
                "success"

    // Data from API (with safe defaults)
    const controlPoints = sandboxData?.bidAnalysis?.controlPoints ?? []
    const rejectionRisks = sandboxData?.bidAnalysis?.rejectionRisks ?? []
    const competitors = sandboxData?.bidAnalysis?.competitors ?? []
    const maxPrice = sandboxData?.bidAnalysis?.maxPrice ?? null
    const projectName = sandboxData?.project?.name ?? "—"
    const projectStage = sandboxData?.project?.stage ?? ""
    const stakeholderCount = sandboxData?.project?.stakeholderCount ?? 0
    const stakeholders = sandboxData?.stakeholders ?? []
    const logCount = sandboxData?.intelSummary?.logCount ?? 0

    // Skeleton component
    const Skeleton = ({ className }: { className?: string }) => (
        <div className={cn("bg-[hsl(var(--muted))]/30 rounded animate-pulse", className)} />
    )

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header + Project Selector */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] tracking-wider">
                            🎯 招投标与沙盘推演
                        </h1>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            BIDDING & SANDBOX — 真实情报驱动的利润推演
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">作战项目</span>
                        <Select
                            value={selectedProjectId}
                            onValueChange={setSelectedProjectId}
                        >
                            <SelectTrigger className="w-[260px]">
                                <SelectValue placeholder="选择项目..." />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {sandboxData && (
                            <Badge variant="outline" className="text-[9px] shrink-0">
                                {logCount} 条情报
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Dual-Pane Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* ── LEFT: Bid Analysis (40%) ── */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Project Info */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                    📋 招标概况
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                                {isLoading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                        <Skeleton className="h-4 w-2/3" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-[hsl(var(--muted-foreground))]">项目名称</span>
                                            <span className="text-[hsl(var(--foreground))] font-medium text-right max-w-[60%]">
                                                {projectName}
                                            </span>
                                        </div>
                                        <Separator className="bg-[hsl(var(--border))]/20" />
                                        <div className="flex justify-between">
                                            <span className="text-[hsl(var(--muted-foreground))]">项目阶段</span>
                                            <Badge variant="info" className="text-[10px]">{projectStage || "未知"}</Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[hsl(var(--muted-foreground))]">关键人覆盖</span>
                                            <span className={cn(
                                                "font-medium",
                                                stakeholderCount >= 3 ? "text-emerald-400" : "text-amber-400"
                                            )}>
                                                {stakeholderCount} 人
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[hsl(var(--muted-foreground))]">情报积累</span>
                                            <span className="text-[hsl(var(--foreground))]">{logCount} 条拜访记录</span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Control Points */}
                        <Card className="bg-[hsl(var(--card))] border-l-4 border-l-amber-500 border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-amber-400 flex items-center justify-between">
                                    ⚠️ 硬性控标点
                                    {!isLoading && (
                                        <Badge variant="outline" className="text-[9px] font-normal">
                                            {controlPoints.length} 条
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {isLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-5/6" />
                                        <Skeleton className="h-4 w-3/4" />
                                    </div>
                                ) : controlPoints.length === 0 ? (
                                    <p className="text-xs text-emerald-400">✅ 暂未检测到控标风险</p>
                                ) : (
                                    controlPoints.map((point, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            <span className={cn(
                                                "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                                                point.risk === "high" ? "bg-red-500" :
                                                    point.risk === "medium" ? "bg-amber-500" : "bg-emerald-500"
                                            )} />
                                            <span className="text-[hsl(var(--foreground))]/80">{point.text}</span>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Rejection Risks */}
                        <Card className="bg-[hsl(var(--card))] border-l-4 border-l-red-500 border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-red-400 flex items-center justify-between">
                                    🚫 废标风险
                                    {!isLoading && (
                                        <Badge variant={rejectionRisks.length > 0 ? "destructive" : "success"} className="text-[9px] font-normal">
                                            {rejectionRisks.length > 0 ? `${rejectionRisks.length} 条` : "无"}
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {isLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-4/5" />
                                    </div>
                                ) : rejectionRisks.length === 0 ? (
                                    <p className="text-xs text-emerald-400">✅ 暂无废标风险</p>
                                ) : (
                                    rejectionRisks.map((risk, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            <Badge
                                                variant={risk.severity === "critical" ? "destructive" : "warning"}
                                                className="text-[9px] px-1.5 shrink-0 mt-0.5"
                                            >
                                                {risk.severity === "critical" ? "致命" : "注意"}
                                            </Badge>
                                            <span className="text-[hsl(var(--foreground))]/80">{risk.text}</span>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Competitor Intel (new section from API) */}
                        {!isLoading && competitors.length > 0 && (
                            <Card className="bg-[hsl(var(--card))] border-l-4 border-l-violet-500 border-[hsl(var(--border))]/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-violet-400">
                                        ⚔️ 竞品情报 ({competitors.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {competitors.map((comp, i) => (
                                        <div key={i} className="p-2 rounded bg-[hsl(var(--background))]/30 border border-[hsl(var(--border))]/20 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-[hsl(var(--foreground))]">{comp.name}</span>
                                                {comp.quote && (
                                                    <Badge variant="warning" className="text-[9px]">
                                                        报价: {comp.quote}
                                                    </Badge>
                                                )}
                                            </div>
                                            {comp.strengths && (
                                                <p className="text-[10px] text-emerald-400/80">💪 {comp.strengths}</p>
                                            )}
                                            {comp.weaknesses && (
                                                <p className="text-[10px] text-red-400/80">⚡ {comp.weaknesses}</p>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Max Price / Budget */}
                        <Card className="bg-[hsl(var(--card))] border-l-4 border-l-[hsl(var(--primary))] border-[hsl(var(--border))]/50">
                            <CardContent className="pt-5">
                                {isLoading ? (
                                    <Skeleton className="h-8 w-1/2 mx-auto" />
                                ) : maxPrice !== null ? (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">💰 最高限价</span>
                                        <span className="text-2xl font-bold text-[hsl(var(--primary))]">
                                            ¥ {maxPrice.toLocaleString()} 万
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-amber-400 text-sm">⚠️</span>
                                            <span className="text-xs text-amber-400">情报中未检测到限价 / 预算数据</span>
                                        </div>
                                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                            请在右侧模拟器中手动输入"合同总额"以启动利润推演
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* ── 四象限情报视图 (原版 app.py L1327-1400) ── */}

                        {/* 👥 关键人物图谱 */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                    👥 关键人物图谱
                                    {!isLoading && (
                                        <Badge variant="outline" className="text-[9px]">
                                            {stakeholders.length} 人
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <Skeleton className="h-12 w-full" />
                                ) : stakeholders.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {stakeholders.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <span className="text-[hsl(var(--foreground))] font-medium min-w-[3rem]">{s.name}</span>
                                                <span className="text-[hsl(var(--muted-foreground))]">{s.title}</span>
                                                {s.tags && <Badge variant="secondary" className="text-[9px]">{s.tags}</Badge>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">暂未归档关键人物</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* ⚔️ 竞争对手动态 */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                    ⚔️ 竞争对手动态
                                    {!isLoading && (
                                        <Badge variant={competitors.length > 0 ? "destructive" : "success"} className="text-[9px]">
                                            {competitors.length > 0 ? `${competitors.length} 家` : "暂无"}
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <Skeleton className="h-12 w-full" />
                                ) : competitors.length > 0 ? (
                                    <div className="space-y-2">
                                        {competitors.map((c, i) => (
                                            <div key={i} className="bg-[hsl(var(--background))]/50 rounded-md p-2 space-y-1">
                                                <p className="text-xs font-medium text-red-400">🚨 {c.name}</p>
                                                {c.recentActions && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">• {c.recentActions}</p>}
                                                {c.strengths && <p className="text-[10px] text-amber-400/70">优势: {c.strengths}</p>}
                                                {c.weaknesses && <p className="text-[10px] text-emerald-400/70">弱点: {c.weaknesses}</p>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-emerald-400">✅ 暂无明确竞争对手活动，形势大好！</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* 🚨 缺口情报雷达 */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                    🚨 缺口情报雷达
                                    {!isLoading && (
                                        <Badge variant={rejectionRisks.length > 0 ? "destructive" : "success"} className="text-[9px]">
                                            {rejectionRisks.length > 0 ? `${rejectionRisks.length} 项` : "完备"}
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-full" />
                                ) : rejectionRisks.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {rejectionRisks.map((r, i) => (
                                            <div key={i} className={cn(
                                                "text-xs px-2 py-1 rounded",
                                                r.severity === "critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                                            )}>
                                                ⚠️ {r.text}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-emerald-400">✅ 情报完备，暂无关键缺口！</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* 📅 下一步行动 */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-[hsl(var(--foreground))]">
                                    📅 下一步行动
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-full" />
                                ) : sandboxData?.intelSummary?.nextSteps ? (
                                    <div className="bg-blue-500/10 text-blue-400 text-xs px-2 py-1.5 rounded">
                                        📌 {sandboxData.intelSummary.nextSteps}
                                    </div>
                                ) : (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">暂无明确的下一步推进计划</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── RIGHT: Profit Simulator (60%) ── */}
                    <div className="lg:col-span-3 space-y-4">

                        {/* 🌐 项目生态图谱 */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                    🌐 项目生态图谱
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center space-y-1">
                                        <p className="text-[10px] text-blue-400 font-medium">🏢 终端业主 (甲方)</p>
                                        <p className="text-xs font-bold text-[hsl(var(--foreground))] truncate">
                                            {sandboxData?.project?.client || "未知业主"}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center space-y-1">
                                        <p className="text-[10px] text-amber-400 font-medium">📐 设计院 (图纸/上图)</p>
                                        <p className="text-xs font-bold text-[hsl(var(--foreground))] truncate">
                                            {sandboxData?.project?.designInstitute || "🚫 未关联"}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center space-y-1">
                                        <p className="text-[10px] text-emerald-400 font-medium">👷 总包方 (施工/采购)</p>
                                        <p className="text-xs font-bold text-[hsl(var(--foreground))] truncate">
                                            {sandboxData?.project?.generalContractor || "🚫 未关联"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Simulator Card */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                    🎛️ 利润推演模拟器
                                    <Badge variant="outline" className="text-[9px] ml-auto">
                                        REAL-TIME
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Contract Amount */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                            合同总额
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-bold text-[hsl(var(--foreground))]">¥</span>
                                            <input
                                                type="number"
                                                value={contractAmount}
                                                onChange={(e) => setContractAmount(Number(e.target.value) || 0)}
                                                className={cn(
                                                    "w-24 bg-[hsl(var(--background))] border rounded px-2 py-1 text-right text-sm font-bold text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]",
                                                    maxPrice === null
                                                        ? "border-amber-500/50 ring-1 ring-amber-500/30"
                                                        : "border-[hsl(var(--border))]/50"
                                                )}
                                            />
                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">万</span>
                                        </div>
                                    </div>
                                    {maxPrice === null && (
                                        <p className="text-[10px] text-amber-400 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                            ⚠️ 请手动输入预估标底金额
                                        </p>
                                    )}
                                </div>

                                <Separator className="bg-[hsl(var(--border))]/20" />

                                {/* Equipment Discount Slider */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-[hsl(var(--muted-foreground))]">
                                            📉 设备报价下浮比例
                                        </label>
                                        <span className="text-sm font-bold text-[hsl(var(--primary))]">{equipmentDiscount}%</span>
                                    </div>
                                    <Slider
                                        value={[equipmentDiscount]}
                                        onValueChange={([v]) => setEquipmentDiscount(v)}
                                        max={30}
                                        step={1}
                                    />
                                    <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                                        <span>0%（原价）</span>
                                        <span>30%（极限下浮）</span>
                                    </div>
                                </div>

                                {/* Construction Reserve Slider */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-[hsl(var(--muted-foreground))]">
                                            🏗️ 施工预留金
                                        </label>
                                        <span className="text-sm font-bold text-amber-400">¥ {constructionReserve} 万</span>
                                    </div>
                                    <Slider
                                        value={[constructionReserve]}
                                        onValueChange={([v]) => setConstructionReserve(v)}
                                        max={50}
                                        step={1}
                                    />
                                    <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                                        <span>¥0 万</span>
                                        <span>¥50 万</span>
                                    </div>
                                </div>

                                {/* Gift Cost Slider */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-[hsl(var(--muted-foreground))]">
                                            🎁 赠品 / 公关成本
                                        </label>
                                        <span className="text-sm font-bold text-rose-400">¥ {giftCost} 万</span>
                                    </div>
                                    <Slider
                                        value={[giftCost]}
                                        onValueChange={([v]) => setGiftCost(v)}
                                        max={20}
                                        step={0.5}
                                    />
                                    <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                                        <span>¥0 万</span>
                                        <span>¥20 万</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Result Card */}
                        <Card className={cn("border transition-all", marginBg)}>
                            <CardContent className="pt-6 pb-6">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="space-y-1">
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">预估总成本</p>
                                        <p className="text-lg font-bold text-[hsl(var(--foreground))]">
                                            ¥ {analysis.totalCost.toFixed(0)} 万
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">预估毛利</p>
                                        <p className={cn("text-lg font-bold", marginColor)}>
                                            ¥ {analysis.grossProfit.toFixed(0)} 万
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">推演毛利率</p>
                                        <p className={cn("text-3xl font-black tracking-tight", marginColor)}>
                                            {analysis.grossMargin.toFixed(1)}%
                                        </p>
                                        <Badge variant={marginBadge as "destructive" | "warning" | "success"} className="text-[10px]">
                                            {analysis.grossMargin < 15 ? "🚨 利润危险" :
                                                analysis.grossMargin < 30 ? "⚠️ 利润偏低" :
                                                    "✅ 利润健康"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Waterfall Breakdown */}
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-[hsl(var(--muted-foreground))]">📊 成本瀑布</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {[
                                    { label: "合同总额", value: contractAmount, color: "bg-[hsl(var(--primary))]" },
                                    { label: "设备成本 (下浮后)", value: contractAmount * 0.65 * (1 - equipmentDiscount / 100), color: "bg-cyan-500" },
                                    { label: "安装成本", value: contractAmount * 0.20, color: "bg-slate-500" },
                                    { label: "施工预留金", value: constructionReserve, color: "bg-amber-500" },
                                    { label: "赠品/公关", value: giftCost, color: "bg-rose-500" },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs text-[hsl(var(--muted-foreground))] w-28 shrink-0">{item.label}</span>
                                        <div className="flex-1 h-3 bg-[hsl(var(--background))]/50 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all", item.color)}
                                                style={{ width: `${Math.min(100, contractAmount > 0 ? (item.value / contractAmount) * 100 : 0)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono text-[hsl(var(--foreground))] w-16 text-right">
                                            ¥{item.value.toFixed(0)}
                                        </span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* 🧠 AI 统帅部 */}
                        <AIHeadquarters
                            projectId={selectedProjectId ? Number(selectedProjectId) : null}
                            projectName={sandboxData?.project?.name ?? ""}
                        />

                        {/* 👥 权力地图 */}
                        <PowerMap
                            projectId={selectedProjectId ? Number(selectedProjectId) : null}
                            projectName={sandboxData?.project?.name ?? ""}
                            initialStakeholders={sandboxData?.stakeholders ?? []}
                        />

                        {/* 🛠️ 火力支援 */}
                        <FireSupport
                            projectId={selectedProjectId ? Number(selectedProjectId) : 0}
                            projectName={sandboxData?.project?.name ?? ""}
                            stakeholders={sandboxData?.stakeholders ?? []}
                        />

                        {/* 💬 AI 参谋部 */}
                        <AdvisorChat
                            projectId={selectedProjectId ? Number(selectedProjectId) : null}
                            projectName={sandboxData?.project?.name ?? ""}
                        />

                        {/* ✨ AI 军师 */}
                        <AIAssistant
                            projectId={selectedProjectId ? Number(selectedProjectId) : null}
                            projectName={sandboxData?.project?.name ?? ""}
                            stakeholders={sandboxData?.stakeholders ?? []}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
