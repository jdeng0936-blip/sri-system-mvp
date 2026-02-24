import React from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    dashboardTitle,
    dashboardSubtitle,
    currentRole,
    currentRoleEmoji,
    currentRoleLabel,
} from "@/data/mockData"

interface DashboardHeaderProps {
    readonly className?: string
}

export const DashboardHeader: React.FC<Readonly<DashboardHeaderProps>> = ({
    className = "",
}) => {
    const [currentTime, setCurrentTime] = React.useState(new Date())

    React.useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const formattedTime = currentTime.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    })

    const formattedDate = currentTime.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
    })

    return (
        <div className={className}>
            <div className="flex items-center justify-between px-6 py-4">
                {/* Left: Title */}
                <div>
                    <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">
                        {dashboardTitle}
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 tracking-widest uppercase">
                        {dashboardSubtitle}
                    </p>
                </div>

                {/* Right: Role + Clock */}
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{formattedDate}</div>
                        <div className="text-xl font-mono font-bold text-[hsl(var(--primary))] tabular-nums tracking-wider">
                            {formattedTime}
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Badge variant="warning" className="text-xs">
                            {currentRoleEmoji} {currentRole}
                        </Badge>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{currentRoleLabel}</span>
                    </div>
                </div>
            </div>
            <Separator />
        </div>
    )
}

export default DashboardHeader
