/**
 * ⚙️ 全局配置编辑器 — 下拉选项管理 + MEDDIC 权重配置
 * 原版 app.py L2583-2657
 * - 各模块下拉选项增删 (9组)
 * - MEDDIC 赢率评估权重滑块
 * - 新增/删除评估指标
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useGlobalParams } from "@/store/globalParamsStore"
import { cn } from "@/lib/utils"

type ConfigKey = "projectStages" | "painPointOptions" | "roleOptions" | "leaderAttitudes" | "leaderHistories" | "infoSources" | "projectDrivers" | "positionOptions" | "budgetStatuses"

const CONFIG_LABELS: { key: ConfigKey; label: string }[] = [
    { key: "projectStages", label: "项目阶段" },
    { key: "painPointOptions", label: "客户核心痛点" },
    { key: "roleOptions", label: "采购链角色" },
    { key: "leaderAttitudes", label: "决策者态度标签" },
    { key: "leaderHistories", label: "决策者历史标签" },
    { key: "infoSources", label: "信息来源" },
    { key: "projectDrivers", label: "立项驱动力" },
    { key: "positionOptions", label: "我方身位" },
    { key: "budgetStatuses", label: "预算状态" },
]

export function GlobalConfigEditor() {
    const { params, setParams } = useGlobalParams()
    const [tab, setTab] = useState<"options" | "meddic">("options")
    const [newItems, setNewItems] = useState<Record<string, string>>({})
    const [newDim, setNewDim] = useState("")

    function handleAddItem(key: ConfigKey) {
        const val = newItems[key]?.trim()
        if (!val) return
        const current = params[key] as string[]
        if (current.includes(val)) return
        setParams(prev => ({ ...prev, [key]: [...(prev[key] as string[]), val] }))
        setNewItems(prev => ({ ...prev, [key]: "" }))
    }

    function handleRemoveItem(key: ConfigKey, item: string) {
        setParams(prev => ({ ...prev, [key]: (prev[key] as string[]).filter(x => x !== item) }))
    }

    function handleDimChange(dim: string, value: number) {
        setParams(prev => ({ ...prev, evalDimensions: { ...prev.evalDimensions, [dim]: value } }))
    }

    function handleAddDim() {
        if (!newDim.trim() || newDim in params.evalDimensions) return
        setParams(prev => ({ ...prev, evalDimensions: { ...prev.evalDimensions, [newDim.trim()]: 50 } }))
        setNewDim("")
    }

    function handleRemoveDim(dim: string) {
        setParams(prev => {
            const nd = { ...prev.evalDimensions }
            delete nd[dim]
            return { ...prev, evalDimensions: nd }
        })
    }

    const inputClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">⚙️ 全局系统参数配置</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">SYSTEM CONFIG — 下拉选项管理 / MEDDIC 赢率权重配置 / AI 自学习引擎</p>
                </div>

                {/* Tab switch */}
                <div className="flex gap-2 justify-center">
                    <button onClick={() => setTab("options")} className={cn(
                        "px-4 py-2 text-xs rounded-md border transition-colors",
                        tab === "options" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                    )}>📋 下拉选项管理</button>
                    <button onClick={() => setTab("meddic")} className={cn(
                        "px-4 py-2 text-xs rounded-md border transition-colors",
                        tab === "meddic" ? "bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))]"
                    )}>⚖️ MEDDIC 权重配置</button>
                </div>

                {tab === "options" && (
                    <div className="space-y-4">
                        {CONFIG_LABELS.map(({ key, label }) => (
                            <Card key={key} className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs text-[hsl(var(--foreground))]">🏷️ {label}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5">
                                        {(params[key] as string[]).map(item => (
                                            <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]">
                                                {item}
                                                <button onClick={() => handleRemoveItem(key, item)} className="text-red-400 hover:text-red-300 ml-0.5">×</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newItems[key] || ""}
                                            onChange={e => setNewItems(prev => ({ ...prev, [key]: e.target.value }))}
                                            placeholder={`➕ 新增 ${label}...`}
                                            className={inputClass}
                                            onKeyDown={e => e.key === "Enter" && handleAddItem(key)}
                                        />
                                        <Button size="sm" variant="secondary" className="text-[10px]" onClick={() => handleAddItem(key)}>添加</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {tab === "meddic" && (
                    <div className="space-y-4">
                        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                            <CardHeader>
                                <CardTitle className="text-sm">🧠 动态赢率评估模型库</CardTitle>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">设定各项评估指标的绝对重要性 (0-100)。可自由增删指标。</p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {Object.entries(params.evalDimensions).map(([dim, weight]) => (
                                    <div key={dim} className="flex items-center gap-3">
                                        <span className="text-xs text-[hsl(var(--foreground))] min-w-[12rem]">{dim}</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={weight}
                                            onChange={e => handleDimChange(dim, Number(e.target.value))}
                                            className="flex-1"
                                        />
                                        <span className="text-xs text-amber-400 w-8 text-right">{weight}</span>
                                        <button onClick={() => handleRemoveDim(dim)} className="text-[10px] text-red-400 hover:text-red-300">🗑️</button>
                                    </div>
                                ))}

                                <Separator className="bg-[hsl(var(--border))]/30" />
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newDim}
                                        onChange={e => setNewDim(e.target.value)}
                                        placeholder="➕ 新增评估指标名称..."
                                        className={inputClass}
                                    />
                                    <Button size="sm" variant="default" className="text-[10px]" onClick={handleAddDim}>添加指标</Button>
                                </div>

                                <Separator className="bg-[hsl(var(--border))]/30" />
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-3 space-y-1">
                                    <p className="text-xs text-emerald-400">🤖 AI 闭环自学习引擎 (Auto-ML)</p>
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">基于未来 100 个闭环项目的胜败复盘数据，AI 将自动反向微调上述权重。</p>
                                    <Button size="sm" variant="secondary" className="text-[10px] w-full" disabled>启动自学习优化 (数据积累中...)</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    )
}
