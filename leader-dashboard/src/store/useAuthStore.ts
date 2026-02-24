/**
 * useAuthStore.ts — 作战身份指挥枢纽 (Zustand)
 * ==============================================
 * 管理 JWT Token + User Profile + 登录/登出。
 * localStorage 持久化。
 */

import { create } from "zustand"
import { loginApi, fetchMe, type AuthUser, type LoginRequest } from "@/lib/apiClient"

interface AuthState {
    token: string | null
    user: AuthUser | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null

    // 动作
    login: (req: LoginRequest) => Promise<void>
    logout: () => void
    restoreSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem("sri_token"),
    user: (() => {
        try {
            const stored = localStorage.getItem("sri_user")
            return stored ? JSON.parse(stored) : null
        } catch {
            return null
        }
    })(),
    isAuthenticated: !!localStorage.getItem("sri_token"),
    isLoading: false,
    error: null,

    login: async (req: LoginRequest) => {
        set({ isLoading: true, error: null })
        try {
            const res = await loginApi(req)
            localStorage.setItem("sri_token", res.access_token)
            localStorage.setItem("sri_user", JSON.stringify(res.user))
            set({
                token: res.access_token,
                user: res.user,
                isAuthenticated: true,
                isLoading: false,
            })
        } catch (err: unknown) {
            const rawDetail =
                (err as { response?: { data?: { detail?: unknown } } })?.response?.data
                    ?.detail
            // detail 可能是 string 或 Pydantic 422 数组
            let msg = "登录失败"
            if (typeof rawDetail === "string") {
                msg = rawDetail
            } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
                msg = rawDetail.map((e: { msg?: string }) => e.msg || "").join("; ") || "登录失败"
            }
            set({ error: msg, isLoading: false })
            throw err
        }
    },

    logout: () => {
        localStorage.removeItem("sri_token")
        localStorage.removeItem("sri_user")
        set({ token: null, user: null, isAuthenticated: false })
    },

    restoreSession: async () => {
        const token = localStorage.getItem("sri_token")
        if (!token) return
        try {
            const user = await fetchMe()
            localStorage.setItem("sri_user", JSON.stringify(user))
            set({ token, user, isAuthenticated: true })
        } catch {
            // Token 无效 → 清空
            localStorage.removeItem("sri_token")
            localStorage.removeItem("sri_user")
            set({ token: null, user: null, isAuthenticated: false })
        }
    },
}))
