/**
 * Sidebar.tsx — 左侧导航栏
 * ===========================
 * 10 大战区路由 + 用户身份 + 登出
 */

import { NavLink } from "react-router-dom"
import { useAuthStore } from "@/store/useAuthStore"

interface NavItem {
    path: string
    icon: string
    label: string
    roles?: string[] // 空 = 所有角色可见
}

const NAV_ITEMS: NavItem[] = [
    { path: "/first-scene", icon: "📡", label: "第一现场" },
    { path: "/intel", icon: "🔍", label: "情报中心" },
    { path: "/sandbox", icon: "🗺️", label: "作战沙盘" },
    { path: "/deal-desk", icon: "📋", label: "报价底单", roles: ["sales", "vp", "admin"] },
    { path: "/contract", icon: "📄", label: "合同联审" },
    { path: "/bidding", icon: "⚔️", label: "招投标" },
    { path: "/academy", icon: "🎓", label: "伴学中心" },
    { path: "/live-pitch", icon: "🎯", label: "实战靶场", roles: ["sales", "admin"] },
    { path: "/knowledge", icon: "📚", label: "知识弹药库" },
    { path: "/leader", icon: "📊", label: "统帅态势", roles: ["director", "vp", "admin"] },
    { path: "/finance", icon: "💰", label: "财务中枢" },
]

export function Sidebar() {
    const { user, logout } = useAuthStore()

    const visibleItems = NAV_ITEMS.filter(
        (item) =>
            !item.roles || !user?.role || item.roles.includes(user.role) || user.role === "admin",
    )

    return (
        <aside className="w-56 h-screen sticky top-0 flex flex-col bg-[hsl(var(--card))]/60 border-r border-[hsl(var(--border))]/30 backdrop-blur-xl">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <div>
                        <div className="text-sm font-bold text-white/90">SRI 作战指挥室</div>
                        <div className="text-[10px] text-white/30">v2.0 Enterprise</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
                {visibleItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive
                                ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] font-medium"
                                : "text-white/50 hover:text-white/80 hover:bg-white/5"
                            }`
                        }
                    >
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User */}
            {user && (
                <div className="px-4 py-4 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))]/20 flex items-center justify-center text-sm">
                            {user.role === "vp" ? "👑" : user.role === "director" ? "🛡️" : "⚔️"}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-white/80 truncate">{user.name}</div>
                            <div className="text-[10px] text-white/30">{user.role} · {user.dept}</div>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full text-xs text-white/30 hover:text-red-400 transition py-1"
                    >
                        退出登录
                    </button>
                </div>
            )}
        </aside>
    )
}
