/**
 * SandboxPage.tsx — 作战沙盘 (深度还原版)
 * ==========================================
 * 核心页面层级:
 *  0. 指挥官身份栏
 *  1. 全局沙盘控制台 (God Mode — 战区/人员/项目三级选择)
 *  2. 生态铁三角 (Ecosystem Board — 由选中项目驱动)
 *  3. AI 统帅部 + 权力地图 (PowerMapTable — 可编辑)
 *  4. 多模态情报雷达舱 (Intel Radar)
 *  5. MEDDIC 赢率引擎 (MeddicPanel)
 *  6. 智能火力支援舱 (FireSupport)
 */

import { useState } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import type { ProjectDTO } from "@/lib/apiClient"
import { generateNBA, type AIResponse } from "@/lib/apiClient"
import { GodModeSelector } from "@/components/sandbox/GodModeSelector"
import { EcosystemBoard } from "@/components/sandbox/EcosystemBoard"
import { PowerMapTable } from "@/components/sandbox/PowerMapTable"
import { IntelRadar } from "@/components/sandbox/IntelRadar"
import { IntelTimeline } from "@/components/sandbox/IntelTimeline"
import { MeddicPanel } from "@/components/sandbox/MeddicPanel"
import { FireSupport } from "@/components/sandbox/FireSupport"
import { AIAdvisor } from "@/components/sandbox/AIAdvisor"
import {
    Shield,
    Radio,
    BarChart3,
    Copy,
    Check,
    Loader2,
} from "lucide-react"

