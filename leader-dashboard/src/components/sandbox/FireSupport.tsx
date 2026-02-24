/**
 * FireSupport.tsx — 智能火力支援舱 (完整版)
 * ============================================
 * 完整还原 app.py tab_sandbox 中的火力支援模块:
 *  1. 发送渠道选择 (微信/邮件)
 *  2. 目标人物选择 (从权力地图拉取)
 *  3. 项目阶段 + 历史打单
 *  4. 总监助销模式
 *  5. 竞品对标 + 痛点多选
 *  6. 跟进话术按钮 + 技术方案摘要按钮
 *  7. 内线专属通道 (教练弹药库)
 */

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { useGlobalParams } from "@/store/globalParamsStore"
import { generatePitch, fetchStakeholders, type StakeholderRow } from "@/lib/apiClient"
import {
    Loader2,
    Rocket,
    Copy,
    Check,
    X,
    Plus,
    ChevronDown,
    Shield,
    UserCheck,
    Radio,
    FileText,
    Lock,
} from "lucide-react"

type Channel = "wechat" | "email"

export function FireSupport({ projectId }: { projectId?: number }) {
    const user = useAuthStore((s) => s.user)
    const { params } = useGlobalParams()

    // ── 表单状态 ──
    const [channel, setChannel] = useState<Channel>("wechat")
    const [targetPerson, setTargetPerson] = useState("关键决策人")
    const [stage, setStage] = useState(params.projectStages[0] || "")
    const [useHistory, setUseHistory] = useState(true)
    const [competitor, setCompetitor] = useState("")
    const [selectedPains, setSelectedPains] = useState<string[]>([])
    const [painOpen, setPainOpen] = useState(false)

    // 总监助销
    const isDirector = user?.role === "director" || user?.role === "vp"
    const [subordinateName, setSubordinateName] = useState("")

    // 内线通道
    const [leaderAttitude, setLeaderAttitude] = useState(params.leaderAttitudes[0] || "")
    const [leaderHistory, setLeaderHistory] = useState(params.leaderHistories[0] || "")
    const [insiderOpen, setInsiderOpen] = useState(false)

    // 关键人列表
    const [people, setPeople] = useState<StakeholderRow[]>([])
    useEffect(() => {
        if (projectId) {
            fetchStakeholders(projectId).then(setPeople).catch(() => setPeople([]))
        }
    }, [projectId])

    // AI 结果 (跟进话术)
    const [pitchResult, setPitchResult] = useState("")
    const [pitchLoading, setPitchLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    // AI 结果 (技术摘要)
    const [techResult, setTechResult] = useState("")
    const [techLoading, setTechLoading] = useState(false)
    const [techCopied, setTechCopied] = useState(false)

    // AI 结果 (内线话术)
    const [insiderResult, setInsiderResult] = useState("")
    const [insiderLoading, setInsiderLoading] = useState(false)
    const [insiderCopied, setInsiderCopied] = useState(false)

    const togglePain = (pain: string) =>
        setSelectedPains((prev) =>
            prev.includes(pain) ? prev.filter((p) => p !== pain) : [...prev, pain],
        )

    const buildContext = (type: string) => {
        return [
            `任务类型: ${type}`,
            `发送渠道: ${channel === "wechat" ? "微信/短信" : "正式邮件"}`,
            `目标人物: ${targetPerson}`,
            `当前阶段: ${stage}`,
            competitor ? `主要竞品: ${competitor}` : "",
            selectedPains.length > 0 ? `客户痛点: ${selectedPains.join(", ")}` : "",
            useHistory ? "请参考历史成功案例" : "",
            isDirector && subordinateName ? `总监助销模式，下属姓名: ${subordinateName}` : "",
        ].filter(Boolean).join("\n")
    }

    // ── 跟进话术 ──
    const handleGeneratePitch = async () => {
        setPitchLoading(true)
        setPitchResult("")
        try {
            const res = await generatePitch(projectId || 0, buildContext("跟进话术"))
            setPitchResult(res.result || res.error || "无返回")
        } catch (err: unknown) {
            setPitchResult(`❌ ${(err as { message?: string })?.message || "生成失败"}`)
        } finally {
            setPitchLoading(false)
        }
    }

    // ── 技术方案摘要 ──
    const handleGenerateTech = async () => {
        setTechLoading(true)
        setTechResult("")
        try {
            const res = await generatePitch(projectId || 0, buildContext("技术方案摘要"))
            setTechResult(res.result || res.error || "无返回")
        } catch (err: unknown) {
            setTechResult(`❌ ${(err as { message?: string })?.message || "生成失败"}`)
        } finally {
            setTechLoading(false)
        }
    }

    // ── 内线话术 ──
    const handleGenerateInsider = async () => {
        setInsiderLoading(true)
        setInsiderResult("")
        const ctx = [
            buildContext("内线向上汇报话术"),
            `领导态度: ${leaderAttitude}`,
            `领导历史: ${leaderHistory}`,
        ].join("\n")
        try {
            const res = await generatePitch(projectId || 0, ctx)
            setInsiderResult(res.result || res.error || "无返回")
        } catch (err: unknown) {
            setInsiderResult(`❌ ${(err as { message?: string })?.message || "生成失败"}`)
        } finally {
            setInsiderLoading(false)
        }
    }

    const copyText = async (text: string, setter: (v: boolean) => void) => {
        await navigator.clipboard.writeText(text)
        setter(true)
        setTimeout(() => setter(false), 2000)
    }

    const personOptions = ["关键决策人 (默认)", ...people.map((p) => p.name)]

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🚀</span>
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                    智能火力支援舱 · 四维精准制导
                </h3>
                <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ═══ 左侧：配置面板 ═══ */}
                <div className="space-y-4">
                    {/* A. 发送渠道 */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">
                            📡 发送渠道
                        </label>
                        <div className="flex gap-2">
                            {(["wechat", "email"] as Channel[]).map((ch) => (
                                <button
                                    key={ch}
                                    onClick={() => setChannel(ch)}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition ${channel === ch
                                        ? "bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))]"
                                        : "bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/[0.05]"
                                        }`}
                                >
                                    {ch === "wechat" ? "🟢 微信/短信" : "📧 正式邮件"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* B. 目标人物 */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">
                            🎯 发送对象
                        </label>
                        <div className="relative">
                            <select
                                value={targetPerson}
                                onChange={(e) => setTargetPerson(e.target.value)}
                                className="w-full appearance-none px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 cursor-pointer"
                            >
                                {personOptions.map((p) => (
                                    <option key={p} value={p} className="bg-[hsl(222,47%,9%)]">{p}</option>
                                ))}
                            </select>
                            <UserCheck size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                        </div>
                    </div>

                    {/* C. 项目阶段 */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">📍 当前项目阶段</label>
                        <div className="relative">
                            <select
                                value={stage}
                                onChange={(e) => setStage(e.target.value)}
                                className="w-full appearance-none px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 cursor-pointer"
                            >
                                {params.projectStages.map((s) => (
                                    <option key={s} value={s} className="bg-[hsl(222,47%,9%)]">{s}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                        </div>
                    </div>

                    {/* D. 历史打单 */}
                    <label className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3 border border-white/5 cursor-pointer hover:bg-white/[0.05] transition">
                        <div className="relative">
                            <input type="checkbox" checked={useHistory} onChange={(e) => setUseHistory(e.target.checked)} className="peer sr-only" />
                            <div className="w-5 h-5 rounded-md border-2 border-white/20 peer-checked:border-[hsl(var(--primary))] peer-checked:bg-[hsl(var(--primary))] transition flex items-center justify-center">
                                {useHistory && <Check size={12} className="text-white" />}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-white/70 font-medium">📖 调取历史打单价值</div>
                            <div className="text-[10px] text-white/30">自动查阅过往同类项目的成功经验</div>
                        </div>
                    </label>

                    {/* E. 总监助销模式 (仅 director/vp 可见) */}
                    {isDirector && (
                        <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 p-4">
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-purple-400/80">
                                <Shield size={12} /> 总监助销模式
                            </div>
                            <div className="text-[10px] text-white/30 mb-2">
                                系统将以高管身份生成降维打击话术
                            </div>
                            <input
                                value={subordinateName}
                                onChange={(e) => setSubordinateName(e.target.value)}
                                placeholder="负责该项目的下属姓名 (如: 小王)"
                                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            />
                        </div>
                    )}

                    {/* F. 竞品对标 */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">⚔️ 明确对比友商</label>
                        <input
                            type="text" value={competitor} onChange={(e) => setCompetitor(e.target.value)}
                            placeholder="西门子 / 施耐德 / ABB / 正泰..."
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 transition"
                        />
                    </div>

                    {/* G. 痛点 MultiSelect */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">🩹 客户当前痛点 (多选)</label>
                        {selectedPains.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedPains.map((pain) => (
                                    <span key={pain} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                                        {pain}
                                        <button onClick={() => togglePain(pain)} className="hover:text-red-100 transition"><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <button
                                onClick={() => setPainOpen(!painOpen)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/50 hover:border-white/20 transition"
                            >
                                <span className="flex items-center gap-1.5"><Plus size={12} />{selectedPains.length === 0 ? "点击选择痛点标签" : `已选 ${selectedPains.length} 项`}</span>
                                <ChevronDown size={14} className={`transition-transform ${painOpen ? "rotate-180" : ""}`} />
                            </button>
                            {painOpen && (
                                <div className="absolute z-20 w-full mt-1 rounded-xl bg-[hsl(222,47%,11%)] border border-white/10 shadow-2xl overflow-hidden">
                                    {params.painPointOptions.map((pain) => {
                                        const sel = selectedPains.includes(pain)
                                        return (
                                            <button key={pain} onClick={() => togglePain(pain)}
                                                className={`w-full text-left px-4 py-2.5 text-xs transition ${sel ? "bg-red-500/10 text-red-300" : "text-white/50 hover:bg-white/5 hover:text-white/70"}`}>
                                                <span className="mr-2">{sel ? "✓" : "○"}</span>{pain}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ 生成按钮组 ═══ */}
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleGeneratePitch} disabled={pitchLoading}
                            className="py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-emerald-500/20">
                            {pitchLoading ? <><Loader2 size={14} className="animate-spin" />生成中...</> : <><Radio size={14} />✉️ 跟进话术</>}
                        </button>
                        <button onClick={handleGenerateTech} disabled={techLoading}
                            className="py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-blue-500/20">
                            {techLoading ? <><Loader2 size={14} className="animate-spin" />生成中...</> : <><FileText size={14} />📄 技术摘要</>}
                        </button>
                    </div>

                    {/* ═══ 🕵️ 内线专属通道 ═══ */}
                    <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] overflow-hidden">
                        <button
                            onClick={() => setInsiderOpen(!insiderOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-500/[0.05] transition"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-400/80">
                                <Lock size={12} />
                                🕵️ 内线专属通道 (教练弹药库)
                            </div>
                            <ChevronDown size={14} className={`text-amber-400/40 transition-transform ${insiderOpen ? "rotate-180" : ""}`} />
                        </button>

                        {insiderOpen && (
                            <div className="px-4 pb-4 space-y-3">
                                <div className="text-[10px] text-white/30">
                                    🎯 锁定汇报目标 (决策者心理画像分析)
                                </div>

                                {/* 领导态度 */}
                                <div>
                                    <label className="block text-[10px] font-medium text-white/40 mb-1">🧠 领导当前态度/关注核心</label>
                                    <select value={leaderAttitude} onChange={(e) => setLeaderAttitude(e.target.value)}
                                        className="w-full appearance-none px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/70 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
                                        {params.leaderAttitudes.map((a) => (
                                            <option key={a} value={a} className="bg-[hsl(222,47%,9%)]">{a}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 领导历史 */}
                                <div>
                                    <label className="block text-[10px] font-medium text-white/40 mb-1">🕰️ 领导的历史轨迹/心理阴影</label>
                                    <select value={leaderHistory} onChange={(e) => setLeaderHistory(e.target.value)}
                                        className="w-full appearance-none px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/70 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
                                        {params.leaderHistories.map((h) => (
                                            <option key={h} value={h} className="bg-[hsl(222,47%,9%)]">{h}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 生成按钮 */}
                                <button onClick={handleGenerateInsider} disabled={insiderLoading}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-amber-500/20">
                                    {insiderLoading ? <><Loader2 size={14} className="animate-spin" />推演中...</> : <><Rocket size={14} />🔥 生成内线向上汇报话术</>}
                                </button>

                                {/* 内线结果 */}
                                {insiderResult && (
                                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[10px] font-bold text-amber-400/80">🔒 极密：内线话术</div>
                                            <button onClick={() => copyText(insiderResult, setInsiderCopied)}
                                                className="flex items-center gap-1 text-[10px] text-white/30 hover:text-amber-400 transition">
                                                {insiderCopied ? <><Check size={10} /> 已复制</> : <><Copy size={10} /> 复制</>}
                                            </button>
                                        </div>
                                        <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                            {insiderResult}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ 右侧：话术结果 ═══ */}
                <div className="space-y-4">
                    {/* 跟进话术结果 */}
                    <ResultPanel
                        title="✉️ 跟进话术"
                        result={pitchResult}
                        loading={pitchLoading}
                        copied={copied}
                        onCopy={() => copyText(pitchResult, setCopied)}
                        color="emerald"
                        tags={[stage, competitor ? `vs ${competitor}` : "", ...selectedPains.slice(0, 2)].filter(Boolean)}
                    />

                    {/* 技术摘要结果 */}
                    <ResultPanel
                        title="📄 技术方案摘要"
                        result={techResult}
                        loading={techLoading}
                        copied={techCopied}
                        onCopy={() => copyText(techResult, setTechCopied)}
                        color="blue"
                        tags={[competitor ? `vs ${competitor}` : "", ...selectedPains.slice(0, 1)].filter(Boolean)}
                    />
                </div>
            </div>
        </div>
    )
}

// ── 复用结果面板 ──
function ResultPanel({
    title, result, loading, copied, onCopy, color, tags,
}: {
    title: string
    result: string
    loading: boolean
    copied: boolean
    onCopy: () => void
    color: "emerald" | "blue"
    tags: string[]
}) {
    const bgFrom = color === "emerald" ? "from-emerald-500/5" : "from-blue-500/5"
    const bgTo = color === "emerald" ? "to-teal-500/5" : "to-indigo-500/5"
    const borderColor = color === "emerald" ? "border-emerald-500/15" : "border-blue-500/15"
    const titleColor = color === "emerald" ? "text-emerald-400/80" : "text-blue-400/80"
    const hoverColor = color === "emerald" ? "hover:text-emerald-400" : "hover:text-blue-400"
    const loadBorder = color === "emerald" ? "border-emerald-500/20" : "border-blue-500/20"
    const loadBg = color === "emerald" ? "bg-emerald-500/5" : "bg-blue-500/5"
    const loadText = color === "emerald" ? "text-emerald-400" : "text-blue-400"
    const loadCaption = color === "emerald" ? "text-emerald-400/70" : "text-blue-400/70"

    if (!result && !loading) return null

    if (loading) {
        return (
            <div className={`flex items-center justify-center border border-dashed ${loadBorder} rounded-xl ${loadBg} animate-pulse min-h-[150px]`}>
                <div className="text-center">
                    <Loader2 size={24} className={`mx-auto mb-2 ${loadText} animate-spin`} />
                    <div className={`text-xs ${loadCaption}`}>弹药锻造中…</div>
                </div>
            </div>
        )
    }

    return (
        <div className={`rounded-xl bg-gradient-to-br ${bgFrom} ${bgTo} border ${borderColor} p-5`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`text-xs font-bold ${titleColor}`}>{title}</div>
                <button onClick={onCopy}
                    className={`flex items-center gap-1 text-[10px] text-white/30 ${hoverColor} transition px-2 py-1 rounded-lg hover:bg-white/5`}>
                    {copied ? <><Check size={10} /> 已复制</> : <><Copy size={10} /> 一键复制</>}
                </button>
            </div>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/30">{t}</span>
                    ))}
                </div>
            )}
            <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {result}
            </div>
        </div>
    )
}
