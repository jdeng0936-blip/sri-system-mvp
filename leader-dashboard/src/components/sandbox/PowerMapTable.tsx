/**
 * PowerMapTable.tsx — 可编辑权力地图表格
 * =========================================
 * 表头: 姓名 / 职位 / 角色定位 / 态度 / 权重 / 上级汇报线
 * 支持新增行、行内编辑、批量保存 /api/projects/{id}/stakeholders/batch
 */

import { useState, useEffect, useCallback } from "react"
import {
    fetchStakeholders,
    saveStakeholders,
    extractStakeholders,
    generatePowerMap,
    type StakeholderRow,
} from "@/lib/apiClient"
import {
    Plus,
    Trash2,
    Save,
    Loader2,
    AlertTriangle,
    Check,
    Users,
    Brain,
    GitFork,
} from "lucide-react"

const ROLE_OPTIONS = [
    "决策者",
    "评估者/技术审查",
    "使用者/操作层",
    "影响者/顾问",
    "内线/教练",
    "把关者/采购",
]

const ATTITUDE_OPTIONS = [
    "强力支持",
    "支持",
    "中立",
    "反对",
    "强烈反对",
    "未知",
]

const EMPTY_ROW: StakeholderRow = {
    name: "",
    title: "",
    role: "评估者/技术审查",
    attitude: "中立",
    influence: 5,
    reports_to: "",
}

const attitudeColor = (att: string) => {
    if (att.includes("强力支持")) return "bg-green-500/15 text-green-400 border-green-500/20"
    if (att.includes("支持")) return "bg-green-500/10 text-green-300 border-green-500/15"
    if (att.includes("中立")) return "bg-yellow-500/10 text-yellow-300 border-yellow-500/15"
    if (att.includes("强烈反对")) return "bg-red-600/15 text-red-400 border-red-500/20"
    if (att.includes("反对")) return "bg-red-500/10 text-red-300 border-red-500/15"
    return "bg-white/5 text-white/40 border-white/10"
}

interface Props {
    projectId: number
}

