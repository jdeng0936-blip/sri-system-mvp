/**
 * IntelRadar.tsx — 多模态情报雷达舱
 * ====================================
 * 拜访纪要输入 + 附件上传 + AI 深度解析
 * 🛡️ 调用 /api/ai/parse-intel 并渲染结构化结果
 */

import { useState, useRef } from "react"
import { Loader2, Upload, Brain, FileText, AlertTriangle, CheckCircle2 } from "lucide-react"
import { parseIntel } from "@/lib/apiClient"

interface ParsedIntel {
    current_status?: string
    decision_chain?: Array<{
        name: string
        title: string
        phone?: string
        attitude: string
        soft_tags?: string[]
    }>
    competitor_info?: Array<{
        name: string
        quote?: string
        strengths: string
        weaknesses: string
        recent_actions: string
    }>
    next_steps?: string
    gap_alerts?: string[]
    error?: string
}

export function IntelRadar() {
    const [rawText, setRawText] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<ParsedIntel | null>(null)
    const [modelUsed, setModelUsed] = useState<string | null>(null)
    const [attachments, setAttachments] = useState<File[]>([])
    const fileRef = useRef<HTMLInputElement>(null)

    const handleParse = async () => {
        if (!rawText.trim()) return
        setIsLoading(true)
        setResult(null)
        try {
            const res = await parseIntel(rawText)
            setModelUsed(res.model_used || null)
            if (res.error) {
                setResult({ error: res.error })
            } else {
                try {
                    const parsed = JSON.parse(res.result)
                    setResult(parsed)
                } catch {
                    setResult({ current_status: res.result })
                }
            }
        } catch (err: unknown) {
            const msg = (err as { message?: string })?.message || "解析失败"
            setResult({ error: msg })
        } finally {
            setIsLoading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments((prev) => [...prev, ...Array.from(e.target.files!)])
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📡</span>
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                    多模态情报雷达舱
                </h3>
                <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左侧：输入区 */}
                <div className="space-y-4">
                    {/* 拜访纪要 */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">
                            拜访纪要 / 口述情报
                        </label>
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="把你在现场的所见所闻一五一十地倒出来……客户说了什么、谁在场、竞品报了多少、下一步怎么推进……越详细越好，AI 会帮你提炼军情。"
                            rows={10}
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 focus:border-[hsl(var(--primary))]/30 resize-none transition-all"
                        />
                        <div className="flex justify-between mt-1 text-[10px] text-white/25">
                            <span>{rawText.length} 字</span>
                            <span>支持口语化输入，AI 自动提炼结构化情报</span>
                        </div>
                    </div>

                    {/* 附件上传 */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">
                            附件上传
                        </label>
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-[hsl(var(--primary))]/30 hover:bg-white/[0.02] transition-all group"
                        >
                            <Upload
                                size={24}
                                className="mx-auto mb-2 text-white/20 group-hover:text-[hsl(var(--primary))]/60 transition"
                            />
                            <div className="text-xs text-white/30 group-hover:text-white/50 transition">
                                拖拽或点击上传 · 图片 / PDF / 名片
                            </div>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*,.pdf"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>
                        {attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {attachments.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 text-xs text-white/40 bg-white/[0.03] rounded-lg px-3 py-1.5"
                                    >
                                        <FileText size={12} />
                                        <span className="truncate">{f.name}</span>
                                        <span className="text-white/20">
                                            {(f.size / 1024).toFixed(0)}KB
                                        </span>
                                        <button
                                            onClick={() =>
                                                setAttachments((prev) => prev.filter((_, j) => j !== i))
                                            }
                                            className="ml-auto text-white/20 hover:text-red-400"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI 解析按钮 */}
                    <button
                        onClick={handleParse}
                        disabled={isLoading || !rawText.trim()}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(213,94%,55%)] text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all shadow-lg shadow-[hsl(var(--primary))]/20"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                AI 深度解析中...
                            </>
                        ) : (
                            <>
                                <Brain size={16} />
                                🧠 AI 深度解析情报
                            </>
                        )}
                    </button>

                    {modelUsed && (
                        <div className="text-[10px] text-white/20 text-center">
                            模型：{modelUsed}
                        </div>
                    )}
                </div>

                {/* 右侧：解析结果 */}
                <div className="min-h-[200px]">
                    {!result && !isLoading && (
                        <div className="h-full flex items-center justify-center border border-dashed border-white/10 rounded-xl">
                            <div className="text-center text-white/15">
                                <Brain size={40} className="mx-auto mb-3 opacity-30" />
                                <div className="text-xs">AI 解析结果将显示在此处</div>
                                <div className="text-[10px] mt-1">4+1 情报模型 · 缺口预警</div>
                            </div>
                        </div>
                    )}

                    {isLoading && (
                        <div className="h-full flex items-center justify-center border border-dashed border-[hsl(var(--primary))]/20 rounded-xl bg-[hsl(var(--primary))]/5 animate-pulse">
                            <div className="text-center">
                                <Loader2
                                    size={32}
                                    className="mx-auto mb-3 text-[hsl(var(--primary))] animate-spin"
                                />
                                <div className="text-xs text-[hsl(var(--primary))]/70">
                                    AI引擎正在深度解析情报…
                                </div>
                            </div>
                        </div>
                    )}

                    {result && !isLoading && (
                        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                            {result.error ? (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                                    <AlertTriangle size={14} className="inline mr-2" />
                                    {result.error}
                                </div>
                            ) : (
                                <>
                                    {/* 项目现状 */}
                                    {result.current_status && (
                                        <ResultCard
                                            title="📋 项目现状"
                                            content={result.current_status}
                                        />
                                    )}

                                    {/* 决策链 */}
                                    {result.decision_chain && result.decision_chain.length > 0 && (
                                        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                                            <div className="text-xs font-bold text-white/60 mb-3">
                                                👥 决策链
                                            </div>
                                            <div className="space-y-2">
                                                {result.decision_chain.map((p, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-3 text-xs bg-white/[0.03] rounded-lg px-3 py-2"
                                                    >
                                                        <span
                                                            className={`w-2 h-2 rounded-full ${p.attitude === "支持"
                                                                    ? "bg-green-400"
                                                                    : p.attitude === "反对"
                                                                        ? "bg-red-400"
                                                                        : "bg-yellow-400"
                                                                }`}
                                                        />
                                                        <span className="font-medium text-white/80">
                                                            {p.name}
                                                        </span>
                                                        <span className="text-white/40">{p.title}</span>
                                                        <span className="ml-auto text-white/30">
                                                            {p.attitude}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 竞品 */}
                                    {result.competitor_info &&
                                        result.competitor_info.length > 0 && (
                                            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                                                <div className="text-xs font-bold text-white/60 mb-3">
                                                    ⚔️ 竞品情报
                                                </div>
                                                {result.competitor_info.map((c, i) => (
                                                    <div
                                                        key={i}
                                                        className="text-xs text-white/50 mb-2 bg-white/[0.02] rounded-lg p-2.5"
                                                    >
                                                        <span className="font-medium text-white/70">
                                                            {c.name}
                                                        </span>
                                                        {c.quote && (
                                                            <span className="text-yellow-400/70 ml-2">
                                                                报价: {c.quote}
                                                            </span>
                                                        )}
                                                        <div className="mt-1 text-white/35">
                                                            优势: {c.strengths} | 劣势: {c.weaknesses}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                    {/* 下一步 */}
                                    {result.next_steps && (
                                        <ResultCard title="🎯 下一步" content={result.next_steps} />
                                    )}

                                    {/* 缺口预警 */}
                                    {result.gap_alerts && result.gap_alerts.length > 0 && (
                                        <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-4">
                                            <div className="text-xs font-bold text-red-400/80 mb-2">
                                                <AlertTriangle
                                                    size={12}
                                                    className="inline mr-1 -mt-0.5"
                                                />
                                                缺口预警
                                            </div>
                                            {result.gap_alerts.map((g, i) => (
                                                <div
                                                    key={i}
                                                    className="text-xs text-red-300/70 mb-1 flex items-start gap-2"
                                                >
                                                    <span className="shrink-0 mt-0.5">•</span>
                                                    {g}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 无缺口 */}
                                    {result.gap_alerts && result.gap_alerts.length === 0 && (
                                        <div className="rounded-xl bg-green-500/5 border border-green-500/15 p-3 flex items-center gap-2">
                                            <CheckCircle2 size={14} className="text-green-400" />
                                            <span className="text-xs text-green-400/80">
                                                情报完整度优秀！无缺口预警
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function ResultCard({ title, content }: { title: string; content: string }) {
    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <div className="text-xs font-bold text-white/60 mb-2">{title}</div>
            <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {content}
            </div>
        </div>
    )
}
