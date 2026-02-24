import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { IntelFeedItem } from "@/data/mockData"

interface IntelFeedProps {
    readonly items: readonly IntelFeedItem[]
    readonly className?: string
}

const typeColorMap: Record<string, string> = {
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    destructive: "border-l-red-500",
    info: "border-l-blue-500",
}

const avatarBgMap: Record<string, string> = {
    "一线销售": "bg-blue-900/60 text-blue-300",
    "区域总监": "bg-purple-900/60 text-purple-300",
    "销售VP": "bg-amber-900/60 text-amber-300",
}

const FeedItem: React.FC<Readonly<{ item: IntelFeedItem }>> = ({ item }) => {
    return (
        <div
            className={`
        border-l-2 ${typeColorMap[item.type] || "border-l-[hsl(var(--border))]"}
        pl-3 py-3 hover:bg-[hsl(var(--accent))]/30 transition-colors rounded-r-md
      `}
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback
                        className={`text-xs font-bold ${avatarBgMap[item.role] || "bg-[hsl(var(--muted))]"}`}
                    >
                        {item.authorInitial}
                    </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                            {item.author}
                        </span>
                        <Badge
                            variant={item.roleBadgeColor}
                            className="text-[9px] px-1.5 py-0 leading-tight"
                        >
                            {item.roleEmoji} {item.role}
                        </Badge>
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                        {item.action}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]/70">
                        <span className="font-medium text-[hsl(var(--primary))]/80">
                            📋 {item.project}
                        </span>
                        <span>·</span>
                        <span>{item.timestamp}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export const IntelFeed: React.FC<Readonly<IntelFeedProps>> = ({
    items,
    className = "",
}) => {
    return (
        <Card className={`bg-[hsl(var(--card))]/80 backdrop-blur-sm border-[hsl(var(--border))]/50 flex flex-col ${className}`}>
            <CardHeader className="pb-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-[hsl(var(--foreground))]">
                        📡 实时战报流
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] animate-pulse">
                        🔴 LIVE
                    </Badge>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="p-4 space-y-1">
                        {items.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <FeedItem item={item} />
                                {index < items.length - 1 && (
                                    <Separator className="opacity-30" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}

export default IntelFeed
