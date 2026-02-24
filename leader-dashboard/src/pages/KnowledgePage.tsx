/**
 * KnowledgePage.tsx — 📚 中央武器库：知识弹药库与 AI 军师大脑
 * ===========================================================
 * Streamlit app.py L1922-1975 还原 + RAG 升级:
 *   顶部 — 全局语义检索舱 (带深度语义 Toggle)
 *   左栏 — 弹药分类导航 (Category Sidebar)
 *   右栏 — 弹药矩阵 Grid + 上传按钮
 */
import { useState, useMemo } from "react"
import {
    Search, Brain, Upload, FileText, Swords, Trophy,
    MessageSquare, FolderOpen, Sparkles, Clock, Tag,
    Eye, Loader2, X, ToggleLeft, ToggleRight, BookOpen,
} from "lucide-react"
import toast from "react-hot-toast"

/* ── Categories ── */
const CATEGORIES = [
    { id: "all", label: "全部弹药", icon: <FolderOpen size={14} />, emoji: "📂" },
    { id: "whitepaper", label: "产品白皮书", icon: <FileText size={14} />, emoji: "📄" },
    { id: "competitor", label: "竞品分析报告", icon: <Swords size={14} />, emoji: "⚔️" },
    { id: "casestudy", label: "历史赢单复盘", icon: <Trophy size={14} />, emoji: "🏆" },
    { id: "script", label: "黄金话术模板", icon: <MessageSquare size={14} />, emoji: "💬" },
    { id: "media", label: "多模态实况资产", icon: <Eye size={14} />, emoji: "🎬" },
    { id: "external", label: "外部智能链接", icon: <BookOpen size={14} />, emoji: "🔗" },
]

/* ── Demo knowledge items ── */
interface KnowledgeItem {
    id: number
    title: string
    category: string
    tags: string[]
    uploadedAt: string
    excerpt: string
    fileType: string
}

const DEMO_ITEMS: KnowledgeItem[] = [
    { id: 1, title: "万华防腐涂料规格 v3.2", category: "whitepaper", tags: ["选型", "防腐"], uploadedAt: "2026-02-15", excerpt: "采用纳米陶瓷基底层+氟碳面漆双重防护体系，耐盐雾试验超4000小时...", fileType: "PDF" },
    { id: 2, title: "2026竞品打法手册（西门子专项）", category: "competitor", tags: ["西门子", "差异化"], uploadedAt: "2026-02-10", excerpt: "西门子8DJH系列在SF6方面的环保弱点可重点突破，其交付周期普遍在16-20周...", fileType: "DOCX" },
    { id: 3, title: "镇海炼化吊装实录", category: "media", tags: ["案例", "视频"], uploadedAt: "2026-01-28", excerpt: "完整记录72小时连续吊装过程，含现场温度、湿度监测数据与安全检查节点...", fileType: "MP4" },
    { id: 4, title: "王总工破冰答疑实录", category: "media", tags: ["话术", "音频"], uploadedAt: "2026-01-15", excerpt: "深度解答客户关于抗短路能力的技术疑虑，成功扭转客户对国产品牌的偏见...", fileType: "MP3" },
    { id: 5, title: "宁德时代项目赢单复盘", category: "casestudy", tags: ["新能源", "赢单"], uploadedAt: "2026-02-01", excerpt: "通过提前锁定安环经理痛点+VP关系突破，在西门子报价低15%的情况下逆转...", fileType: "PDF" },
    { id: 6, title: "客户拜访破冰话术 Top 20", category: "script", tags: ["破冰", "首次拜访"], uploadedAt: "2026-02-08", excerpt: "针对不同角色(技术/采购/管理层)的开场白模板，含7个高转化率案例...", fileType: "DOCX" },
    { id: 7, title: "NotebookLM: 行业合规标准库", category: "external", tags: ["合规", "标准"], uploadedAt: "2026-02-12", excerpt: "IEC 62271、GB/T 11022 等核心标准的 AI 整理版本，可直接引用答疑...", fileType: "LINK" },
    { id: 8, title: "TCO降本计算器白皮书", category: "whitepaper", tags: ["TCO", "财务"], uploadedAt: "2026-02-05", excerpt: "基于20年全生命周期的TCO对比模型，量化展示我方方案节省15-20%...", fileType: "PDF" },
    { id: 9, title: "处理客户压价的12种策略", category: "script", tags: ["议价", "采购"], uploadedAt: "2026-01-20", excerpt: "从价值锚定到竞品差异化，系统化应对采购总监强硬压价的完整话术体系...", fileType: "PDF" },
    { id: 10, title: "ABB vs 我方核心参数对比", category: "competitor", tags: ["ABB", "参数对比"], uploadedAt: "2026-02-18", excerpt: "从散热效率、IP防护等级、盐雾试验到智能运维对比，17个维度全面碾压...", fileType: "XLSX" },
    { id: 11, title: "国网入围型式试验报告", category: "whitepaper", tags: ["认证", "国网"], uploadedAt: "2025-12-20", excerpt: "经中国电科院认证的完整型式试验报告，含内部燃弧、温升、分断等全部项目...", fileType: "PDF" },
    { id: 12, title: "化工行业丢单教训总结", category: "casestudy", tags: ["化工", "丢单"], uploadedAt: "2026-01-05", excerpt: "因忽略安环经理的消防联锁需求导致丢单，复盘关键失误节点与改进策略...", fileType: "DOCX" },
]

