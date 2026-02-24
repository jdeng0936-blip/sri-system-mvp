import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ──

interface KBDocument {
    id: number
    title: string
    category: string
    icon: string
    updatedAt: string
    fileType: string
    size: string
    description: string
}

const CATEGORIES = ["全部", "产品参数", "竞品打单卡", "历史中标库", "资质文件"] as const

const CATEGORY_COLORS: Record<string, string> = {
    "产品参数": "info",
    "竞品打单卡": "destructive",
    "历史中标库": "success",
    "资质文件": "warning",
}

// ── Component ──

export function KnowledgeBase() {
    const [docs, setDocs] = useState<KBDocument[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [activeCategory, setActiveCategory] = useState<string>("全部")

    // Fetch documents from API
    useEffect(() => {
        setIsLoading(true)
        const params = new URLSearchParams()
        if (activeCategory !== "全部") {
            params.set("category", activeCategory)
        }
        if (search.trim()) {
            params.set("search", search.trim())
        }
        const qs = params.toString()
        const url = `http://localhost:8000/api/kb/documents${qs ? `?${qs}` : ""}`

        fetch(url)
            .then((res) => res.json())
            .then((data: KBDocument[]) => {
                setDocs(data)
                setIsLoading(false)
            })
            .catch(() => {
                setDocs([])
                setIsLoading(false)
            })
    }, [activeCategory, search])

    // Fetch all docs for category counting (unfiltered)
    const [allDocs, setAllDocs] = useState<KBDocument[]>([])
    useEffect(() => {
        fetch("http://localhost:8000/api/kb/documents")
            .then((res) => res.json())
            .then((data: KBDocument[]) => setAllDocs(data))
            .catch(() => setAllDocs([]))
    }, [])

    const categoryStats = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const doc of allDocs) {
            counts[doc.category] = (counts[doc.category] || 0) + 1
        }
        return counts
    }, [allDocs])

    // Skeleton
    const Skeleton = ({ className }: { className?: string }) => (
        <div className={cn("bg-[hsl(var(--muted))]/30 rounded animate-pulse", className)} />
    )

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] tracking-wider">
                        📚 核弹知识库
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        KNOWLEDGE BASE — 核心文档弹药库 · {allDocs.length} 份作战文档
                    </p>
                </div>

                {/* Search + Filters */}
                <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                    <CardContent className="pt-5 space-y-4">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">🔍</span>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="搜索文档名称或描述..."
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md pl-9 pr-3 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                                        activeCategory === cat
                                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                                            : "border-[hsl(var(--border))]/30 bg-[hsl(var(--card))]/50 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card))]"
                                    )}
                                >
                                    {cat}
                                    {cat !== "全部" && (
                                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[hsl(var(--background))]/50 text-[10px]">
                                            {categoryStats[cat] || 0}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Document Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading ? (
                        // Loading skeletons
                        Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                                <CardContent className="pt-5 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <Skeleton className="w-10 h-10 rounded-lg" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-full" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-3 w-1/2" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-8 flex-1" />
                                        <Skeleton className="h-8 flex-1" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : docs.length === 0 ? (
                        <div className="col-span-full text-center py-16 text-[hsl(var(--muted-foreground))]">
                            🔍 未找到匹配的文档
                        </div>
                    ) : (
                        docs.map((doc) => (
                            <Card
                                key={doc.id}
                                className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50 hover:border-[hsl(var(--primary))]/30 transition-all group"
                            >
                                <CardContent className="pt-5 space-y-3">
                                    {/* Icon + Title */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[hsl(var(--background))]/80 border border-[hsl(var(--border))]/30 text-xl group-hover:scale-110 transition-transform">
                                            {doc.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-[hsl(var(--foreground))] leading-snug line-clamp-2 group-hover:text-[hsl(var(--primary))] transition-colors">
                                                {doc.title}
                                            </h3>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
                                                {doc.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge
                                            variant={CATEGORY_COLORS[doc.category] as "info" | "destructive" | "success" | "warning" | "default"}
                                            className="text-[10px]"
                                        >
                                            {doc.category}
                                        </Badge>
                                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                            {doc.fileType} · {doc.size}
                                        </span>
                                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">
                                            🕐 {doc.updatedAt}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 h-8 text-xs border-[hsl(var(--border))]/50"
                                            onClick={() => alert(`📄 预览: ${doc.title}`)}
                                        >
                                            👁️ 预览
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 h-8 text-xs border-[hsl(var(--border))]/50"
                                            onClick={() => alert(`⬇️ 下载: ${doc.title}`)}
                                        >
                                            ⬇️ 下载
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
