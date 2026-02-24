import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CommissionHeroMetric } from "@/data/mockData"

interface HeroMetricsProps {
    readonly metrics: readonly CommissionHeroMetric[]
    readonly className?: string
}

/**
 * Returns the dynamic color class for gross margin:
 * - < 15%: destructive red (告警)
 * - 15–30%: foreground white (正常)
 * - > 30%: success green (优秀)
 */
function getMarginColor(rawValue: number): string {
    if (rawValue < 15) return "text-[hsl(var(--destructive))]"
    if (rawValue > 30) return "text-[hsl(var(--success))]"
    return "text-[hsl(var(--foreground))]"
}

const MetricCard: React.FC<Readonly<{ metric: CommissionHeroMetric }>> = ({ metric }) => {
    const colorClass =
        metric.id === "gross-margin"
            ? getMarginColor(metric.rawValue)
            : metric.accentClass

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Card className="bg-[hsl(var(--card))]/80 backdrop-blur-sm border-[hsl(var(--border))]/50 hover:border-[hsl(var(--primary))]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5">
                        <CardContent className="p-6 text-center">
                            {/* Emoji */}
                            <span className="text-3xl block mb-2" role="img" aria-label={metric.label}>
                                {metric.emoji}
                            </span>

                            {/* Label */}
                            <div className="text-sm text-[hsl(var(--muted-foreground))] mb-3 tracking-wide">
                                {metric.label}
                            </div>

                            {/* Value — hero size */}
                            <div
                                className={`text-4xl font-bold tracking-tight ${colorClass}`}
                            >
                                {metric.value}
                            </div>

                            {/* Conditional warning for low margin */}
                            {metric.id === "gross-margin" && metric.rawValue < 15 && (
                                <div className="mt-2 text-xs text-[hsl(var(--destructive))] animate-pulse font-semibold">
                                    🚨 低于 15% 红线！需 VP 审批
                                </div>
                            )}
                            {metric.id === "gross-margin" && metric.rawValue > 30 && (
                                <div className="mt-2 text-xs text-[hsl(var(--success))] font-semibold">
                                    🟢 优秀毛利，利润溢价奖励激活
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p className="text-xs">
                        {metric.id === "gross-margin"
                            ? "低于15%红色告警 · 超30%绿色优秀"
                            : `${metric.label}: ${metric.value}`}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export const HeroMetrics: React.FC<Readonly<HeroMetricsProps>> = ({
    metrics,
    className = "",
}) => {
    return (
        <div className={`grid grid-cols-3 gap-4 ${className}`}>
            {metrics.map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
            ))}
        </div>
    )
}

export default HeroMetrics
