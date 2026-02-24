import { useState } from "react"
import { PRESET_USERS, useAuth, type User } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

export function LoginPage() {
    const { login } = useAuth()
    const [hoveredId, setHoveredId] = useState<string | null>(null)
    const [loggingIn, setLoggingIn] = useState<string | null>(null)

    const handleLogin = (user: User) => {
        setLoggingIn(user.id)
        // Brief delay for the animation to play
        setTimeout(() => login(user), 400)
    }

    return (
        <div className="fixed inset-0 bg-[#0B1120] flex items-center justify-center overflow-hidden">
            {/* Background grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(56,189,248,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.3) 1px, transparent 1px)",
                    backgroundSize: "60px 60px",
                }}
            />

            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--primary))]/5 rounded-full blur-[120px]" />

            {/* Scan line animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent animate-scan" />
            </div>

            {/* Auth Card */}
            <div
                className={cn(
                    "relative z-10 w-full max-w-md mx-4",
                    "bg-[#0F172A]/80 backdrop-blur-xl",
                    "border border-[hsl(var(--primary))]/20",
                    "rounded-2xl p-8 md:p-10",
                    "shadow-[0_0_60px_-12px_rgba(56,189,248,0.15)]",
                    "transition-all duration-500"
                )}
            >
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-500/40 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-500/40 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-500/40 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-500/40 rounded-br-2xl" />

                {/* Header */}
                <div className="text-center space-y-3 mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                        <span className="text-[10px] text-cyan-400 font-mono tracking-[0.2em] uppercase">
                            System Online
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-wider">
                        SRI 情报作战系统
                    </h1>
                    <p className="text-xs text-slate-500 font-mono tracking-[0.15em] uppercase">
                        Secure Authentication Required
                    </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-700/50" />
                    <span className="text-[10px] text-slate-600 font-mono tracking-wider">
                        SELECT IDENTITY
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-700/50" />
                </div>

                {/* Identity Buttons */}
                <div className="space-y-3">
                    {PRESET_USERS.map((user) => {
                        const isHovered = hoveredId === user.id
                        const isLogging = loggingIn === user.id
                        const glowColor =
                            user.role === "vp"
                                ? "rgba(245,158,11,0.15)"
                                : user.role === "director"
                                    ? "rgba(56,189,248,0.15)"
                                    : "rgba(34,197,94,0.15)"
                        const borderColor =
                            user.role === "vp"
                                ? "border-amber-500/30"
                                : user.role === "director"
                                    ? "border-cyan-500/30"
                                    : "border-emerald-500/30"
                        const textColor =
                            user.role === "vp"
                                ? "text-amber-400"
                                : user.role === "director"
                                    ? "text-cyan-400"
                                    : "text-emerald-400"

                        return (
                            <button
                                key={user.id}
                                onClick={() => handleLogin(user)}
                                onMouseEnter={() => setHoveredId(user.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                disabled={!!loggingIn}
                                className={cn(
                                    "w-full flex items-center gap-4 p-4 rounded-xl",
                                    "bg-slate-800/40 border transition-all duration-300",
                                    "hover:scale-[1.02] active:scale-[0.98]",
                                    "disabled:opacity-50 disabled:cursor-not-allowed",
                                    isHovered || isLogging ? borderColor : "border-slate-700/50",
                                    isLogging && "animate-pulse"
                                )}
                                style={{
                                    boxShadow: isHovered || isLogging ? `0 0 30px -5px ${glowColor}` : "none",
                                }}
                            >
                                {/* Avatar */}
                                <div
                                    className={cn(
                                        "flex items-center justify-center w-12 h-12 rounded-lg text-xl",
                                        "bg-slate-900/80 border transition-all duration-300",
                                        isHovered || isLogging ? borderColor : "border-slate-700/30"
                                    )}
                                >
                                    {user.emoji}
                                </div>

                                {/* Info */}
                                <div className="flex-1 text-left">
                                    <p className={cn(
                                        "font-semibold text-sm transition-colors duration-300",
                                        isHovered || isLogging ? textColor : "text-slate-200"
                                    )}>
                                        {user.name}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {user.title}
                                    </p>
                                </div>

                                {/* Arrow / Loading */}
                                <div className={cn(
                                    "text-sm transition-all duration-300",
                                    isHovered ? `${textColor} translate-x-1` : "text-slate-600"
                                )}>
                                    {isLogging ? (
                                        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        "→"
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="mt-10 text-center">
                    <p className="text-[9px] text-slate-700 font-mono tracking-[0.2em] uppercase">
                        CLASSIFIED · AUTHORIZED PERSONNEL ONLY
                    </p>
                </div>
            </div>

            {/* Scan line CSS */}
            <style>{`
                @keyframes scan {
                    0% { top: -2px; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan {
                    animation: scan 4s ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}
