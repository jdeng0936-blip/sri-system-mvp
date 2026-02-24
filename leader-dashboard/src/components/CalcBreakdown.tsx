import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { CommissionLineItem } from "@/data/mockData"

interface CalcBreakdownProps {
    readonly items: readonly CommissionLineItem[]
    readonly className?: string
}

function getLineColor(type: CommissionLineItem["type"]): string {
    switch (type) {
        case "bonus":
            return "text-[hsl(var(--success))]"
        case "penalty":
            return "text-[hsl(var(--destructive))]"
        default:
            return "text-[hsl(var(--foreground))]"
    }
}

function getLineBg(type: CommissionLineItem["type"]): string {
    switch (type) {
        case "bonus":
            return "bg-[hsl(var(--success))]/5 border-l-2 border-l-[hsl(var(--success))]/40"
        case "penalty":
            return "bg-[hsl(var(--destructive))]/5 border-l-2 border-l-[hsl(var(--destructive))]/40"
        default:
            return "bg-[hsl(var(--card))]/50 border-l-2 border-l-[hsl(var(--muted-foreground))]/30"
    }
}

const BreakdownRow: React.FC<Readonly<{ item: CommissionLineItem; isLast: boolean }>> = ({
    item,
    isLast,
}) => {
    return (
        <>
            <div
                className={`flex items-center justify-between py-4 px-4 rounded-md ${getLineBg(item.type)} transition-all duration-200 hover:scale-[1.01]`}
            >
                {/* Left: emoji + label + description */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl flex-shrink-0" role="img" aria-label={item.label}>
                        {item.emoji}
                    </span>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                            {item.label}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                            {item.description}
                        </div>
                    </div>
                </div>

                {/* Right: amount */}
                <div
                    className={`text-lg font-bold tracking-tight flex-shrink-0 ml-4 ${getLineColor(item.type)}`}
                >
                    {item.displayAmount}
                </div>
            </div>
            {!isLast && <Separator className="opacity-30" />}
        </>
    )
}

export const CalcBreakdown: React.FC<Readonly<CalcBreakdownProps>> = ({
    items,
    className = "",
}) => {
    return (
        <Card className={`bg-[hsl(var(--card))]/60 backdrop-blur-sm border-[hsl(var(--border))]/50 ${className}`}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                    <span>🧮</span>
                    <span>核算瀑布流 · Calculation Breakdown</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {items.map((item, index) => (
                    <BreakdownRow
                        key={item.id}
                        item={item}
                        isLast={index === items.length - 1}
                    />
                ))}
            </CardContent>
        </Card>
    )
}

export default CalcBreakdown
