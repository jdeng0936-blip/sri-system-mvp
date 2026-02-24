import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useSettings } from "@/contexts/SettingsContext"
import { useGlobalParams } from "@/store/globalParamsStore"
import { cn } from "@/lib/utils"

// ── Types ──

interface Project {
    id: number
    name: string
    stage: string
}

interface DecisionPerson {
    name: string
    title: string
    phone: string | null
    attitude: string
    soft_tags: string[]
}

interface CompetitorInfo {
    name: string
    quote: string | null
    strengths: string
    weaknesses: string
    recent_actions: string
}

interface Intelligence {
    current_status: string
    decision_chain: DecisionPerson[]
    competitor_info: CompetitorInfo[]
    next_steps: string
    gap_alerts: string[]
}

interface AnalyzeResult {
    success: boolean
    filename?: string
    extracted_text_length?: number
    intelligence?: Intelligence
    error?: string
}

type ScanPhase = "idle" | "uploading" | "scanning" | "done" | "error"

// ── Scan Log Lines (Terminal effect) ──

const SCAN_LINES = [
    "📡 建立加密通道... OK",
    "🔍 文件指纹校验... PASS",
    "📄 启动文本提取引擎...",
    "🧠 载入 GPT 情报分析模型...",
    "⚙️ 执行 4+1 情报结构化解析...",
    "🗂️ 提取关键决策链...",
    "🎯 识别竞品动态...",
    "⚠️ 扫描情报盲点...",
    "💾 情报写入作战数据库...",
    "✅ 解析完毕 — 情报已就位",
]

// ── Component ──

