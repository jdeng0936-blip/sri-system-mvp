import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { KpiCardData } from "@/data/mockData"

interface KpiCardGridProps {
    readonly cards: readonly KpiCardData[]
    readonly className?: string
}

const KpiCard: React.FC<Readonly<{ card: KpiCardData }>> = ({ card }) => {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Card
                        className={`
              border-l-4 ${card.accentColor}
              bg-[hsl(var(--card))]/80 backdrop-blur-sm
              border-[hsl(var(--border))]/50
              hover:border-[hsl(var(--primary))]/50
              transition-all duration-300 cursor-default
              hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5
            `}
                    >
                        <CardContent className="p-5">
                            {/* Emoji + Title row */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl" role="img" aria-label={card.title}>
                                    {card.emoji}
                                </span>
                                <Badge
                                    variant={card.trendUp ? "success" : "destructive"}
                                    className="text-[10px] px-2 py-0.5"
                                >
                                    {card.trendUp ? "↑" : "↓"} {card.trend}
                                </Badge>
                            </div>

                            {/* Value */}
                            <div className="text-3xl font-bold text-[hsl(var(--foreground))] tracking-tight mb-1">
                                {card.value}
                            </div>

                            {/* Title */}
                            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                {card.title}
                            </div>
                        </CardContent>
                    </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p className="text-xs">{card.description}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export const KpiCardGrid: React.FC<Readonly<KpiCardGridProps>> = ({
    cards,
    className = "",
}) => {
    return (
        <div className={`grid grid-cols-4 gap-4 ${className}`}>
            {cards.map((card) => (
                <KpiCard key={card.id} card={card} />
            ))}
        </div>
    )
}

export default KpiCardGrid
