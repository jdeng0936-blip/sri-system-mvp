import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ── Types ──

interface CrmProject {
    id: number
    name: string
    stage: string
    rawStage: string
    client: string
    applicant: string
    dept: string
    stakeholderCount: number
    latestLog: string
    latestLogTime: string
    stageColor: string
}

const STAGE_OPTIONS = ["全部", "线索获取", "方案报价", "商务谈判", "合同签约"] as const

const STAGE_EMOJI: Record<string, string> = {
    "线索获取": "📡",
    "方案报价": "📋",
    "商务谈判": "🤝",
    "合同签约": "✅",
}

// ── Component ──

export function FrontlineCRM() {
    const [projects, setProjects] = useState<CrmProject[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [stageFilter, setStageFilter] = useState<string>("全部")

    // Fetch projects
    useEffect(() => {
        fetch("http://localhost:8000/api/crm/projects")
            .then((res) => res.json())
            .then((data: CrmProject[]) => {
                setProjects(data)
                setIsLoading(false)
            })
            .catch(() => {
                setIsLoading(false)
            })
    }, [])

    // Filter logic (client-side)
    const filteredProjects = useMemo(() => {
        return projects.filter((p) => {
            const matchesSearch =
                search === "" ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.client.toLowerCase().includes(search.toLowerCase())
            const matchesStage =
                stageFilter === "全部" || p.stage === stageFilter
            return matchesSearch && matchesStage
        })
    }, [projects, search, stageFilter])

    // Stats
    const stageStats = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const p of projects) {
            counts[p.stage] = (counts[p.stage] || 0) + 1
        }
        return counts
    }, [projects])

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* ── Header ── */}
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] tracking-wider">
                        ⚔️ 前线阵地
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        FRONTLINE CRM — 全域项目作战态势 · {projects.length} 个活跃项目
                    </p>
                </div>

                {/* ── Stage Summary Badges ── */}
                <div className="flex flex-wrap gap-3">
                    {STAGE_OPTIONS.filter((s) => s !== "全部").map((stage) => (
                        <button
                            key={stage}
                            onClick={() => setStageFilter(stageFilter === stage ? "全部" : stage)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all",
                                stageFilter === stage
                                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                                    : "border-[hsl(var(--border))]/30 bg-[hsl(var(--card))]/50 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card))]"
                            )}
                        >
                            <span>{STAGE_EMOJI[stage]}</span>
                            <span>{stage}</span>
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-[hsl(var(--background))]/50 text-[10px]">
                                {stageStats[stage] || 0}
                            </span>
                        </button>
                    ))}
                </div>

                {/* ── Search + Filter Bar ── */}
                <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                    <CardContent className="pt-5">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
                                    🔍
                                </span>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="搜索项目名称或客户..."
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md pl-9 pr-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                />
                            </div>
                            <select
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value)}
                                className="bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] min-w-[140px]"
                            >
                                {STAGE_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        {search && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                找到 {filteredProjects.length} / {projects.length} 个项目
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* ── Data Table ── */}
                <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-[hsl(var(--border))]/30 hover:bg-transparent">
                                <TableHead className="w-[200px]">项目名称</TableHead>
                                <TableHead className="w-[80px]">战区</TableHead>
                                <TableHead className="w-[80px]">销售</TableHead>
                                <TableHead className="w-[100px]">阶段</TableHead>
                                <TableHead className="w-[70px] text-center">关键人</TableHead>
                                <TableHead>最新战报</TableHead>
                                <TableHead className="w-[90px] text-right">时间</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                // Loading skeleton
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}>
                                                <div className="h-4 bg-[hsl(var(--muted))]/30 rounded animate-pulse" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filteredProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                                        🔍 未找到匹配的项目
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProjects.map((project) => (
                                    <TableRow key={project.id} className="group">
                                        <TableCell>
                                            <div className="space-y-0.5">
                                                <p className="font-medium text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">
                                                    {project.name}
                                                </p>
                                                {project.client !== "—" && (
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        🏢 {project.client}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {project.dept || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-[hsl(var(--foreground))]">
                                                {project.applicant}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={project.stageColor as "info" | "warning" | "secondary" | "success" | "destructive" | "default" | "outline"}
                                                className="text-[10px] whitespace-nowrap"
                                            >
                                                {STAGE_EMOJI[project.stage] || ""} {project.stage}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn(
                                                "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                                                project.stakeholderCount > 0
                                                    ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]"
                                                    : "bg-[hsl(var(--muted))]/30 text-[hsl(var(--muted-foreground))]"
                                            )}>
                                                {project.stakeholderCount}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 max-w-[300px]">
                                                {project.latestLog}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                {project.latestLogTime}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    )
}