export function IntelUploader() {
    // Global settings
    const { settings } = useSettings()
    const apiKey = settings.apiKey
    const llmConfigs = settings.llmConfigs
    // 检查是否有任何有效的 API Key
    const hasAnyKey = Boolean(apiKey) || Object.entries(llmConfigs || {}).some(
        ([, c]: [string, any]) => c?.enabled && c?.apiKey
    )

    // State
    const [phase, setPhase] = useState<ScanPhase>("idle")
    const [progress, setProgress] = useState(0)
    const [scanLines, setScanLines] = useState<string[]>([])
    const [result, setResult] = useState<AnalyzeResult | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState(1)
    const [dragActive, setDragActive] = useState(false)
    const terminalRef = useRef<HTMLDivElement>(null)

    // Global params for dropdowns
    const { params } = useGlobalParams()

    // Baseline form state
    const [baseInfoSource, setBaseInfoSource] = useState("")
    const [baseDriver, setBaseDriver] = useState("")
    const [basePosition, setBasePosition] = useState("")
    const [baseBudget, setBaseBudget] = useState("")
    const [baselineSaving, setBaselineSaving] = useState(false)
    const [baselineMsg, setBaselineMsg] = useState("")

    // Daily log state
    const [dailyLogText, setDailyLogText] = useState("")
    const [dailyLogSaving, setDailyLogSaving] = useState(false)
    const [dailyLogMsg, setDailyLogMsg] = useState("")
    const [isRecording, setIsRecording] = useState(false)
    const speechRef = useRef<any>(null)

    // Image upload state
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imageSaving, setImageSaving] = useState(false)
    const [imageMsg, setImageMsg] = useState("")
    const [imageResult, setImageResult] = useState("")
    const imageInputRef = useRef<HTMLInputElement>(null)

    // Fetch projects on mount
    useEffect(() => {
        fetch("http://localhost:8000/api/projects")
            .then((res) => res.json())
            .then((data: Project[]) => {
                setProjects(data)
                if (data.length > 0) setSelectedProjectId(data[0].id)
            })
            .catch(() => {
                // API unavailable, use fallback
                setProjects([{ id: 1, name: "万华化学二期改造", stage: "线索" }])
            })
    }, [])

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
    }, [scanLines])



    // Animated scan effect
    const runScanAnimation = useCallback(async () => {
        setScanLines([])
        for (let i = 0; i < SCAN_LINES.length; i++) {
            await new Promise((r) => setTimeout(r, 300 + Math.random() * 400))
            setScanLines((prev) => [...prev, SCAN_LINES[i]])
            setProgress(Math.min(90, ((i + 1) / SCAN_LINES.length) * 90))
        }
    }, [])

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }


    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* ── Header ── */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] tracking-wider">
                        🛰️ 军情解析舱
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        AI INTELLIGENCE UPLOAD & PARSING — 拖入文件，AI 自动提取 4+1 结构化情报
                    </p>
                </div>

                {/* ── Control Panel ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardContent className="pt-5 space-y-2">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                📂 关联作战项目
                            </label>
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                            >
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.stage})
                                    </option>
                                ))}
                            </select>
                        </CardContent>
                    </Card>

                    {/* ── 战役立项基座 (原版 app.py L745-800) ── */}
                    <Card className="bg-[hsl(var(--card))] border-l-4 border-l-amber-500/50 border-[hsl(var(--border))]/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                🏛️ 战役立项基座
                                <Badge variant="outline" className="text-[9px]">硬性背景指标</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                首次建档 / 更新项目背景指标。此为项目底层硬性约束，AI 后续策略全部基于此背景。
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">🕵️ 信息获取来源</label>
                                    <select value={baseInfoSource} onChange={(e) => setBaseInfoSource(e.target.value)} className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
                                        <option value="">选择...</option>
                                        {params.infoSources.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">🚀 立项核心驱动力</label>
                                    <select value={baseDriver} onChange={(e) => setBaseDriver(e.target.value)} className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
                                        <option value="">选择...</option>
                                        {params.projectDrivers.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">🏁 我方当前身位</label>
                                    <select value={basePosition} onChange={(e) => setBasePosition(e.target.value)} className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
                                        <option value="">选择...</option>
                                        {params.positionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">💰 预算落实情况</label>
                                    <select value={baseBudget} onChange={(e) => setBaseBudget(e.target.value)} className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-2 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
                                        <option value="">选择...</option>
                                        {params.budgetStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <Button
                                variant="default"
                                size="sm"
                                className="w-full text-xs"
                                disabled={baselineSaving || !selectedProjectId}
                                onClick={async () => {
                                    setBaselineSaving(true)
                                    setBaselineMsg("")
                                    try {
                                        const res = await fetch("http://localhost:8000/api/intel/save_baseline", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                project_id: selectedProjectId,
                                                info_source: baseInfoSource,
                                                project_driver: baseDriver,
                                                position: basePosition,
                                                budget_status: baseBudget,
                                            }),
                                        })
                                        const data = await res.json()
                                        if (data.success) setBaselineMsg(`✅ ${data.message}`)
                                        else setBaselineMsg(`❌ ${data.error || "保存失败"}`)
                                    } catch (e) {
                                        setBaselineMsg(`❌ 网络错误: ${e}`)
                                    }
                                    setBaselineSaving(false)
                                    setTimeout(() => setBaselineMsg(""), 4000)
                                }}
                            >
                                {baselineSaving ? "⏳ 锁定中..." : "💾 锁定并注入立项背景档案"}
                            </Button>
                            {baselineMsg && (
                                <p className={cn("text-[10px]", baselineMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400")}>{baselineMsg}</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── ✨ 添加日常推进动态 (复刻 app.py L805-813) ── */}
                <div className="space-y-3">
                    <h2 className="text-xl font-bold text-[hsl(var(--foreground))] tracking-wide">
                        ✍️ 添加日常推进动态
                    </h2>
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardContent className="pt-5 space-y-3">
                            {/* 语音录入区域 */}
                            <details className="group">
                                <summary className="cursor-pointer text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                                    🎤 点击开启语音输入： ✍️ 销售口述流水账或会议纪要
                                </summary>
                                <div className="mt-2 p-3 bg-[hsl(var(--background))]/50 rounded-md space-y-2">
                                    <Button
                                        variant={isRecording ? "destructive" : "outline"}
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => {
                                            if (isRecording) {
                                                // 停止录音
                                                speechRef.current?.stop()
                                                setIsRecording(false)
                                            } else {
                                                // 启动语音识别
                                                const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
                                                if (!SpeechRecognition) {
                                                    setDailyLogMsg("❌ 当前浏览器不支持语音输入，请使用 Chrome")
                                                    return
                                                }
                                                const recognition = new SpeechRecognition()
                                                recognition.lang = "zh-CN"
                                                recognition.continuous = true
                                                recognition.interimResults = true
                                                recognition.onresult = (event: any) => {
                                                    let transcript = ""
                                                    for (let i = event.resultIndex; i < event.results.length; i++) {
                                                        transcript += event.results[i][0].transcript
                                                    }
                                                    if (event.results[event.results.length - 1].isFinal) {
                                                        setDailyLogText(prev => prev + transcript)
                                                    }
                                                }
                                                recognition.onerror = () => setIsRecording(false)
                                                recognition.onend = () => setIsRecording(false)
                                                recognition.start()
                                                speechRef.current = recognition
                                                setIsRecording(true)
                                            }
                                        }}
                                    >
                                        {isRecording ? "🔴 录音中... 点击停止" : "🎤 开始语音输入"}
                                    </Button>
                                    {isRecording && (
                                        <p className="text-[10px] text-red-400 animate-pulse text-center">🔴 正在录音，请对着麦克风口述...</p>
                                    )}
                                </div>
                            </details>

                            <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                ✍️ 销售口述流水账或会议纪要：
                            </label>
                            <textarea
                                value={dailyLogText}
                                onChange={(e) => setDailyLogText(e.target.value)}
                                placeholder="例：今天见了张总，他觉得价格偏高..."
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] resize-y min-h-[120px]"
                            />
                            <Button
                                variant="default"
                                className="w-full"
                                disabled={dailyLogSaving || !dailyLogText.trim() || !selectedProjectId}
                                onClick={async () => {
                                    if (!hasAnyKey) { setDailyLogMsg("❌ 请先在设置中输入 API Key"); return }
                                    setDailyLogSaving(true); setDailyLogMsg("")
                                    try {
                                        const res = await fetch("http://localhost:8000/api/intel/daily_log", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
                                            body: JSON.stringify({ project_id: selectedProjectId, text: dailyLogText, llm_configs: llmConfigs }),
                                        })
                                        const data = await res.json()
                                        if (data.success) {
                                            setDailyLogMsg(`✅ ${data.message}`)
                                            setDailyLogText("")
                                        } else {
                                            setDailyLogMsg(`❌ ${data.error || "解析失败"}`)
                                        }
                                    } catch (e) { setDailyLogMsg(`❌ 网络错误: ${e}`) }
                                    setDailyLogSaving(false)
                                    setTimeout(() => setDailyLogMsg(""), 6000)
                                }}
                            >
                                {dailyLogSaving ? "⏳ AI 正在解析情报中..." : "🧠 智能提炼入库"}
                            </Button>
                            {dailyLogMsg && (
                                <p className={cn("text-xs", dailyLogMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400")}>{dailyLogMsg}</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── 📸 现场情报多模态捕获 (统一上传区) ── */}
                <div className="space-y-3">
                    <h2 className="text-xl font-bold text-[hsl(var(--foreground))] tracking-wide">
                        📸 👂 现场情报多模态捕获
                    </h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        💡 实战玩法：上传竞品铭牌照片、招标文件、会议录音或现场视频，AI 自动提炼核心情报！
                    </p>

                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardContent className="pt-5 space-y-3">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                上传文件提取情报（支持图片 / 文档 / 音频 / 视频）：
                            </label>

                            {/* 统一上传区 */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={(e) => {
                                    e.preventDefault(); setDragActive(false)
                                    const f = e.dataTransfer.files?.[0]
                                    if (f) { setImageFile(f); setImageResult(""); setImageMsg("") }
                                }}
                                onClick={() => imageInputRef.current?.click()}
                                className={cn(
                                    "border-2 border-dashed rounded-xl p-8 md:p-10 text-center cursor-pointer transition-all duration-300",
                                    dragActive
                                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 scale-[1.01]"
                                        : "border-[hsl(var(--border))]/50 hover:border-[hsl(var(--primary))]/50 transition-colors"
                                )}
                            >
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf,.docx,.txt,.mp3,.wav,.m4a,.mp4,.mov,.webm,.ogg,.flac"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) { setImageFile(f); setImageResult(""); setImageMsg("") }
                                    }}
                                    className="hidden"
                                />
                                <div className="space-y-3">
                                    <div className="text-4xl">{dragActive ? "📥" : imageFile ? "📎" : "☁️"}</div>
                                    <p className="text-sm text-[hsl(var(--foreground))]">
                                        {imageFile ? `📎 ${imageFile.name} (${formatFileSize(imageFile.size)})` : "拖拽文件到此区域 或 点击选择"}
                                    </p>
                                    <div className="flex justify-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-[10px]">📷 JPG/PNG</Badge>
                                        <Badge variant="outline" className="text-[10px]">📄 PDF/DOCX/TXT</Badge>
                                        <Badge variant="outline" className="text-[10px]">🎵 MP3/WAV/M4A</Badge>
                                        <Badge variant="outline" className="text-[10px]">🎬 MP4/MOV</Badge>
                                    </div>
                                </div>
                            </div>

                            {/* 选中文件后显示启动按钮 */}
                            {imageFile && (
                                <Button
                                    variant="default"
                                    className="w-full"
                                    disabled={imageSaving}
                                    onClick={async () => {
                                        if (!hasAnyKey) { setImageMsg("❌ 请先配置 API Key"); return }
                                        setImageSaving(true); setImageMsg(""); setImageResult("")
                                        const ext = imageFile.name.split(".").pop()?.toLowerCase() || ""
                                        const imageExts = ["jpg", "jpeg", "png"]
                                        const docExts = ["pdf", "docx", "txt"]
                                        const mediaExts = ["mp3", "wav", "m4a", "mp4", "mov", "webm", "ogg", "flac"]

                                        try {
                                            if (imageExts.includes(ext)) {
                                                // 图片 → GPT-4o 视觉解析
                                                const formData = new FormData()
                                                formData.append("file", imageFile)
                                                formData.append("project_id", String(selectedProjectId))
                                                const res = await fetch("http://localhost:8000/api/intel/upload_image", {
                                                    method: "POST", headers: { "X-API-Key": apiKey }, body: formData,
                                                })
                                                const data = await res.json()
                                                if (data.success) {
                                                    setImageMsg(`✅ ${data.message}`)
                                                    setImageResult(data.parsed_intel)
                                                } else { setImageMsg(`❌ ${data.error}`) }
                                            } else if (docExts.includes(ext)) {
                                                // 文档 → 文本提取 + AI 解析
                                                const formData = new FormData()
                                                formData.append("file", imageFile)
                                                formData.append("project_id", String(selectedProjectId))
                                                const res = await fetch("http://localhost:8000/api/upload_and_analyze", {
                                                    method: "POST", headers: { "X-API-Key": apiKey }, body: formData,
                                                })
                                                const data = await res.json()
                                                if (data.success) {
                                                    setImageMsg(`✅ 文档解析成功！提取 ${data.extracted_text_length} 字符`)
                                                    setImageResult(JSON.stringify(data.intelligence, null, 2))
                                                } else { setImageMsg(`❌ ${data.error}`) }
                                            } else if (mediaExts.includes(ext)) {
                                                // 音频/视频 → Whisper 转录 + AI 解析
                                                const formData = new FormData()
                                                formData.append("file", imageFile)
                                                formData.append("project_id", String(selectedProjectId))
                                                const res = await fetch("http://localhost:8000/api/intel/upload_media", {
                                                    method: "POST", headers: { "X-API-Key": apiKey }, body: formData,
                                                })
                                                const data = await res.json()
                                                if (data.success) {
                                                    setImageMsg(`✅ ${data.message}`)
                                                    setImageResult(`【转录文本】\n${data.transcribed_text}\n\n【AI 情报分析】\n${JSON.stringify(data.intelligence, null, 2)}`)
                                                } else { setImageMsg(`❌ ${data.error}`) }
                                            } else {
                                                setImageMsg(`❌ 不支持的文件类型: .${ext}`)
                                            }
                                        } catch (e) { setImageMsg(`❌ 网络错误: ${e}`) }
                                        setImageSaving(false)
                                        setImageFile(null)
                                    }}
                                >
                                    {imageSaving ? "⏳ AI 解析中..." : "🚀 启动 AI 解析"}
                                </Button>
                            )}

                            {imageMsg && (
                                <p className={cn("text-xs", imageMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400")}>{imageMsg}</p>
                            )}
                            {imageResult && (
                                <div className="bg-[hsl(var(--background))]/50 rounded-md p-3 text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap max-h-60 overflow-y-auto">
                                    {imageResult}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Scanning Terminal ── */}
                {(phase === "uploading" || phase === "scanning") && (
                    <Card className="bg-[#0a0e14] border-[hsl(var(--border))]/30 overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-mono text-emerald-400 flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                    SRI_INTEL_SCANNER v2.0 — ACTIVE
                                </CardTitle>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5 mt-2" />
                        </CardHeader>
                        <CardContent>
                            <div
                                ref={terminalRef}
                                className="bg-[#060a0f] rounded-md p-4 font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto"
                            >
                                {scanLines.map((line, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "transition-opacity duration-500",
                                            line.startsWith("✅")
                                                ? "text-emerald-400 font-bold"
                                                : line.startsWith("⚠️")
                                                    ? "text-amber-400"
                                                    : "text-emerald-500/80"
                                        )}
                                    >
                                        <span className="text-[hsl(var(--muted-foreground))]/50 mr-2">
                                            [{String(i + 1).padStart(2, "0")}]
                                        </span>
                                        {line}
                                    </div>
                                ))}
                                {phase === "scanning" && scanLines.length < SCAN_LINES.length && (
                                    <span className="text-emerald-400 animate-pulse">▊</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Error State ── */}
                {phase === "error" && result && (
                    <Alert variant="destructive">
                        <AlertTitle>❌ 解析失败</AlertTitle>
                        <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                )}

                {/* ── Results ── */}
                {phase === "done" && result?.intelligence && (
                    <div className="space-y-6 animate-in fade-in-50 duration-700">
                        {/* Success Header */}
                        <Alert variant="success">
                            <AlertTitle>✅ 情报解析完毕</AlertTitle>
                            <AlertDescription>
                                文件 <strong>{result.filename}</strong> 已成功解析，
                                提取 {result.extracted_text_length?.toLocaleString()} 字符，
                                情报已写入作战数据库。
                            </AlertDescription>
                        </Alert>

                        {/* Current Status */}
                        <Card className="bg-[hsl(var(--card))] border-l-4 border-l-[hsl(var(--info))] border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-[hsl(var(--info))]">📋 项目现状</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">
                                    {result.intelligence.current_status || "未提取到"}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Decision Chain */}
                        {result.intelligence.decision_chain?.length > 0 && (
                            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm text-[hsl(var(--foreground))]">
                                        👥 关键决策链 ({result.intelligence.decision_chain.length} 人)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {result.intelligence.decision_chain.map((person, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(var(--background))]/50 border border-[hsl(var(--border))]/30"
                                            >
                                                <Avatar className="h-9 w-9 border-2 border-[hsl(var(--primary))]/30">
                                                    <AvatarFallback className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold">
                                                        {person.name?.[0] || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                                                            {person.name}
                                                        </span>
                                                        <Badge
                                                            variant={
                                                                person.attitude === "支持" ? "success" :
                                                                    person.attitude === "反对" ? "destructive" :
                                                                        "warning"
                                                            }
                                                            className="text-[10px]"
                                                        >
                                                            {person.attitude}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        {person.title} {person.phone && `· ${person.phone}`}
                                                    </p>
                                                    {person.soft_tags?.length > 0 && (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {person.soft_tags.map((tag, j) => (
                                                                <Badge key={j} variant="outline" className="text-[10px]">
                                                                    {tag}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Competitor Info */}
                        {result.intelligence.competitor_info?.length > 0 && (
                            <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm text-[hsl(var(--foreground))]">
                                        ⚔️ 竞品情报
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-[hsl(var(--border))]/30">
                                                    <th className="text-left py-2 px-3 text-[hsl(var(--muted-foreground))]">竞品</th>
                                                    <th className="text-left py-2 px-3 text-[hsl(var(--muted-foreground))]">报价</th>
                                                    <th className="text-left py-2 px-3 text-emerald-400">优势</th>
                                                    <th className="text-left py-2 px-3 text-red-400">劣势</th>
                                                    <th className="text-left py-2 px-3 text-[hsl(var(--muted-foreground))]">近期动作</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.intelligence.competitor_info.map((comp, i) => (
                                                    <tr key={i} className="border-b border-[hsl(var(--border))]/20">
                                                        <td className="py-2 px-3 text-[hsl(var(--foreground))] font-medium">{comp.name}</td>
                                                        <td className="py-2 px-3 text-amber-400">{comp.quote || "—"}</td>
                                                        <td className="py-2 px-3 text-emerald-400/80">{comp.strengths}</td>
                                                        <td className="py-2 px-3 text-red-400/80">{comp.weaknesses}</td>
                                                        <td className="py-2 px-3 text-[hsl(var(--muted-foreground))]">{comp.recent_actions}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Next Steps */}
                        <Card className="bg-[hsl(var(--card))] border-l-4 border-l-emerald-500 border-[hsl(var(--border))]/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-emerald-400">🎯 下一步行动</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">
                                    {result.intelligence.next_steps || "未提取到"}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Gap Alerts */}
                        {result.intelligence.gap_alerts?.length > 0 && (
                            <Card className="bg-[hsl(var(--card))] border-l-4 border-l-amber-500 border-[hsl(var(--border))]/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-amber-400">⚠️ 情报盲点告警</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {result.intelligence.gap_alerts.map((alert, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20"
                                            >
                                                <span className="text-amber-400 text-sm mt-0.5">⚡</span>
                                                <span className="text-sm text-amber-400/90">{alert}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Separator className="bg-[hsl(var(--border))]/30" />

                        {/* Reset Button */}
                        <div className="text-center">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setPhase("idle")
                                    setResult(null)
                                    setProgress(0)
                                    setScanLines([])
                                }}
                                className="border-[hsl(var(--border))]/50"
                            >
                                🔄 解析下一份情报
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
