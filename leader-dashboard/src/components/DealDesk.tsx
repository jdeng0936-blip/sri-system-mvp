/**
 * 💰 询报价 Deal Desk — BOM 底单 & 报价单生成
 * 原版 app.py L2873-3329
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface Project { id: number; name: string; stage: string }

interface BOMItem {
    name: string
    model: string
    qty: number
    unitPrice: number
}

const DEMO_BOM: BOMItem[] = [
    { name: "高压开关柜", model: "KYN28A-12", qty: 4, unitPrice: 85000 },
    { name: "干式变压器", model: "SCB13-1600/10", qty: 2, unitPrice: 120000 },
    { name: "低压抽屉柜", model: "MNS-E", qty: 6, unitPrice: 32000 },
    { name: "直流屏", model: "GZDW-48V/100Ah", qty: 1, unitPrice: 45000 },
]

export function DealDesk() {
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState("")
    const [bomItems, setBomItems] = useState<BOMItem[]>(DEMO_BOM)
    const [discountRate, setDiscountRate] = useState(95) // 折扣率 %
    const [quoteGenerated, setQuoteGenerated] = useState(false)

    useEffect(() => {
        fetch("http://localhost:8000/api/projects")
            .then(r => r.json())
            .then((data: Project[]) => {
                setProjects(data)
                if (data.length > 0) setSelectedProject(data[0].name)
            })
            .catch(() => { })
    }, [])

    const totalStandard = bomItems.reduce((s, i) => s + i.qty * i.unitPrice, 0)
    const totalDiscounted = totalStandard * (discountRate / 100)

    const selectClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">💰 询报价 Deal Desk</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">QUOTATION CENTER — BOM 底单调取 / AI 解析 / 正式报价单生成</p>
                </div>

                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className={selectClass}>
                    {projects.map(p => <option key={p.id} value={p.name}>{p.name} ({p.stage})</option>)}
                </select>

                {/* BOM Table */}
                <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            📋 BOM 底单明细表
                            <Badge variant="outline" className="text-[9px]">{selectedProject}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[hsl(var(--border))]/30">
                                        <th className="text-left py-2 text-[hsl(var(--muted-foreground))]">设备名称</th>
                                        <th className="text-left py-2 text-[hsl(var(--muted-foreground))]">型号规格</th>
                                        <th className="text-right py-2 text-[hsl(var(--muted-foreground))]">核定数量</th>
                                        <th className="text-right py-2 text-[hsl(var(--muted-foreground))]">标准单价(元)</th>
                                        <th className="text-right py-2 text-[hsl(var(--muted-foreground))]">小计</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bomItems.map((item, i) => (
                                        <tr key={i} className="border-b border-[hsl(var(--border))]/10">
                                            <td className="py-2 text-[hsl(var(--foreground))]">{item.name}</td>
                                            <td className="py-2 text-[hsl(var(--muted-foreground))]">{item.model}</td>
                                            <td className="py-2 text-right text-[hsl(var(--foreground))]">{item.qty}</td>
                                            <td className="py-2 text-right text-[hsl(var(--foreground))]">¥{item.unitPrice.toLocaleString()}</td>
                                            <td className="py-2 text-right text-amber-400 font-medium">¥{(item.qty * item.unitPrice).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-[hsl(var(--border))]/50">
                                        <td colSpan={4} className="py-2 text-right font-medium text-[hsl(var(--foreground))]">标准总价:</td>
                                        <td className="py-2 text-right font-bold text-[hsl(var(--foreground))]">¥{totalStandard.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <Separator className="my-4 bg-[hsl(var(--border))]/30" />

                        <div className="flex items-center gap-4">
                            <label className="text-xs text-[hsl(var(--muted-foreground))]">🎛️ 折扣率:</label>
                            <input
                                type="range"
                                min={70}
                                max={100}
                                value={discountRate}
                                onChange={e => setDiscountRate(Number(e.target.value))}
                                className="flex-1"
                            />
                            <span className="text-sm font-bold text-amber-400">{discountRate}%</span>
                            <span className="text-sm text-[hsl(var(--foreground))]">→ ¥{totalDiscounted.toLocaleString()}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Generate Quote */}
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        variant="default"
                        className="text-sm py-3"
                        onClick={() => setQuoteGenerated(true)}
                    >
                        📄 生成正式报价单 (PDF)
                    </Button>
                    <Button
                        variant="secondary"
                        className="text-sm py-3"
                        disabled={!quoteGenerated}
                    >
                        📧 一键邮件投送客户
                    </Button>
                </div>

                {quoteGenerated && (
                    <Card className="bg-emerald-500/5 border border-emerald-500/30">
                        <CardContent className="pt-5">
                            <p className="text-sm text-emerald-400">✅ 正式报价单已生成！项目：{selectedProject}，折后总价 ¥{totalDiscounted.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
