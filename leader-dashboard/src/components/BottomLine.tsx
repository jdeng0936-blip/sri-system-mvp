import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface BottomLineProps {
    readonly finalAmount: string
    readonly finalRaw: number
    readonly className?: string
}

export const BottomLine: React.FC<Readonly<BottomLineProps>> = ({
    finalAmount,
    finalRaw: _finalRaw,
    className = "",
}) => {
    const [submitted, setSubmitted] = React.useState(false)

    const handleSubmit = () => {
        setSubmitted(true)
        // In production: trigger API call
        setTimeout(() => setSubmitted(false), 3000)
    }

    return (
        <Card className={`bg-[hsl(var(--card))]/60 backdrop-blur-sm border-[hsl(var(--border))]/50 overflow-hidden ${className}`}>
            {/* Gold accent top border */}
            <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

            <CardContent className="p-8 text-center">
                {/* Label */}
                <div className="text-sm text-[hsl(var(--muted-foreground))] tracking-widest uppercase mb-2">
                    💰 最终实发提成金额
                </div>

                <Separator className="opacity-20 mb-6" />

                {/* Hero amount with glow effect */}
                <div className="relative inline-block">
                    {/* Glow backdrop */}
                    <div className="absolute inset-0 blur-2xl bg-amber-500/20 rounded-full scale-150" />

                    <div className="relative text-6xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-lg animate-pulse-slow">
                        {finalAmount}
                    </div>
                </div>

                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-3 mb-8">
                    含基础提成 + 溢价奖励 + 战略捆绑奖 - 扣减项
                </div>

                {/* Submit button */}
                <Button
                    size="lg"
                    className={`w-full max-w-md h-14 text-base font-bold transition-all duration-300 ${submitted
                        ? "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90"
                        : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 hover:scale-[1.02] hover:shadow-xl hover:shadow-red-500/20"
                        }`}
                    onClick={handleSubmit}
                    disabled={submitted}
                >
                    {submitted ? "✅ 已提交，等待高管审批..." : "🚀 提交高管审批"}
                </Button>

                {submitted && (
                    <div className="mt-4 text-sm text-[hsl(var(--success))] animate-pulse">
                        📡 审批请求已发送至销售VP · 王总
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default BottomLine
