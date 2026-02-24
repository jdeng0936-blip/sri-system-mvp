/**
 * apiClient.ts — 企业级 Axios 通信雷达
 * =======================================
 * 1. JWT Token 自动注入 (Request Interceptor)
 * 2. 401 自动登出 / 403 防篡改警告 (Response Interceptor)
 * 3. 保留旧版类型和函数签名以向后兼容
 */

import axios, {
    type AxiosInstance,
    type AxiosError,
    type InternalAxiosRequestConfig,
} from "axios"
import toast from "react-hot-toast"

// ── Axios 实例 ──
const BASE_URL = "http://localhost:8000"

export const api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
})

// ═══════════════════════════════════════════
// Request Interceptor: 自动注入 JWT
// ═══════════════════════════════════════════
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem("sri_token")
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error),
)

// ═══════════════════════════════════════════
// Response Interceptor: 全局异常拦截
// ═══════════════════════════════════════════
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ detail?: unknown }>) => {
        const status = error.response?.status
        const rawDetail = error.response?.data?.detail
        // detail 可能是 string(业务错误) 或 array(Pydantic 422 校验)
        let detail: string
        if (typeof rawDetail === "string") {
            detail = rawDetail
        } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
            detail = rawDetail.map((e: { msg?: string }) => e.msg || "").join("; ")
        } else {
            detail = error.message
        }

        if (status === 401) {
            // ── 强制清空登录态 ──
            localStorage.removeItem("sri_token")
            localStorage.removeItem("sri_user")
            toast.error("🔒 会话已过期，请重新登录")
            // 如果不在登录页，跳转到登录页
            if (window.location.pathname !== "/login") {
                window.location.href = "/login"
            }
        } else if (status === 403) {
            // ── 防篡改拦截 / 权限不足 ──
            toast.error(`🚨 ${detail}`, { duration: 6000 })
        } else if (status === 409) {
            // ── 撞单/状态冲突 ──
            toast.error(`⚠️ ${detail}`, { duration: 5000 })
        } else if (status === 422) {
            // ── 风控拦截 / 参数校验失败 ──
            toast.error(`⛔ ${detail}`, { duration: 5000 })
        }

        return Promise.reject(error)
    },
)

// ═══════════════════════════════════════════
// 类型定义 (向后兼容旧版 + 新增)
// ═══════════════════════════════════════════

export interface LoginRequest {
    phone: string
    password: string
}

export interface AuthUser {
    id?: number
    name: string
    phone?: string
    username?: string
    emp_no?: string
    role: string
    dept?: string
    is_active?: boolean
    created_at?: string
}

export interface TokenResponse {
    access_token: string
    token_type?: string
    user: AuthUser
}

export interface ProjectDTO {
    id: number
    name: string
    client: string
    project_title?: string
    design_institute?: string
    general_contractor?: string
    owner_id?: number
    dept?: string
    applicant_name?: string
    approval_status: string
    stage: string
    budget_status: string
    competitive_position: string
    estimated_amount: number
    win_rate: number
    created_at: string
    updated_at: string
}

// ── AI 相关 ──
export interface AIResponse {
    result: string
    model_used?: string
    error?: string
}

// ── 旧版兼容类型 ──
export interface PitchRequest {
    project_id: number
    pitch_type: "wechat_msg" | "email" | "internal_strategy" | "tech_solution"
    target_role?: string
    custom_input?: string
}

export interface PitchResult {
    pitch?: string
    error?: string
}

export interface StakeholderRow {
    name: string
    title: string
    role: string
    attitude: string
    influence: number
    reports_to: string
}

// ═══════════════════════════════════════════
// API 调用函数
// ═══════════════════════════════════════════

// ── Auth ──
export async function loginApi(req: LoginRequest): Promise<TokenResponse> {
    // 兼容两种后端格式:
    // 新版: {phone, password} → {access_token, user: {id, name, phone, role, dept, ...}}
    // 旧版: {username, password} → {token, user: {username, role, name, emp_no}}
    const { data } = await axios.post(
        `${BASE_URL}/api/auth/login`,
        { username: req.phone, phone: req.phone, password: req.password },
        {
            headers: { "Content-Type": "application/json" },
            timeout: 15000,
        },
    )

    // 标准化响应: 兼容旧版 {token} 和新版 {access_token}
    const accessToken = data.access_token || data.token || ""
    const rawUser = data.user || {}
    const user: AuthUser = {
        id: rawUser.id,
        name: rawUser.name || rawUser.username || "用户",
        phone: rawUser.phone || rawUser.username,
        username: rawUser.username,
        emp_no: rawUser.emp_no,
        role: rawUser.role || "sales",
        dept: rawUser.dept || "默认战区",
        is_active: rawUser.is_active ?? true,
        created_at: rawUser.created_at,
    }

    return { access_token: accessToken, token_type: "bearer", user }
}

