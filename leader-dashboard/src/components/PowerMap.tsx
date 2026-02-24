import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettings } from "@/contexts/SettingsContext"
import { saveStakeholders, generatePowerMap, extractStakeholders, type StakeholderRow } from "@/lib/apiClient"
import { cn } from "@/lib/utils"

const ROLE_OPTIONS = [
    "决策者 (关注ROI/风险)",
    "使用者 (关注易用/免维护)",
    "影响者 (关注参数/合规)",
    "教练/内线 (关注控标/汇报)",
    "技术把关者 (关注技术指标)",
]

const ATTITUDE_OPTIONS = [
    { value: "🟢 铁杆支持", label: "🟢 铁杆支持" },
    { value: "🟡 中立/观望", label: "🟡 中立/观望" },
    { value: "🔴 反对/死敌", label: "🔴 反对/死敌" },
]

const emptyRow = (): StakeholderRow => ({
    name: "", title: "", role: "", attitude: "🟡 中立/观望", influence: 5, reports_to: "",
})

interface PowerMapProps {
    projectId: number | null
    projectName: string
    initialStakeholders: { name: string; title: string; tags: string }[]
}

export function PowerMap({ projectId, projectName, initialStakeholders }: PowerMapProps) {
    const { settings } = useSettings()

    // Parse initial stakeholders into rows
    const parseInitial = (): StakeholderRow[] => {
        if (!initialStakeholders.length) return [emptyRow()]
        return initialStakeholders.map((s) => {
            const parts = s.tags.split("|").map((p) => p.trim())
            return {
                name: s.name,
                title: s.title,
                role: parts.find((p) => ROLE_OPTIONS.some((r) => p.includes(r.split(" ")[0]))) || "",
                attitude: parts.find((p) => p.includes("🟢") || p.includes("🟡") || p.includes("🔴")) || "🟡 中立/观望",
                influence: parseInt(parts.find((p) => p.startsWith("影响力:"))?.split(":")[1] || "5") || 5,
                reports_to: parts.find((p) => p.startsWith("汇报给:"))?.split(":")[1] || "",
            }
        })
    }

    const [rows, setRows] = useState<StakeholderRow[]>(parseInitial)
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState("")
    const [mapLoading, setMapLoading] = useState(false)
    const [mapResult, setMapResult] = useState<string | null>(null)
    const [mapError, setMapError] = useState<string | null>(null)
    const [extracting, setExtracting] = useState(false)
    const [extractMsg, setExtractMsg] = useState("")

    const updateRow = (idx: number, field: keyof StakeholderRow, value: string | number) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
    }

    const addRow = () => setRows((prev) => [...prev, emptyRow()])

    const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx))

    const handleSave = useCallback(async () => {
        if (!projectId) return
        setSaving(true)
        setSaveMsg("")
        const validRows = rows.filter((r) => r.name.trim())
        const result = await saveStakeholders(projectId, validRows)
        if (result.error) setSaveMsg(`❌ ${result.error}`)
        else setSaveMsg(`✅ 已保存 ${result.saved} 位干系人`)
        setSaving(false)
        setTimeout(() => setSaveMsg(""), 3000)
    }, [projectId, rows])

    const handleExtract = useCallback(async () => {
        if (!projectId) return
        const hasKey = settings.apiKey || settings.llmConfigs.openai.apiKey
        if (!hasKey) { setExtractMsg("⚠️ 请先配置 API Key"); return }

        setExtracting(true)
        setExtractMsg("")

        const data = await extractStakeholders(projectId, settings.apiKey, settings.llmConfigs)
        if (data.error) {
            setExtractMsg(`❌ ${data.error}`)
        } else if (data.stakeholders && data.stakeholders.length > 0) {
            // Dedup merge by name
            setRows((prev) => {
                const existingNames = new Set(prev.map((r) => r.name.trim()))
                const newRows = data.stakeholders!.filter((s) => s.name && !existingNames.has(s.name.trim()))
                const cleaned = prev.filter((r) => r.name.trim()) // remove empty placeholder rows
                return cleaned.length === 0 && newRows.length === 0 ? [emptyRow()] : [...cleaned, ...newRows]
            })
            setExtractMsg(`✅ 成功提取 ${data.stakeholders.length} 位干系人`)
        } else {
            setExtractMsg("⚠️ AI 未从情报中发现具体人物")
        }
        setExtracting(false)
        setTimeout(() => setExtractMsg(""), 4000)
    }, [projectId, settings])

    const handleGenerateMap = useCallback(async () => {
        if (!projectId) return
        const hasKey = settings.apiKey || settings.llmConfigs.openai.apiKey
        if (!hasKey) { setMapError("⚠️ 请先配置 API Key"); return }

        const validRows = rows.filter((r) => r.name.trim())
        if (!validRows.length) { setMapError("请先添加人物数据"); return }

        setMapLoading(true)
        setMapResult(null)
        setMapError(null)

        const csv = "姓名,职位,角色,态度,影响力,上级\n" +
            validRows.map((r) => `${r.name},${r.title},${r.role},${r.attitude},${r.influence},${r.reports_to}`).join("\n")

        const data = await generatePowerMap(projectName, csv, settings.apiKey, settings.llmConfigs)
        if (data.error) setMapError(data.error)
        else setMapResult(data.raw || [data.strategy, data.mermaid ? `\`\`\`mermaid\n${data.mermaid}\n\`\`\`` : ""].join("\n\n"))
        setMapLoading(false)
    }, [projectId, projectName, rows, settings])

    return (
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                    <span className="text-sm">👥</span>
                    <span className="text-sm font-bold text-[hsl(var(--foreground))]">关键决策链 / 权力地图</span>
                    <Badge variant="outline" className="text-[9px] font-mono">Power Map</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    💡 战术核心：谁是拍板人？录入关键人物，AI 将分析利益纠葛与政治站位。
                </p>

                {/* AI Eagle Eye Extraction */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExtract}
                    disabled={extracting || !projectId}
                    className="w-full text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 mb-1"
                >
                    {extracting ? (
                        <><span className="animate-spin mr-1">⏳</span> AI 正在穿透历史情报...</>
                    ) : (
                        <>🤖 一键智能提取干系人 (AI 读取历史情报)</>
                    )}
                </Button>
                {extractMsg && (
                    <p className={cn("text-[10px]", extractMsg.startsWith("✅") ? "text-emerald-400" : "text-amber-400")}>{extractMsg}</p>
                )}

                {/* Editable Table */}
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.4fr_0.8fr_2rem] gap-1 text-[9px] text-[hsl(var(--muted-foreground))] uppercase px-1">
                        <span>姓名</span><span>职位</span><span>角色定位</span><span>态度</span><span>权重</span><span>上级</span><span></span>
                    </div>

                    {rows.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.4fr_0.8fr_2rem] gap-1 items-center">
                            <Input
                                value={row.name}
                                onChange={(e) => updateRow(idx, "name", e.target.value)}
                                placeholder="姓名"
                                className="h-7 text-[11px]"
                            />
                            <Input
                                value={row.title}
                                onChange={(e) => updateRow(idx, "title", e.target.value)}
                                placeholder="职位"
                                className="h-7 text-[11px]"
                            />
                            <Select value={row.role} onValueChange={(v) => updateRow(idx, "role", v)}>
                                <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="选择..." /></SelectTrigger>
                                <SelectContent>
                                    {ROLE_OPTIONS.map((r) => (
                                        <SelectItem key={r} value={r} className="text-[11px]">{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={row.attitude} onValueChange={(v) => updateRow(idx, "attitude", v)}>
                                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ATTITUDE_OPTIONS.map((a) => (
                                        <SelectItem key={a.value} value={a.value} className="text-[11px]">{a.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                type="number"
                                min={1} max={10}
                                value={row.influence}
                                onChange={(e) => updateRow(idx, "influence", parseInt(e.target.value) || 5)}
                                className="h-7 text-[11px] text-center"
                            />
                            <Input
                                value={row.reports_to}
                                onChange={(e) => updateRow(idx, "reports_to", e.target.value)}
                                placeholder="汇报给..."
                                className="h-7 text-[11px]"
                            />
                            <button
                                onClick={() => removeRow(idx)}
                                className="w-6 h-6 rounded text-[10px] text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                            >✕</button>
                        </div>
                    ))}
                </div>

                <button
                    onClick={addRow}
                    className="w-full h-7 rounded border border-dashed border-[hsl(var(--border))]/30 text-[10px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/50 hover:text-[hsl(var(--primary))] transition-colors"
                >
                    + 添加人物
                </button>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 text-xs"
                    >
                        {saving ? "保存中..." : "💾 保存数据"}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleGenerateMap}
                        disabled={mapLoading || !projectId}
                        className="flex-1 text-xs"
                    >
                        {mapLoading ? "推演中..." : "🕸️ 生成关系图谱 & 策略"}
                    </Button>
                </div>

                {saveMsg && (
                    <p className={cn("text-[10px]", saveMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400")}>{saveMsg}</p>
                )}

                {mapLoading && (
                    <div className="space-y-2 p-3 rounded-lg bg-[hsl(var(--background))]/60 border border-[hsl(var(--border))]/20">
                        <div className="h-3 w-4/5 rounded bg-[hsl(var(--muted))]/30 animate-pulse" />
                        <div className="h-3 w-full rounded bg-[hsl(var(--muted))]/20 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">🕵️ AI 正在分析人物背后的利益纠葛...</p>
                    </div>
                )}

                {mapError && !mapLoading && (
                    <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-400">{mapError}</div>
                )}

                {mapResult && !mapLoading && (
                    <pre className="p-4 rounded-lg bg-[hsl(var(--background))]/80 border border-[hsl(var(--border))]/30 text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap break-words leading-relaxed max-h-[400px] overflow-y-auto">
                        {mapResult}
                    </pre>
                )}
            </CardContent>
        </Card>
    )
}
