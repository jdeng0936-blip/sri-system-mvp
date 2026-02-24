import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

// ── Types ──

export type AIModel = "gpt-4o" | "deepseek-v3" | "claude-3.5"

export interface ProviderConfig {
    enabled: boolean
    apiKey: string
    model: string
    baseUrl: string
}

export interface LLMConfigs {
    openai: ProviderConfig
    gemini: ProviderConfig
    anthropic: ProviderConfig
    xai: ProviderConfig
    local: ProviderConfig
}

export type LLMProviderKey = keyof LLMConfigs

export interface GlobalSettings {
    aiModel: AIModel
    apiKey: string             // 向后兼容（= openai.apiKey 双向同步）
    llmConfigs: LLMConfigs     // 🆕 5 防线完整配置
    selectedZones: string[]
    dateFrom: string
    dateTo: string
}

interface SettingsContextValue {
    settings: GlobalSettings
    updateSettings: (patch: Partial<GlobalSettings>) => void
    updateProvider: (provider: LLMProviderKey, patch: Partial<ProviderConfig>) => void
    resetSettings: () => void
}

// ── Provider Metadata (for UI rendering) ──

export const LLM_PROVIDERS: { key: LLMProviderKey; label: string; icon: string; color: string; alwaysOn?: boolean }[] = [
    { key: "openai", label: "OpenAI", icon: "🟢", color: "emerald" },
    { key: "gemini", label: "Google Gemini", icon: "🔵", color: "blue" },
    { key: "anthropic", label: "Anthropic", icon: "🟠", color: "orange" },
    { key: "xai", label: "xAI Grok", icon: "⚫", color: "slate" },
    { key: "local", label: "Local DeepSeek", icon: "🏠", color: "violet", alwaysOn: true },
]

// ── Defaults ──

const DEFAULT_LLM_CONFIGS: LLMConfigs = {
    openai: { enabled: true, apiKey: "", model: "gpt-4o-mini", baseUrl: "" },
    gemini: { enabled: false, apiKey: "", model: "gemini-2.0-flash", baseUrl: "" },
    anthropic: { enabled: false, apiKey: "", model: "claude-3-5-sonnet-20241022", baseUrl: "" },
    xai: { enabled: false, apiKey: "", model: "grok-3-mini", baseUrl: "" },
    local: { enabled: true, apiKey: "local", model: "deepseek-r1", baseUrl: "http://localhost:11434/v1" },
}

const DEFAULT_SETTINGS: GlobalSettings = {
    aiModel: "gpt-4o",
    apiKey: "",
    llmConfigs: { ...DEFAULT_LLM_CONFIGS },
    selectedZones: [],
    dateFrom: "",
    dateTo: "",
}

export const AVAILABLE_ZONES = ["华东区", "华南区", "华北区", "西南区", "中部区"] as const

export const AI_MODELS: { value: AIModel; label: string; desc: string }[] = [
    { value: "gpt-4o", label: "GPT-4o", desc: "OpenAI 旗舰模型" },
    { value: "deepseek-v3", label: "DeepSeek-V3", desc: "国产高性能推理" },
    { value: "claude-3.5", label: "Claude-3.5 Sonnet", desc: "Anthropic 超长上下文" },
]

// ── Context ──

const STORAGE_KEY = "sri_global_settings"

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadSettings(): GlobalSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            // 向后兼容：旧版没有 llmConfigs 字段
            if (!parsed.llmConfigs) {
                parsed.llmConfigs = { ...DEFAULT_LLM_CONFIGS }
                // 旧版 apiKey 迁移到 openai.apiKey
                if (parsed.apiKey) {
                    parsed.llmConfigs.openai.apiKey = parsed.apiKey
                }
            }
            return { ...DEFAULT_SETTINGS, ...parsed }
        }
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: GlobalSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<GlobalSettings>(loadSettings)

    const updateSettings = useCallback((patch: Partial<GlobalSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...patch }

            // 双向同步：apiKey ↔ openai.apiKey
            if (patch.apiKey !== undefined && patch.apiKey !== prev.llmConfigs.openai.apiKey) {
                next.llmConfigs = {
                    ...next.llmConfigs,
                    openai: { ...next.llmConfigs.openai, apiKey: patch.apiKey },
                }
            }

            saveSettings(next)
            return next
        })
    }, [])

    const updateProvider = useCallback((provider: LLMProviderKey, patch: Partial<ProviderConfig>) => {
        setSettings((prev) => {
            const updatedProvider = { ...prev.llmConfigs[provider], ...patch }
            const next: GlobalSettings = {
                ...prev,
                llmConfigs: { ...prev.llmConfigs, [provider]: updatedProvider },
            }

            // 反向同步：openai.apiKey → apiKey
            if (provider === "openai" && patch.apiKey !== undefined) {
                next.apiKey = patch.apiKey
            }

            saveSettings(next)
            return next
        })
    }, [])

    const resetSettings = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.clear()
        setSettings({ ...DEFAULT_SETTINGS, llmConfigs: { ...DEFAULT_LLM_CONFIGS } })
    }, [])

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, updateProvider, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings(): SettingsContextValue {
    const ctx = useContext(SettingsContext)
    if (!ctx) throw new Error("useSettings must be used within SettingsProvider")
    return ctx
}