export async function fetchMe(): Promise<AuthUser> {
    const { data } = await api.get<AuthUser>("/api/auth/me")
    return data
}

// ── Projects ──
export async function fetchProjects(): Promise<ProjectDTO[]> {
    const { data } = await api.get<ProjectDTO[]>("/api/projects")
    return data
}

export async function createProject(body: {
    client: string
    project_title: string
    design_institute?: string
    estimated_amount?: number
}): Promise<ProjectDTO> {
    const { data } = await api.post<ProjectDTO>("/api/projects", body)
    return data
}

// ── AI ──
export async function parseIntel(text: string): Promise<AIResponse> {
    const { data } = await api.post<AIResponse>("/api/ai/parse-intel", { text })
    return data
}

export async function generateNBA(projectId: number): Promise<AIResponse> {
    const { data } = await api.post<AIResponse>("/api/ai/generate-nba", {
        project_id: projectId,
    })
    return data
}

export async function generatePitch(
    projectId: number,
    context?: string,
): Promise<AIResponse> {
    const { data } = await api.post<AIResponse>("/api/ai/generate-pitch", {
        project_id: projectId,
        context,
    })
    return data
}

export async function generateQuiz(projectId: number): Promise<AIResponse> {
    const { data } = await api.post<AIResponse>("/api/ai/generate-quiz", {
        project_id: projectId,
    })
    return data
}

export async function critiqueAnswer(
    question: string,
    answer: string,
): Promise<AIResponse> {
    const { data } = await api.post<AIResponse>("/api/ai/critique", {
        question,
        answer,
    })
    return data
}

// ── Stakeholders ──
export async function fetchStakeholders(
    projectId: number,
): Promise<StakeholderRow[]> {
    const { data } = await api.get(
        `/api/projects/${projectId}/stakeholders`,
    )
    // Map backend shape to frontend StakeholderRow
    return (data as Array<Record<string, unknown>>).map((s) => ({
        name: (s.name as string) || "",
        title: (s.title as string) || "",
        role: (s.role_tags as string) || "",
        attitude: (s.attitude as string) === "support"
            ? "支持"
            : (s.attitude as string) === "oppose"
                ? "反对"
                : "中立",
        influence: (s.influence_weight as number) || 5,
        reports_to: (s.reports_to as string) || "",
    }))
}

export async function saveStakeholders(
    projectId: number,
    items: StakeholderRow[],
): Promise<{ saved?: number; error?: string }> {
    const mapped = items.map((s) => ({
        name: s.name,
        title: s.title,
        role_tags: s.role,
        attitude: s.attitude.includes("支持")
            ? "support"
            : s.attitude.includes("反对")
                ? "oppose"
                : "neutral",
        influence_weight: s.influence,
        reports_to: s.reports_to,
    }))
    const { data } = await api.post(
        `/api/projects/${projectId}/stakeholders/batch`,
        mapped,
    )
    return { saved: Array.isArray(data) ? data.length : 0 }
}

// ── Health ──
export async function healthCheck(): Promise<{
    status: string
    version: string
}> {
    const { data } = await api.get("/api/health")
    return data
}

// ── Intel Logs ──
export interface IntelLogDTO {
    id: number
    project_id: number
    author_id?: number
    raw_input?: string
    input_type: string
    ai_parsed_json?: string
    ai_model_used?: string
    created_at: string
}

export async function fetchIntelLogs(
    projectId: number,
): Promise<IntelLogDTO[]> {
    const { data } = await api.get(`/api/projects/${projectId}/intel`)
    return data
}

// ── AI: Extract Stakeholders from Intel ──
export async function extractStakeholders(
    projectId: number,
): Promise<AIResponse> {
    const { data } = await api.post("/api/ai/extract-stakeholders", {
        project_id: projectId,
    })
    return data
}

// ── AI: Power Map Graph ──
export async function generatePowerMap(
    projectId: number,
): Promise<AIResponse> {
    const { data } = await api.post("/api/ai/power-map", {
        project_id: projectId,
    })
    return data
}

// ── AI: Chat with Project (AI 参谋部) ──
export async function chatWithProject(
    projectId: number,
    messages: { role: string; content: string }[],
): Promise<AIResponse> {
    const { data } = await api.post("/api/ai/generate-pitch", {
        project_id: projectId,
        pitch_type: "internal_strategy",
        custom_input: messages[messages.length - 1]?.content || "",
    })
    return data
}
