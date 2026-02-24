import React from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { CommissionSalesperson, CommissionContract } from "@/data/mockData"

interface CommissionHeaderProps {
    readonly salesperson: CommissionSalesperson
    readonly contract: CommissionContract
    readonly className?: string
}

export const CommissionHeader: React.FC<Readonly<CommissionHeaderProps>> = ({
    salesperson,
    contract,
    className = "",
}) => {
    return (
        <div className={className}>
            <div className="flex items-center justify-between flex-wrap gap-4 px-6 py-5">
                {/* Left: Salesperson Identity */}
                <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 ring-2 ring-[hsl(var(--primary))] ring-offset-2 ring-offset-[hsl(var(--background))]">
                        <AvatarFallback className="bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] text-xl font-bold">
                            {salesperson.initial}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-[hsl(var(--foreground))]">
                                {salesperson.name}
                            </span>
                            <Badge variant="info" className="text-xs">
                                {salesperson.regionEmoji} {salesperson.region}
                            </Badge>
                        </div>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                            一线销售 · 单兵作战视角
                        </p>
                    </div>
                </div>

                {/* Right: Contract Info */}
                <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-lg font-semibold text-[hsl(var(--foreground))]">
                            🏗️ {contract.name}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 justify-end">
                        <Badge variant="secondary" className="text-xs font-mono">
                            {contract.code}
                        </Badge>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {contract.client}
                        </span>
                    </div>
                </div>
            </div>
            <Separator />
        </div>
    )
}

export default CommissionHeader
