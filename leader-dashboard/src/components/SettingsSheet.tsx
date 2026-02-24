import { useState } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    useSettings,
    LLM_PROVIDERS,
    AVAILABLE_ZONES,
    type LLMProviderKey,
} from "@/contexts/SettingsContext"
import { cn } from "@/lib/utils"

// Default Base URLs for placeholder hints
const DEFAULT_BASE_URLS: Record<LLMProviderKey, string> = {
    openai: "https://api.openai.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
    anthropic: "https://api.anthropic.com/v1/",
    xai: "https://api.x.ai/v1",
    local: "http://localhost:11434/v1",
}

export function SettingsSheet() {
    const [open, setOpen] = useState(false)
    const { settings, updateSettings, updateProvider, resetSettings } = useSettings()
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [expandedProvider, setExpandedProvider] = useState<LLMProviderKey | null>(null)

    const handleZoneToggle = (zone: string) => {
        const current = settings.selectedZones
        const next = current.includes(zone)
            ? current.filter((z) => z !== zone)
            : [...current, zone]
        updateSettings({ selectedZones: next })
    }

    const handleReset = () => {
        resetSettings()
        setShowResetConfirm(false)
        setOpen(false)
    }

    const enabledCount = LLM_PROVIDERS.filter(
        (p) => settings.llmConfigs[p.key].enabled
    ).length

    return (
        <>
            {/* Trigger Button */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setOpen(true)}
                            className="relative flex items-center justify-center w-8 h-8 rounded-md border border-[hsl(var(--border))]/30 hover:border-[hsl(var(--primary))]/50 bg-[hsl(var(--secondary))]/50 hover:bg-[hsl(var(--primary))]/10 transition-all group"
                        >
                            <span className="text-sm group-hover:animate-spin" style={{ animationDuration: "1.5s" }}>
                                ⚙️
                            </span>
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>系统设置</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Sheet */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="right" className="overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="flex items-center gap-2">
                            ⚙️ 系统设置
                            <Badge variant="outline" className="text-[9px] font-mono">
                                CONTROL PANEL
                            </Badge>
                        </SheetTitle>
                        <SheetDescription>
                            全局配置 · 所有更改自动保存
                        </SheetDescription>
                    </SheetHeader>

                    {/* ── Section 1: AI Engine ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">🧠</span>
                            <h3 className="text-sm font-medium text-[hsl(var(--foreground))]">AI 引擎配置</h3>
                        </div>

                        {/* Quick API Key (backward compat) */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                OpenAI API Key（快捷入口）
                            </label>
                            <Input
                                type="password"
                                value={settings.apiKey}
                                onChange={(e) => updateSettings({ apiKey: e.target.value })}
                                placeholder="sk-..."
                            />
                            {settings.apiKey && (
                                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    Key 已配置 · 第一防线就绪
                                </p>
                            )}
                        </div>

                        {/* ── Advanced AI Router Config (Collapsible) ── */}
                        <div className="rounded-lg border border-[hsl(var(--border))]/30 overflow-hidden">
                            <button
                                onClick={() => setAdvancedOpen(!advancedOpen)}
                                className="w-full flex items-center justify-between px-3 py-2.5 bg-[hsl(var(--background))]/50 hover:bg-[hsl(var(--background))]/80 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">{advancedOpen ? "▾" : "▸"}</span>
                                    <span className="text-xs font-medium text-[hsl(var(--foreground))]">
                                        ⚙️ 高级 AI 路由配置
                                    </span>
                                </div>
                                <Badge
                                    variant="outline"
                                    className="text-[9px] font-mono"
                                >
                                    {enabledCount}/5 防线就绪
                                </Badge>
                            </button>

                            {advancedOpen && (
                                <div className="px-3 pb-3 space-y-2 pt-1">
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] pb-1">
                                        故障自动降级：按顺序尝试，任一成功即返回
                                    </p>

                                    {LLM_PROVIDERS.map((provider, idx) => {
                                        const config = settings.llmConfigs[provider.key]
                                        const isExpanded = expandedProvider === provider.key
                                        const isLocal = provider.alwaysOn

                                        return (
                                            <div
                                                key={provider.key}
                                                className={cn(
                                                    "rounded-md border transition-all",
                                                    config.enabled
                                                        ? "border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5"
                                                        : "border-[hsl(var(--border))]/20 bg-[hsl(var(--background))]/30"
                                                )}
                                            >
                                                {/* Provider Header */}
                                                <div className="flex items-center gap-2 px-2.5 py-2">
                                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono w-4">
                                                        {idx + 1}
                                                    </span>

                                                    {/* Toggle */}
                                                    <button
                                                        onClick={() => {
                                                            if (!isLocal) {
                                                                updateProvider(provider.key, { enabled: !config.enabled })
                                                            }
                                                        }}
                                                        disabled={isLocal}
                                                        className={cn(
                                                            "w-7 h-4 rounded-full transition-colors relative shrink-0",
                                                            isLocal
                                                                ? "bg-amber-500/40 cursor-not-allowed"
                                                                : config.enabled
                                                                    ? "bg-emerald-500 cursor-pointer"
                                                                    : "bg-[hsl(var(--muted))]/40 cursor-pointer hover:bg-[hsl(var(--muted))]/60"
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                                                                config.enabled || isLocal ? "left-3.5" : "left-0.5"
                                                            )}
                                                        />
                                                    </button>

                                                    {/* Label */}
                                                    <button
                                                        onClick={() => setExpandedProvider(isExpanded ? null : provider.key)}
                                                        className="flex-1 flex items-center gap-1.5 min-w-0"
                                                    >
                                                        <span className="text-xs">{provider.icon}</span>
                                                        <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate">
                                                            {provider.label}
                                                        </span>
                                                    </button>

                                                    {/* Status */}
                                                    {isLocal ? (
                                                        <Badge variant="outline" className="text-[8px] border-amber-500/30 text-amber-400">
                                                            始终启用
                                                        </Badge>
                                                    ) : config.enabled && config.apiKey ? (
                                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                                    ) : config.enabled ? (
                                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                                    ) : null}

                                                    {/* Expand arrow */}
                                                    <button
                                                        onClick={() => setExpandedProvider(isExpanded ? null : provider.key)}
                                                        className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-1"
                                                    >
                                                        {isExpanded ? "▲" : "▼"}
                                                    </button>
                                                </div>

                                                {/* Expanded Config Fields */}
                                                {isExpanded && (
                                                    <div className="px-2.5 pb-2.5 space-y-2 border-t border-[hsl(var(--border))]/10 pt-2">
                                                        {/* API Key */}
                                                        {!isLocal && (
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">
                                                                    API Key
                                                                </label>
                                                                <Input
                                                                    type="password"
                                                                    value={config.apiKey}
                                                                    onChange={(e) =>
                                                                        updateProvider(provider.key, { apiKey: e.target.value })
                                                                    }
                                                                    placeholder={provider.key === "openai" ? "sk-..." : `${provider.label} API Key`}
                                                                    className="h-7 text-xs"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Model */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">
                                                                模型名称
                                                            </label>
                                                            <Input
                                                                type="text"
                                                                value={config.model}
                                                                onChange={(e) =>
                                                                    updateProvider(provider.key, { model: e.target.value })
                                                                }
                                                                placeholder={config.model}
                                                                className="h-7 text-xs font-mono"
                                                            />
                                                        </div>

                                                        {/* Base URL */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">
                                                                Base URL
                                                                <span className="normal-case ml-1 opacity-50">（可选·反代/本地）</span>
                                                            </label>
                                                            <Input
                                                                type="text"
                                                                value={config.baseUrl}
                                                                onChange={(e) =>
                                                                    updateProvider(provider.key, { baseUrl: e.target.value })
                                                                }
                                                                placeholder={DEFAULT_BASE_URLS[provider.key]}
                                                                className="h-7 text-xs font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator className="my-6 bg-[hsl(var(--border))]/20" />

                    {/* ── Section 2: Zone & Time ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">🛡️</span>
                            <h3 className="text-sm font-medium text-[hsl(var(--foreground))]">战区与时间过滤</h3>
                        </div>

                        {/* Zone Multi-Select */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                战区选择
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_ZONES.map((zone) => {
                                    const isSelected = settings.selectedZones.includes(zone)
                                    return (
                                        <button
                                            key={zone}
                                            onClick={() => handleZoneToggle(zone)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-xs border transition-all",
                                                isSelected
                                                    ? "bg-[hsl(var(--primary))]/15 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))]"
                                                    : "bg-[hsl(var(--background))] border-[hsl(var(--border))]/30 text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))]"
                                            )}
                                        >
                                            {zone}
                                        </button>
                                    )
                                })}
                            </div>
                            {settings.selectedZones.length > 0 && (
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                    已选: {settings.selectedZones.join(", ")}
                                </p>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs text-[hsl(var(--muted-foreground))]">起始日期</label>
                                <Input
                                    type="date"
                                    value={settings.dateFrom}
                                    onChange={(e) => updateSettings({ dateFrom: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-[hsl(var(--muted-foreground))]">结束日期</label>
                                <Input
                                    type="date"
                                    value={settings.dateTo}
                                    onChange={(e) => updateSettings({ dateTo: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator className="my-6 bg-[hsl(var(--border))]/20" />

                    {/* ── Section 3: System Maintenance ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">⚙️</span>
                            <h3 className="text-sm font-medium text-[hsl(var(--foreground))]">系统维护</h3>
                        </div>

                        {showResetConfirm ? (
                            <div className="p-3 rounded-md border border-red-500/30 bg-red-500/5 space-y-3">
                                <p className="text-xs text-red-400">
                                    ⚠️ 此操作将清除所有本地缓存（包括登录态、API Key、筛选条件）。确认执行？
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="flex-1 text-xs"
                                        onClick={handleReset}
                                    >
                                        🗑️ 确认清除
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-xs"
                                        onClick={() => setShowResetConfirm(false)}
                                    >
                                        取消
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                onClick={() => setShowResetConfirm(true)}
                            >
                                🗑️ 清除本地缓存 / 重置系统
                            </Button>
                        )}

                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            版本: SRI v2.0.0 · React + Vite · {new Date().getFullYear()}
                        </p>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    )
}
