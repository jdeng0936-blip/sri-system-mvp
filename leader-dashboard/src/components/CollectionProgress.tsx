import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { CollectionItem } from "@/data/mockData"

interface CollectionProgressProps {
    readonly items: readonly CollectionItem[]
    readonly className?: string
}

const CollectionRow: React.FC<Readonly<{ item: CollectionItem }>> = ({ item }) => {
    return (
        <div className="space-y-2 py-3">
            {/* Project info row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                        {item.projectName}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">
                        {item.contractAmount}
                    </span>
                    {item.isOverdue ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            🔴 {item.daysInfo}
                        </Badge>
                    ) : item.collectedPercent === 100 ? (
                        <Badge variant="success" className="text-[10px] px-1.5 py-0">
                            ✅ {item.daysInfo}
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {item.daysInfo}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
                <Progress
                    value={item.collectedPercent}
                    className="flex-1 h-2.5"
                    indicatorClassName={
                        item.isOverdue
                            ? "bg-red-500"
                            : item.collectedPercent === 100
                                ? "bg-emerald-500"
                                : "bg-[hsl(var(--primary))]"
                    }
                />
                <span
                    className={`text-xs font-bold tabular-nums w-10 text-right ${item.isOverdue
                            ? "text-red-400"
                            : item.collectedPercent === 100
                                ? "text-emerald-400"
                                : "text-[hsl(var(--foreground))]"
                        }`}
                >
                    {item.collectedPercent}%
                </span>
            </div>
        </div>
    )
}

export const CollectionProgress: React.FC<Readonly<CollectionProgressProps>> = ({
    items,
    className = "",
}) => {
    const overdueCount = items.filter((i) => i.isOverdue).length
    const clearedCount = items.filter((i) => i.collectedPercent === 100).length

    return (
        <Card className={`bg-[hsl(var(--card))]/80 backdrop-blur-sm border-[hsl(var(--border))]/50 ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-[hsl(var(--foreground))]">
                        💰 动态回款进度
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {overdueCount > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                                🚨 {overdueCount} 笔逾期
                            </Badge>
                        )}
                        {clearedCount > 0 && (
                            <Badge variant="success" className="text-[10px]">
                                ✅ {clearedCount} 笔结清
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="divide-y divide-[hsl(var(--border))]/30">
                    {items.map((item) => (
                        <CollectionRow key={item.id} item={item} />
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

export default CollectionProgress