export function SandboxPage() {
    const user = useAuthStore((s) => s.user)

    // 核心状态：选中的项目
    const [selectedProject, setSelectedProject] = useState<ProjectDTO | null>(
        null,
    )

    // NBA 报告状态
    const [nbaResult, setNbaResult] = useState("")
    const [nbaLoading, setNbaLoading] = useState(false)
    const [nbaCopied, setNbaCopied] = useState(false)

    const roleEmoji =
        user?.role === "vp"
            ? "👑"
            : user?.role === "director"
                ? "🛡️"
                : user?.role === "admin"
                    ? "⚙️"
                    : "⚔️"

    const roleName =
        user?.role === "vp"
            ? "VP 全局统帅"
            : user?.role === "director"
                ? "战区总监"
                : user?.role === "admin"
                    ? "系统管理员"
                    : user?.role === "tech"
                        ? "技术专家"
                        : user?.role === "finance"
                            ? "财务主管"
                            : "前线销售"

    // 从选中项目构建生态数据
    const ecosystemData = selectedProject
        ? {
            client: selectedProject.client || "",
            clientContact: "",
            clientNotes: `阶段: ${selectedProject.stage} | 赢率: ${selectedProject.win_rate}%`,
            designInstitute: selectedProject.design_institute || "",
            designContact: "",
            designNotes: "",
            generalContractor: selectedProject.general_contractor || "",
            gcContact: "",
            gcNotes: `预算: ${selectedProject.budget_status} | 竞争: ${selectedProject.competitive_position}`,
        }
        : null

    // NBA 报告生成
    const handleGenerateNBA = async () => {
        if (!selectedProject) return
        setNbaLoading(true)
        setNbaResult("")
        try {
            const res: AIResponse = await generateNBA(selectedProject.id)
            setNbaResult(res.result || res.error || "无返回")
        } catch (err: unknown) {
            const msg = (err as { message?: string })?.message || "生成失败"
            setNbaResult(`❌ ${msg}`)
        } finally {
            setNbaLoading(false)
        }
    }

    const handleCopyNBA = async () => {
        await navigator.clipboard.writeText(nbaResult)
        setNbaCopied(true)
        setTimeout(() => setNbaCopied(false), 2000)
    }

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-8">
            {/* ═══ 指挥官身份栏 ═══ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20 flex items-center justify-center text-2xl">
                        {roleEmoji}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-white/90">作战沙盘</h1>
                            <div className="px-2 py-0.5 rounded-full bg-[hsl(var(--primary))]/10 text-[10px] font-medium text-[hsl(var(--primary))]">
                                LIVE
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                            <span className="flex items-center gap-1">
                                <Shield size={10} />
                                当前指挥官:{" "}
                                <strong className="text-white/60">
                                    {user?.name || "未登录"}
                                </strong>
                            </span>
                            <span className="text-white/15">|</span>
                            <span>{roleName}</span>
                            <span className="text-white/15">|</span>
                            <span className="flex items-center gap-1">
                                <Radio size={10} />
                                战区:{" "}
                                <strong className="text-white/60">
                                    {user?.dept || "N/A"}
                                </strong>
                            </span>
                        </div>
                    </div>
                </div>

                {/* 状态指示 */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] text-green-400 font-medium">
                            后端在线
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
                        <span className="text-[10px] text-[hsl(var(--primary))] font-medium">
                            AI 网关就绪
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══ 分割线 ═══ */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* ═══ 1. 全局沙盘控制台 — God Mode ═══ */}
            <GodModeSelector
                selectedProject={selectedProject}
                onProjectSelect={(p) => {
                    setSelectedProject(p)
                    setNbaResult("")
                }}
            />

            {/* ═══ 以下所有面板要求选中项目 ═══ */}
            {selectedProject ? (
                <>
                    {/* ═══ 分割线 ═══ */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* ═══ 2. 生态铁三角 ═══ */}
                    {ecosystemData && <EcosystemBoard data={ecosystemData} />}

                    {/* ═══ 分割线 ═══ */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* ═══ 3. AI 统帅部 + 权力地图 ═══ */}
                    <div className="space-y-6">
                        {/* NBA 生成按钮 */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">📊</span>
                            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                                AI 统帅部 · 赢率诊断
                            </h3>
                            <div className="flex-1 h-px bg-white/5" />
                        </div>

                        <button
                            onClick={handleGenerateNBA}
                            disabled={nbaLoading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-red-500/20"
                        >
                            {nbaLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    AI 统帅推演中...
                                </>
                            ) : (
                                <>
                                    <BarChart3 size={16} />
                                    📊 一键生成【赢率诊断与下一步最佳行动 (NBA)】报告
                                </>
                            )}
                        </button>

                        {/* NBA 结果 */}
                        {nbaResult && (
                            <div className="rounded-xl bg-gradient-to-br from-red-500/5 to-orange-500/5 border border-red-500/15 p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-xs font-bold text-red-400/80">
                                        📊 赢率诊断 & NBA 报告
                                    </div>
                                    <button
                                        onClick={handleCopyNBA}
                                        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-white/5"
                                    >
                                        {nbaCopied ? (
                                            <>
                                                <Check size={10} /> 已复制
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={10} /> 一键复制
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                                    {nbaResult}
                                </div>
                            </div>
                        )}

                        {/* 权力地图表格 */}
                        <PowerMapTable projectId={selectedProject.id} />
                    </div>

                    {/* ═══ 分割线 ═══ */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* ═══ 4. 多模态情报雷达舱 ═══ */}
                    <IntelRadar />

                    {/* ═══ 分割线 ═══ */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* ═══ 4.5 战役情报时间轴 ═══ */}
                    <IntelTimeline projectId={selectedProject.id} />

                    {/* ═══ 分割线 ═══ */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* ═══ 5. MEDDIC 赢率引擎 ═══ */}
                    <MeddicPanel projectId={selectedProject.id} />

                    {/* ═══ 分割线 ═══ */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* ═══ 6. 智能火力支援舱 ═══ */}
                    <FireSupport projectId={selectedProject.id} />

                    {/* ═══ 分割线 ═══ */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* ═══ 7. AI 参谋部 ═══ */}
                    <AIAdvisor projectId={selectedProject.id} />
                </>
            ) : (
                /* ═══ 未选中项目：全屏占位提示 ═══ */
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/15 flex items-center justify-center text-5xl animate-pulse">
                        🎯
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-white/60">
                            请在上方选择作战项目以展开沙盘
                        </h2>
                        <p className="text-sm text-white/30 max-w-md mx-auto leading-relaxed">
                            选择一个项目后，将解锁以下战术模块：
                            <span className="text-amber-400/60">生态铁三角</span> ·
                            <span className="text-red-400/60">权力地图</span> ·
                            <span className="text-blue-400/60">情报雷达</span> ·
                            <span className="text-green-400/60">MEDDIC 赢率引擎</span> ·
                            <span className="text-purple-400/60">火力支援舱</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-xs text-white/20">
                        <Shield size={12} />
                        <span>所有数据基于您的角色权限实时渲染</span>
                    </div>
                </div>
            )}
        </div>
    )
}
