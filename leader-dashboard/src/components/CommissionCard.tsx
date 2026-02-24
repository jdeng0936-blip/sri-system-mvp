import React from "react"
import { CommissionHeader } from "@/components/CommissionHeader"
import { HeroMetrics } from "@/components/HeroMetrics"
import { CalcBreakdown } from "@/components/CalcBreakdown"
import { BottomLine } from "@/components/BottomLine"
import {
    commissionSalesperson,
    commissionContract,
    commissionHeroMetrics,
    commissionLineItems,
    commissionFinalAmount,
    commissionFinalRaw,
} from "@/data/mockData"

interface CommissionCardProps {
    readonly className?: string
}

export const CommissionCard: React.FC<Readonly<CommissionCardProps>> = ({
    className = "",
}) => {
    return (
        <div className={`min-h-screen bg-[hsl(var(--background))] ${className}`}>
            {/* 渐变暗纹背景 */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.06),transparent_50%)] pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--warning)/0.04),transparent_50%)] pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 max-w-5xl mx-auto py-6 px-4">
                {/* Header: Salesperson + Contract */}
                <CommissionHeader
                    salesperson={commissionSalesperson}
                    contract={commissionContract}
                    className="mb-6"
                />

                {/* Hero Metrics: 3 columns */}
                <HeroMetrics
                    metrics={commissionHeroMetrics}
                    className="mb-6"
                />

                {/* Calculation Breakdown */}
                <CalcBreakdown
                    items={commissionLineItems}
                    className="mb-6"
                />

                {/* Bottom Line: Final Amount + Submit */}
                <BottomLine
                    finalAmount={commissionFinalAmount}
                    finalRaw={commissionFinalRaw}
                />
            </div>
        </div>
    )
}

export default CommissionCard
