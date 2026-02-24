import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FunnelStage } from "@/data/mockData"

interface BattlefieldFunnelProps {
    readonly stages: readonly FunnelStage[]
    readonly className?: string
}

const funnelGradients = [
    "from-blue-500/90 to-blue-400/70",
    "from-blue-500/70 to-cyan-400/60",
    "from-cyan-500/60 to-teal-400/50",
    "from-emerald-500/50 to-green-400/40",
]

export const BattlefieldFunnel: React.FC<Readonly<BattlefieldFunnelProps>> = ({
    stages,
    className = "",
}) => {
    return (
        <Card className={`bg-[hsl(var(--card))]/80 backdrop-blur-sm border-[hsl(var(--border))]/50 ${className}`}>
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[hsl(var(--foreground))]">
                    ⚔️ 战区业绩漏斗
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {stages.map((stage, index) => (
                    <div key={stage.label} className="space-y-1.5">
                        {/* Label row */}
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span>{stage.emoji}</span>
                                <span className="text-[hsl(var(--foreground))] font-medium">
                                    {stage.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
                                <span className="text-xs">{stage.amount}</span>
                                <span className="font-bold text-[hsl(var(--foreground))] w-10 text-right tabular-nums">
                                    {stage.count}
                                </span>
                            </div>
                        </div>

                        {/* Bar */}
                        <div className="relative h-7 w-full rounded-md bg-[hsl(var(--secondary))]/50 overflow-hidden">
                            <div
                                className={`h-full rounded-md bg-gradient-to-r ${funnelGradients[index]} transition-all duration-700 ease-out flex items-center`}
                                style={{ width: `${stage.widthPercent}%` }}
                            >
                                {stage.widthPercent > 25 && (
                                    <span className="text-[11px] font-semibold text-white/90 pl-3">
                                        {stage.widthPercent}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Conversion summary */}
                <div className="pt-2 border-t border-[hsl(var(--border))]/30">
                    <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                        <span>整体转化率</span>
                        <span className="font-bold text-emerald-400 text-sm">
                            {stages.length > 0
                                ? `${Math.round(
                                    (stages[stages.length - 1].count / stages[0].count) * 100
                                )}%`
                                : "N/A"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default BattlefieldFunnel