/* ── File type badges ── */
const FILE_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
    PDF: { bg: "bg-red-500/15", text: "text-red-400" },
    DOCX: { bg: "bg-blue-500/15", text: "text-blue-400" },
    XLSX: { bg: "bg-green-500/15", text: "text-green-400" },
    MP4: { bg: "bg-purple-500/15", text: "text-purple-400" },
    MP3: { bg: "bg-amber-500/15", text: "text-amber-400" },
    LINK: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
}

export function KnowledgePage() {
    const [activeCategory, setActiveCategory] = useState("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [semanticMode, setSemanticMode] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [showUploadPanel, setShowUploadPanel] = useState(false)

    // Upload state
    const [uploadFiles, setUploadFiles] = useState<File[]>([])
    const [uploadCategory, setUploadCategory] = useState("whitepaper")
    const [externalUrl, setExternalUrl] = useState("")

    /* ── Filtered items ── */
    const filteredItems = useMemo(() => {
        let items = DEMO_ITEMS
        if (activeCategory !== "all") {
            items = items.filter((i) => i.category === activeCategory)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            items = items.filter((i) =>
                i.title.toLowerCase().includes(q) ||
                i.tags.some((t) => t.toLowerCase().includes(q)) ||
                (semanticMode && i.excerpt.toLowerCase().includes(q))
            )
        }
        return items
    }, [activeCategory, searchQuery, semanticMode])

    /* ── Upload handler (simulated) ── */
    const handleUpload = async () => {
        if (!uploadFiles.length && !externalUrl) {
            toast.error("弹药舱为空，请先上传文件或输入链接！")
            return
        }
        setUploading(true)
        await new Promise((r) => setTimeout(r, 1500))
        setUploading(false)
        setShowUploadPanel(false)
        setUploadFiles([])
        setExternalUrl("")
        toast.success("✅ 弹药已传输至私有向量库！AI 检索中枢已就绪。")
    }

    const categoryCount = (catId: string) =>
        catId === "all" ? DEMO_ITEMS.length : DEMO_ITEMS.filter((i) => i.category === catId).length

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-5">
            {/* ═══ Header ═══ */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">📚</div>
                <div>
                    <h1 className="text-xl font-bold text-white/90">中央武器库：知识弹药库</h1>
                    <p className="text-xs text-white/40 mt-0.5">多模态知识资产管理 · RAG 语义检索 · 一键向量化 · 支撑前线实战</p>
                </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* ═══ 1. Global Semantic Search ═══ */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-500/[0.03] to-teal-500/[0.02] p-4">
                <div className="flex items-center gap-3">
                    {/* Search input */}
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索弹药库：输入关键词、标签或内容片段..."
                            className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-emerald-500/30 transition" />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {/* Semantic toggle */}
                    <button onClick={() => { setSemanticMode(!semanticMode); toast(semanticMode ? "已切回关键词检索" : "🧠 已开启深度语义检索！将搜索段落内容") }}
                        className={`shrink-0 px-4 py-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${semanticMode
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                : "bg-white/[0.03] border-white/10 text-white/30 hover:border-white/20"
                            }`}>
                        {semanticMode ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        <Brain size={14} />
                        <span className="hidden sm:inline">{semanticMode ? "语义检索 ON" : "语义检索 OFF"}</span>
                    </button>
                </div>
                {semanticMode && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400/50">
                        <Sparkles size={10} /> 深度语义检索已启用：不仅搜标题与标签，更搜索段落内容中的语义匹配
                    </div>
                )}
            </div>

            {/* ═══ 2. Main: Category Sidebar + Arsenal Grid ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ══ LEFT: Category Sidebar (3/12) ══ */}
                <div className="lg:col-span-3 space-y-1.5">
                    <div className="text-[10px] text-white/20 font-bold mb-2 px-2">弹药分类导航</div>
                    {CATEGORIES.map((cat) => {
                        const isActive = activeCategory === cat.id
                        const count = categoryCount(cat.id)
                        return (
                            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition-all ${isActive
                                        ? "bg-emerald-500/10 border border-emerald-500/20 text-white/80"
                                        : "border border-transparent text-white/30 hover:bg-white/[0.03] hover:text-white/50"
                                    }`}>
                                <span className={isActive ? "text-emerald-400" : "text-white/20"}>{cat.icon}</span>
                                <span className="text-xs flex-1">{cat.emoji} {cat.label}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/15"
                                    }`}>{count}</span>
                            </button>
                        )
                    })}

                    {/* Upload button in sidebar */}
                    <div className="pt-3 mt-3 border-t border-white/5">
                        <button onClick={() => setShowUploadPanel(!showUploadPanel)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition-all">
                            <Upload size={12} /> 📤 补充弹药
                        </button>
                    </div>
                </div>

                {/* ══ RIGHT: Arsenal Grid (9/12) ══ */}
                <div className="lg:col-span-9 space-y-4">

                    {/* Upload panel (collapsible) */}
                    {showUploadPanel && (
                        <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.02] p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white/70 flex items-center gap-1.5">
                                    <Upload size={14} className="text-red-400" /> 🔥 弹药装填 (上传并自动向量化)
                                </h3>
                                <button onClick={() => setShowUploadPanel(false)} className="text-white/20 hover:text-white/40 transition"><X size={14} /></button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* File upload */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-white/30">📎 本地多模态资产 (PDF/Word/PPT/MP4/MP3)</label>
                                    <div className="relative">
                                        <input type="file" accept=".pdf,.docx,.pptx,.ppt,.mp4,.mp3,.txt" multiple
                                            onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                        <div className={`px-4 py-3 rounded-xl border border-dashed transition flex items-center gap-2 ${uploadFiles.length > 0 ? "border-red-500/30 bg-red-500/[0.05]" : "border-white/10 bg-white/[0.02]"
                                            }`}>
                                            <Upload size={14} className={uploadFiles.length > 0 ? "text-red-400" : "text-white/15"} />
                                            <span className="text-xs text-white/30">
                                                {uploadFiles.length > 0 ? `已选 ${uploadFiles.length} 个文件` : "点击选择文件..."}
                                            </span>
                                        </div>
                                    </div>
                                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white/50 appearance-none cursor-pointer focus:outline-none">
                                        {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                                            <option key={c.id} value={c.id} className="bg-[hsl(222,47%,9%)]">{c.emoji} {c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* External link */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-white/30">🔗 外部智能知识源 (NotebookLM / Wiki)</label>
                                    <input type="text" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)}
                                        placeholder="https://notebooklm.google.com/..."
                                        className="w-full px-3 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 placeholder:text-white/15 focus:outline-none focus:border-red-500/20 transition" />
                                    <p className="text-[9px] text-white/10 leading-relaxed">⚠️ 弹药质检：请优先上传原生 PDF 型式试验报告。含燃弧/抗短路测试的 MP4 请配合 .txt 说明文件上传。</p>
                                </div>
                            </div>

                            <button onClick={handleUpload} disabled={uploading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-40 transition-all">
                                {uploading
                                    ? <><Loader2 size={12} className="animate-spin" /> 正在向量化并传输至私有知识库...</>
                                    : <><Sparkles size={12} /> 🚀 一键向量化并传输至私有武器库</>}
                            </button>
                        </div>
                    )}

                    {/* Grid header */}
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-white/30">
                            {searchQuery
                                ? <span>搜索 "{searchQuery}" — 找到 <b className="text-white/50">{filteredItems.length}</b> 条</span>
                                : <span>{CATEGORIES.find((c) => c.id === activeCategory)?.emoji} {CATEGORIES.find((c) => c.id === activeCategory)?.label} — <b className="text-white/50">{filteredItems.length}</b> 条弹药</span>}
                        </div>
                    </div>

                    {/* Knowledge cards grid */}
                    {filteredItems.length === 0 ? (
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center space-y-2">
                            <FolderOpen size={32} className="text-white/10 mx-auto" />
                            <p className="text-sm text-white/15">该分类暂无弹药</p>
                            <p className="text-[10px] text-white/8">点击左侧"📤 补充弹药"上传新资料</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredItems.map((item) => {
                                const ft = FILE_TYPE_STYLES[item.fileType] || FILE_TYPE_STYLES.PDF
                                const catMeta = CATEGORIES.find((c) => c.id === item.category)
                                return (
                                    <div key={item.id}
                                        className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2.5 hover:border-emerald-500/15 hover:bg-emerald-500/[0.02] transition-all group cursor-pointer">
                                        {/* Top: file type + category */}
                                        <div className="flex items-center justify-between">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ft.bg} ${ft.text}`}>{item.fileType}</span>
                                            <span className="text-[9px] text-white/15">{catMeta?.emoji}</span>
                                        </div>
                                        {/* Title */}
                                        <h4 className="text-xs font-bold text-white/60 group-hover:text-white/80 transition leading-snug line-clamp-2">{item.title}</h4>
                                        {/* Excerpt */}
                                        <p className="text-[10px] text-white/20 leading-relaxed line-clamp-2">{item.excerpt}</p>
                                        {/* Tags */}
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {item.tags.map((tag) => (
                                                <span key={tag} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-white/20 flex items-center gap-0.5">
                                                    <Tag size={7} />{tag}
                                                </span>
                                            ))}
                                        </div>
                                        {/* Bottom: date + action */}
                                        <div className="flex items-center justify-between pt-1 border-t border-white/[0.03]">
                                            <span className="text-[9px] text-white/10 flex items-center gap-1"><Clock size={8} />{item.uploadedAt}</span>
                                            <span className="text-[9px] text-emerald-400/0 group-hover:text-emerald-400/50 flex items-center gap-0.5 transition">
                                                <Sparkles size={8} />摘要提取
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