export function PowerMapTable({ projectId }: Props) {
    const [rows, setRows] = useState<StakeholderRow[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState("")
    const [dirty, setDirty] = useState(false)

    // AI 功能
    const [extracting, setExtracting] = useState(false)
    const [graphLoading, setGraphLoading] = useState(false)
    const [graphResult, setGraphResult] = useState("")

    const handleExtractAI = async () => {
        setExtracting(true)
        setError("")
        try {
            const res = await extractStakeholders(projectId)
            if (res.result) {
                // 尝试解析 JSON 结果并添加到表格
                try {
                    const parsed = JSON.parse(res.result)
                    const newPeople: StakeholderRow[] = (Array.isArray(parsed) ? parsed : parsed.decision_chain || []).map(
                        (p: { name?: string; title?: string; attitude?: string; role?: string }) => ({
                            name: p.name || "",
                            title: p.title || "",
                            role: p.role || "评估者/技术审查",
                            attitude: p.attitude || "中立",
                            influence: 5,
                            reports_to: "",
                        }),
                    )
                    if (newPeople.length > 0) {
                        setRows((prev) => [...prev.filter((r) => r.name.trim()), ...newPeople])
                        setDirty(true)
                    }
                } catch {
                    setError("AI 返回无法解析: " + res.result.slice(0, 100))
                }
            } else {
                setError(res.error || "AI 提取无结果")
            }
        } catch {
            setError("AI 提取人物失败")
        } finally {
            setExtracting(false)
        }
    }

    const handleGraphAI = async () => {
        setGraphLoading(true)
        setGraphResult("")
        try {
            const res = await generatePowerMap(projectId)
            setGraphResult(res.result || res.error || "无返回")
        } catch {
            setGraphResult("❌ 关系图生成失败")
        } finally {
            setGraphLoading(false)
        }
    }

    // 加载数据
    const loadData = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const data = await fetchStakeholders(projectId)
            setRows(data.length > 0 ? data : [{ ...EMPTY_ROW }])
            setDirty(false)
        } catch {
            setError("权力地图数据加载失败")
            setRows([{ ...EMPTY_ROW }])
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        loadData()
    }, [loadData])

    // 更新单元格
    const updateCell = (
        idx: number,
        field: keyof StakeholderRow,
        value: string | number,
    ) => {
        setRows((prev) =>
            prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
        )
        setDirty(true)
        setSaved(false)
    }

    const addRow = () => {
        setRows((prev) => [...prev, { ...EMPTY_ROW }])
        setDirty(true)
        setSaved(false)
    }

    const removeRow = (idx: number) => {
        setRows((prev) => prev.filter((_, i) => i !== idx))
        setDirty(true)
        setSaved(false)
    }

    // 批量保存
    const handleSave = async () => {
        // 过滤空行
        const valid = rows.filter((r) => r.name.trim())
        if (valid.length === 0) {
            setError("至少填写一个关键人姓名")
            return
        }
        setSaving(true)
        setError("")
        try {
            const result = await saveStakeholders(projectId, valid)
            if (result.error) {
                setError(result.error)
            } else {
                setSaved(true)
                setDirty(false)
                setTimeout(() => setSaved(false), 3000)
            }
        } catch {
            setError("保存失败，请重试")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-base">👥</span>
                    <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                        权力地图 · Power Map
                    </h3>
                    <span className="text-[10px] text-white/20 ml-2">
                        项目 #{projectId}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {dirty && (
                        <span className="text-[10px] text-amber-400/60 animate-pulse">
                            ● 未保存
                        </span>
                    )}
                    <button
                        onClick={handleExtractAI}
                        disabled={extracting}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-[10px] text-purple-300 hover:text-purple-200 transition disabled:opacity-40"
                    >
                        {extracting ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />} AI 提取人物
                    </button>
                    <button
                        onClick={handleGraphAI}
                        disabled={graphLoading}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-[10px] text-cyan-300 hover:text-cyan-200 transition disabled:opacity-40"
                    >
                        {graphLoading ? <Loader2 size={10} className="animate-spin" /> : <GitFork size={10} />} 关系图谱
                    </button>
                    <button
                        onClick={addRow}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] text-white/50 hover:text-white/80 transition"
                    >
                        <Plus size={10} /> 新增行
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !dirty}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition ${saved
                            ? "bg-green-500/15 text-green-400 border border-green-500/20"
                            : "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/25"
                            } disabled:opacity-30`}
                    >
                        {saving ? (
                            <>
                                <Loader2 size={10} className="animate-spin" /> 保存中
                            </>
                        ) : saved ? (
                            <>
                                <Check size={10} /> 已保存
                            </>
                        ) : (
                            <>
                                <Save size={10} /> 💾 保存数据
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} /> {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12 text-white/20">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    <span className="text-xs">加载权力地图...</span>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-white/[0.03] border-b border-white/10">
                                <th className="text-left px-3 py-2.5 font-medium text-white/40 w-[120px]">
                                    姓名
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-white/40 w-[130px]">
                                    职位
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-white/40 w-[140px]">
                                    角色定位
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-white/40 w-[110px]">
                                    态度
                                </th>
                                <th className="text-center px-3 py-2.5 font-medium text-white/40 w-[70px]">
                                    权重
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-white/40 w-[120px]">
                                    上级/汇报给
                                </th>
                                <th className="text-center px-3 py-2.5 font-medium text-white/40 w-[50px]">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr
                                    key={idx}
                                    className="border-b border-white/5 hover:bg-white/[0.02] transition"
                                >
                                    {/* 姓名 */}
                                    <td className="px-2 py-1.5">
                                        <input
                                            value={row.name}
                                            onChange={(e) => updateCell(idx, "name", e.target.value)}
                                            placeholder="姓名"
                                            className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-[hsl(var(--primary))]/40 text-white/80 placeholder:text-white/15 focus:outline-none transition"
                                        />
                                    </td>
                                    {/* 职位 */}
                                    <td className="px-2 py-1.5">
                                        <input
                                            value={row.title}
                                            onChange={(e) => updateCell(idx, "title", e.target.value)}
                                            placeholder="如: 电气科长"
                                            className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-[hsl(var(--primary))]/40 text-white/80 placeholder:text-white/15 focus:outline-none transition"
                                        />
                                    </td>
                                    {/* 角色定位 */}
                                    <td className="px-2 py-1.5">
                                        <select
                                            value={row.role}
                                            onChange={(e) => updateCell(idx, "role", e.target.value)}
                                            className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-[hsl(var(--primary))]/40 text-white/70 focus:outline-none cursor-pointer appearance-none transition"
                                        >
                                            {ROLE_OPTIONS.map((r) => (
                                                <option key={r} value={r} className="bg-[hsl(222,47%,9%)]">
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    {/* 态度 */}
                                    <td className="px-2 py-1.5">
                                        <select
                                            value={row.attitude}
                                            onChange={(e) =>
                                                updateCell(idx, "attitude", e.target.value)
                                            }
                                            className={`w-full px-2 py-1.5 rounded-md border text-center font-medium cursor-pointer appearance-none focus:outline-none transition ${attitudeColor(row.attitude)}`}
                                        >
                                            {ATTITUDE_OPTIONS.map((a) => (
                                                <option key={a} value={a} className="bg-[hsl(222,47%,9%)] text-white">
                                                    {a}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    {/* 权重 */}
                                    <td className="px-2 py-1.5 text-center">
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={row.influence}
                                            onChange={(e) =>
                                                updateCell(
                                                    idx,
                                                    "influence",
                                                    Math.max(1, Math.min(10, Number(e.target.value))),
                                                )
                                            }
                                            className={`w-12 mx-auto px-1 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-[hsl(var(--primary))]/40 text-center tabular-nums font-bold focus:outline-none transition ${row.influence >= 8
                                                ? "text-red-400"
                                                : row.influence >= 5
                                                    ? "text-yellow-400"
                                                    : "text-white/50"
                                                }`}
                                        />
                                    </td>
                                    {/* 上级 */}
                                    <td className="px-2 py-1.5">
                                        <input
                                            value={row.reports_to}
                                            onChange={(e) =>
                                                updateCell(idx, "reports_to", e.target.value)
                                            }
                                            placeholder="上级姓名"
                                            className="w-full px-2 py-1.5 rounded-md bg-transparent border border-transparent hover:border-white/10 focus:border-[hsl(var(--primary))]/40 text-white/80 placeholder:text-white/15 focus:outline-none transition"
                                        />
                                    </td>
                                    {/* 删除 */}
                                    <td className="px-2 py-1.5 text-center">
                                        <button
                                            onClick={() => removeRow(idx)}
                                            className="p-1 rounded-md hover:bg-red-500/10 text-white/20 hover:text-red-400 transition"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 底部统计 */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-t border-white/5">
                        <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                            <Users size={10} />
                            共 {rows.filter((r) => r.name.trim()).length} 位关键人
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-white/20">
                            <span>
                                支持:{" "}
                                <strong className="text-green-400">
                                    {rows.filter((r) => r.attitude.includes("支持")).length}
                                </strong>
                            </span>
                            <span>
                                中立:{" "}
                                <strong className="text-yellow-400">
                                    {rows.filter((r) => r.attitude === "中立").length}
                                </strong>
                            </span>
                            <span>
                                反对:{" "}
                                <strong className="text-red-400">
                                    {rows.filter((r) => r.attitude.includes("反对")).length}
                                </strong>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 关系图谱结果 */}
            {(graphResult || graphLoading) && (
                <div className="mt-4 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.03] p-4">
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-cyan-400/80">
                        <GitFork size={12} />
                        AI 关系图谱 & 策略建议
                    </div>
                    {graphLoading ? (
                        <div className="flex items-center gap-2 text-xs text-cyan-400/50 py-4 justify-center">
                            <Loader2 size={14} className="animate-spin" />
                            正在分析权力结构...
                        </div>
                    ) : (
                        <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto bg-white/[0.02] rounded-lg p-3 font-mono">
                            {graphResult}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
