import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSettings } from "@/contexts/SettingsContext"
import { generateNBA } from "@/lib/apiClient"
import { cn } from "@/lib/utils"

interface AIHeadquartersProps {
    projectId: number | null
    projectName: string
}

export function AIHeadquarters({ projectId }: AIHeadquartersProps) {
    const { settings } = useSettings()
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const handleGenerate = useCallback(async () => {
        if (!projectId) { setError("请先选择项目"); return }
        const hasKey = settings.apiKey || settings.llmConfigs.openai.apiKey
        if (!hasKey) { setError("⚠️ 请先在 ⚙️ 设置中配置 API Key"); return }

        setLoading(true)
        setReport(null)
        setError(null)

        const data = await generateNBA(projectId, settings.apiKey, settings.llmConfigs)
        if (data.error) setError(data.error)
        else if (data.report) setReport(data.report)
        setLoading(false)
    }, [projectId, settings])

    const handleCopy = () => {
        if (!report) return
        navigator.clipboard.writeText(report)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                    <span className="text-sm">🧠</span>
                    <span className="text-sm font-bold text-[hsl(var(--foreground))]">AI 统帅部</span>
                    <Badge variant="outline" className="text-[9px] font-mono">全局诊断</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                    💡 统帅部将扫描该项目自立项以来的所有情报，为您指出致命盲区与最佳赢单路径。
                </p>

                <Button
                    onClick={handleGenerate}
                    disabled={loading || !projectId}
                    variant="destructive"
                    className="w-full h-10 text-xs font-bold gap-2"
                >
                    {loading ? (
                        <><span className="animate-spin">⏳</span> 全息战况推演中...</>
                    ) : (
                        <>📊 一键生成【赢率诊断与 NBA】报告</>
                    )}
                </Button>

                {loading && (
                    <div className="space-y-2 p-4 rounded-lg bg-[hsl(var(--background))]/60 border border-[hsl(var(--border))]/20">
                        <div className="h-3 w-4/5 rounded bg-[hsl(var(--muted))]/30 animate-pulse" />
                        <div className="h-3 w-full rounded bg-[hsl(var(--muted))]/20 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <div className="h-3 w-3/5 rounded bg-[hsl(var(--muted))]/25 animate-pulse" style={{ animationDelay: "300ms" }} />
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                            <span className="inline-block w-1.5 h-3.5 bg-red-500 rounded-sm animate-[blink_1s_infinite]" />
                            正在测算 MEDDIC 7 维赢率模型...
                        </div>
                    </div>
                )}

                {error && !loading && (
                    <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-400">{error}</div>
                )}

                {report && !loading && (
                    <div className="relative group">
                        <pre className="p-4 rounded-lg bg-[hsl(var(--background))]/80 border border-[hsl(var(--border))]/30 text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap break-words leading-relaxed max-h-[500px] overflow-y-auto">
                            {report}
                        </pre>
                        <button
                            onClick={handleCopy}
                            className={cn(
                                "absolute top-2 right-2 px-2 py-1 rounded text-[10px] border transition-all",
                                copied
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                    : "bg-[hsl(var(--background))]/80 border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100"
                            )}
                        >
                            {copied ? "✅ 已复制" : "📋 复制"}
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
