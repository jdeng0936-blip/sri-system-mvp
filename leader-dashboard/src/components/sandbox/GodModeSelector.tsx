/**
 * GodModeSelector.tsx — 全局沙盘控制台 (God Mode)
 * ================================================
 * 三级级联筛选：
 *   维度一：战区筛选 (dept)
 *   维度二：人员筛选 (owner)
 *   核心  ：作战项目选择器 (从 /api/projects 实时加载)
 *
 * 选中项目后向父组件传递 selectedProject
 */

import { useState, useEffect, useMemo } from "react"
import { fetchProjects, type ProjectDTO } from "@/lib/apiClient"
import { useAuthStore } from "@/store/useAuthStore"
import {
    ChevronDown,
    Crosshair,
    Target,
    Loader2,
    RefreshCcw,
    MapPin,
    User,
    AlertTriangle,
} from "lucide-react"

interface Props {
    onProjectSelect: (project: ProjectDTO | null) => void
    selectedProject: ProjectDTO | null
}

export function GodModeSelector({ onProjectSelect, selectedProject }: Props) {
    const user = useAuthStore((s) => s.user)

    // 数据
    const [projects, setProjects] = useState<ProjectDTO[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // 筛选
    const [deptFilter, setDeptFilter] = useState<string>("__ALL__")
    const [ownerFilter, setOwnerFilter] = useState<string>("__ALL__")

    // 加载项目列表
    const loadProjects = async () => {
        setLoading(true)
        setError("")
        try {
            const data = await fetchProjects()
            setProjects(data)
        } catch {
            setError("项目列表加载失败")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadProjects()
    }, [])

    // 可用战区列表
    const deptList = useMemo(() => {
        const depts = new Set(projects.map((p) => p.dept).filter(Boolean))
        return Array.from(depts) as string[]
    }, [projects])

    // 按战区过滤后的项目
    const deptFiltered = useMemo(() => {
        if (deptFilter === "__ALL__") return projects
        return projects.filter((p) => p.dept === deptFilter)
    }, [projects, deptFilter])

    // 可用人员列表
    const ownerList = useMemo(() => {
        const owners = new Set(
            deptFiltered.map((p) => p.applicant_name).filter(Boolean),
        )
        return Array.from(owners) as string[]
    }, [deptFiltered])

    // 按人员过滤后的最终项目列表
    const filteredProjects = useMemo(() => {
        if (ownerFilter === "__ALL__") return deptFiltered
        return deptFiltered.filter((p) => p.applicant_name === ownerFilter)
    }, [deptFiltered, ownerFilter])

    // 阶段颜色
    const stageColor = (stage: string) => {
        if (stage.includes("签约") || stage.includes("逼单"))
            return "text-green-400"
        if (stage.includes("谈判")) return "text-yellow-400"
        if (stage.includes("接触")) return "text-blue-400"
        if (stage.includes("丢单")) return "text-red-400"
        return "text-white/50"
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🎛️</span>
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                    全局沙盘控制台 · God Mode
                </h3>
                <div className="flex-1 h-px bg-white/5" />
                <button
                    onClick={loadProjects}
                    disabled={loading}
                    className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition"
                >
                    <RefreshCcw size={10} className={loading ? "animate-spin" : ""} />
                    刷新
                </button>
            </div>

            {error && (
                <div className="mb-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 维度一：战区 */}
                <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-medium text-white/40 mb-1.5 uppercase tracking-wider">
                        <MapPin size={10} />
                        维度一：按战区筛选
                    </label>
                    <div className="relative">
                        <select
                            value={deptFilter}
                            onChange={(e) => {
                                setDeptFilter(e.target.value)
                                setOwnerFilter("__ALL__")
                                onProjectSelect(null)
                            }}
                            className="w-full appearance-none px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 cursor-pointer"
                        >
                            <option value="__ALL__" className="bg-[hsl(222,47%,9%)]">
                                全部战区 ({projects.length})
                            </option>
                            {deptList.map((d) => (
                                <option key={d} value={d} className="bg-[hsl(222,47%,9%)]">
                                    {d}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={12}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
                        />
                    </div>
                </div>

                {/* 维度二：人员 */}
                <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-medium text-white/40 mb-1.5 uppercase tracking-wider">
                        <User size={10} />
                        维度二：按人员筛选
                    </label>
                    <div className="relative">
                        <select
                            value={ownerFilter}
                            onChange={(e) => {
                                setOwnerFilter(e.target.value)
                                onProjectSelect(null)
                            }}
                            className="w-full appearance-none px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 cursor-pointer"
                        >
                            <option value="__ALL__" className="bg-[hsl(222,47%,9%)]">
                                全部人员 ({deptFiltered.length})
                            </option>
                            {ownerList.map((o) => (
                                <option key={o} value={o} className="bg-[hsl(222,47%,9%)]">
                                    {o}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={12}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
                        />
                    </div>
                </div>

                {/* 核心：项目选择器 */}
                <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400/60 mb-1.5 uppercase tracking-wider">
                        <Target size={10} />
                        🎯 作战项目选择
                    </label>
                    <div className="relative">
                        <select
                            value={selectedProject?.id ?? ""}
                            onChange={(e) => {
                                const id = Number(e.target.value)
                                const project = filteredProjects.find((p) => p.id === id)
                                onProjectSelect(project || null)
                            }}
                            className="w-full appearance-none px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm text-amber-200/80 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                        >
                            <option value="" className="bg-[hsl(222,47%,9%)]">
                                {loading
                                    ? "加载中..."
                                    : filteredProjects.length === 0
                                        ? "暂无项目数据"
                                        : `选择项目 (${filteredProjects.length})`}
                            </option>
                            {filteredProjects.map((p) => (
                                <option
                                    key={p.id}
                                    value={p.id}
                                    className="bg-[hsl(222,47%,9%)]"
                                >
                                    [{p.stage}] {p.client} — {p.project_title || p.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={12}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400/40 pointer-events-none"
                        />
                    </div>
                </div>
            </div>

            {/* 选中项目后的概要卡片 */}
            {selectedProject && (
                <div className="mt-4 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/15 px-5 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Crosshair size={16} className="text-amber-400" />
                            <div>
                                <div className="text-sm font-bold text-white/80">
                                    {selectedProject.client}
                                    {selectedProject.project_title && (
                                        <span className="text-white/40 ml-2 font-normal">
                                            — {selectedProject.project_title}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                                    <span className={stageColor(selectedProject.stage)}>
                                        {selectedProject.stage}
                                    </span>
                                    <span>|</span>
                                    <span>赢率: {selectedProject.win_rate}%</span>
                                    <span>|</span>
                                    <span>金额: ¥{(selectedProject.estimated_amount / 10000).toFixed(1)}万</span>
                                    <span>|</span>
                                    <span>{selectedProject.dept} · {selectedProject.applicant_name}</span>
                                </div>
                            </div>
                        </div>
                        <div
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${selectedProject.approval_status === "approved"
                                    ? "bg-green-500/15 text-green-400"
                                    : selectedProject.approval_status === "conflict"
                                        ? "bg-red-500/15 text-red-400"
                                        : "bg-yellow-500/15 text-yellow-400"
                                }`}
                        >
                            {selectedProject.approval_status === "approved"
                                ? "✓ 已批复"
                                : selectedProject.approval_status === "conflict"
                                    ? "⚠ 撞单"
                                    : "⏳ 待审"}
                        </div>
                    </div>
                </div>
            )}

            {!selectedProject && projects.length > 0 && (
                <div className="mt-4 text-center text-xs text-white/20 py-3 border border-dashed border-white/5 rounded-lg">
                    <Crosshair size={14} className="inline-block mr-1 opacity-30" />
                    请先选择一个作战项目 → 解锁下方权力地图 / MEDDIC / 火力支援
                </div>
            )}
        </div>
    )
}
