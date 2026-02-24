/**
 * 📋 合同联审 — 4步流水线
 * 原版 app.py L3330-3602
 * Step 1: 销售录入 BOM
 * Step 2: 技术审核
 * Step 3: 商务确认 (价格+条款)
 * Step 4: VP 签批
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const STEPS = [
    { label: "📋 销售发起", desc: "录入 BOM 明细与客户需求" },
    { label: "🔧 技术联审", desc: "核查超配/工况适配性" },
    { label: "💰 商务确认", desc: "价格/付款/交付/质保条款" },
    { label: "✅ VP 签批", desc: "终审放行/盖章" },
]

export function ContractReview() {
    const [currentStep, setCurrentStep] = useState(0)
    const [projectName, setProjectName] = useState("万华化学二期改造")
    const [bomNotes, setBomNotes] = useState("")
    const [techReview, setTechReview] = useState("")
    const [paymentTerms, setPaymentTerms] = useState("3-3-3-1 (预付30%-发货30%-安装30%-质保10%)")
    const [deliveryDays, setDeliveryDays] = useState("45")
    const [warrantyYears, setWarrantyYears] = useState("2")
    const [approved, setApproved] = useState(false)

    const inputClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">📋 合同联审中心</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">CONTRACT REVIEW — 4步流水线审批 / 技术+商务+VP 联合签批</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-between">
                    {STEPS.map((step, i) => (
                        <div key={i} className="flex-1 text-center">
                            <div className={cn(
                                "w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-colors",
                                i < currentStep ? "bg-emerald-500 text-white" :
                                    i === currentStep ? "bg-[hsl(var(--primary))] text-white ring-2 ring-[hsl(var(--primary))]/30" :
                                        "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
                            )}>
                                {i < currentStep ? "✓" : i + 1}
                            </div>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{step.label}</p>
                        </div>
                    ))}
                </div>

                {/* Step content */}
                <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            {STEPS[currentStep].label}
                            <Badge variant="outline" className="text-[9px]">步骤 {currentStep + 1}/4</Badge>
                        </CardTitle>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{STEPS[currentStep].desc}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {currentStep === 0 && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs text-[hsl(var(--muted-foreground))]">🎯 项目名称</label>
                                    <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className={inputClass} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-[hsl(var(--muted-foreground))]">📋 BOM 明细/特殊说明</label>
                                    <textarea value={bomNotes} onChange={e => setBomNotes(e.target.value)} placeholder="录入设备清单及客户特殊要求..." className={cn(inputClass, "h-24 resize-none")} />
                                </div>
                            </>
                        )}
                        {currentStep === 1 && (
                            <>
                                <div className="bg-blue-500/10 text-blue-300 text-xs p-3 rounded">
                                    📋 项目：{projectName}<br />
                                    📝 BOM说明：{bomNotes || "（无特殊说明）"}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-[hsl(var(--muted-foreground))]">🔧 技术审核意见</label>
                                    <textarea value={techReview} onChange={e => setTechReview(e.target.value)} placeholder="是否存在超配/工况不适配/需调整的参数..." className={cn(inputClass, "h-24 resize-none")} />
                                </div>
                            </>
                        )}
                        {currentStep === 2 && (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">💳 付款条件</label>
                                        <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🚚 交付周期 (天)</label>
                                        <input type="text" value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">🛡️ 质保 (年)</label>
                                        <input type="text" value={warrantyYears} onChange={e => setWarrantyYears(e.target.value)} className={inputClass} />
                                    </div>
                                </div>
                            </>
                        )}
                        {currentStep === 3 && (
                            <>
                                <div className="bg-[hsl(var(--background))]/50 rounded-md p-4 space-y-2 text-xs">
                                    <p className="text-[hsl(var(--foreground))] font-medium">📋 合同终审摘要</p>
                                    <Separator className="bg-[hsl(var(--border))]/30" />
                                    <p>🎯 项目：{projectName}</p>
                                    <p>🔧 技术审核：{techReview || "通过"}</p>
                                    <p>💳 付款：{paymentTerms}</p>
                                    <p>🚚 交付：{deliveryDays} 天</p>
                                    <p>🛡️ 质保：{warrantyYears} 年</p>
                                </div>
                                {approved && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-3 text-center">
                                        <p className="text-sm text-emerald-400 font-bold">✅ VP 已签批！合同审批流程完毕。</p>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="flex gap-2 pt-2">
                            {currentStep > 0 && (
                                <Button variant="secondary" size="sm" onClick={() => setCurrentStep(p => p - 1)}>← 上一步</Button>
                            )}
                            {currentStep < 3 ? (
                                <Button variant="default" size="sm" className="ml-auto" onClick={() => setCurrentStep(p => p + 1)}>下一步 →</Button>
                            ) : !approved ? (
                                <Button variant="default" size="sm" className="ml-auto" onClick={() => setApproved(true)}>✅ VP 签批放行</Button>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
