import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

// ── Types ──

export type UserRole = "vp" | "director" | "sales"

export interface User {
    id: string
    name: string
    role: UserRole
    emoji: string
    title: string
    badgeVariant: "warning" | "info" | "success"
}

interface AuthContextValue {
    user: User | null
    login: (user: User) => void
    logout: () => void
}

// ── Preset Users ──

export const PRESET_USERS: User[] = [
    {
        id: "wang-vp",
        name: "王VP",
        role: "vp",
        emoji: "👑",
        title: "全局最高权限",
        badgeVariant: "warning",
    },
    {
        id: "li-director",
        name: "李总监",
        role: "director",
        emoji: "🛡️",
        title: "区域管控权限",
        badgeVariant: "info",
    },
    {
        id: "zhang-sales",
        name: "张伟",
        role: "sales",
        emoji: "⚔️",
        title: "一线销售视角",
        badgeVariant: "success",
    },
]

// ── Context ──

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = "sri_auth_user"

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const stored = sessionStorage.getItem(SESSION_KEY)
            return stored ? (JSON.parse(stored) as User) : null
        } catch {
            return null
        }
    })

    const login = useCallback((u: User) => {
        setUser(u)
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
    }, [])

    const logout = useCallback(() => {
        setUser(null)
        sessionStorage.removeItem(SESSION_KEY)
    }, [])

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within AuthProvider")
    return ctx
}
