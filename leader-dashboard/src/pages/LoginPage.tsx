/**
 * LoginPage.tsx — 企业级登录页 (JWT 认证)
 * ==========================================
 * 对接后端 /api/auth/login，签发 JWT Token。
 * 支持预置演示账号快速切入。
 */

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/useAuthStore"

const DEMO_ACCOUNTS = [
    { phone: "admin", password: "123", label: "🛡️ 管理员", role: "admin" },
    { phone: "vp001", password: "123", label: "👑 VP 视角", role: "vp" },
    { phone: "director001", password: "123", label: "📊 总监视角", role: "director" },
    { phone: "sales001", password: "123", label: "⚔️ 销售视角", role: "sales" },
]

export function LoginPageNew() {
    const { login, isLoading, error, isAuthenticated } = useAuthStore()
    const navigate = useNavigate()
    const [phone, setPhone] = useState("")
    const [password, setPassword] = useState("")

    // 已登录用户自动跳转
    useEffect(() => {
        if (isAuthenticated) {
            navigate("/sandbox", { replace: true })
        }
    }, [isAuthenticated, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await login({ phone, password })
            navigate("/sandbox", { replace: true })
        } catch {
            // error is handled in store
        }
    }

    const quickLogin = async (ph: string, pw: string) => {
        setPhone(ph)
        setPassword(pw)
        try {
            await login({ phone: ph, password: pw })
            navigate("/sandbox", { replace: true })
        } catch {
            // handled
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
            <div className="w-full max-w-sm p-8 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]/30 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="text-4xl mb-3">⚡</div>
                    <h1 className="text-2xl font-bold text-white/90">SRI 作战指挥室</h1>
                    <p className="text-sm text-white/40 mt-1">Enterprise Sales Intelligence</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="手机号 / 登录名"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50"
                    />
                    <input
                        type="password"
                        placeholder="密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50"
                    />

                    {error && (
                        <div className="text-red-400 text-sm text-center">{error}</div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !phone || !password}
                        className="w-full py-3 rounded-lg bg-[hsl(var(--primary))] text-white font-medium hover:brightness-110 transition disabled:opacity-50"
                    >
                        {isLoading ? "认证中..." : "🔐 登录"}
                    </button>
                </form>

                <div className="mt-6 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/30 mb-3 text-center">快速演示入口</p>
                    <div className="grid grid-cols-2 gap-2">
                        {DEMO_ACCOUNTS.map((acc) => (
                            <button
                                key={acc.phone}
                                onClick={() => quickLogin(acc.phone, acc.password)}
                                className="px-3 py-2 rounded-lg bg-white/5 text-xs text-white/60 hover:bg-white/10 transition"
                            >
                                {acc.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
