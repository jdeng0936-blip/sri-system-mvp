/**
 * App.tsx — 企业级 App Shell
 * ============================
 * 左侧 Sidebar + 右侧路由出口。
 * 10 大战区路由 + 登录页 + 鉴权守卫。
 *
 * 保留旧版 Context (AuthProvider, SettingsProvider, GlobalParamsProvider)
 * 以确保现有组件不崩,同时新组件使用 Zustand store。
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { Toaster } from "react-hot-toast"

// ── 旧版 Providers (向后兼容) ──
import { AuthProvider } from "@/contexts/AuthContext"
import { SettingsProvider } from "@/contexts/SettingsContext"
import { GlobalParamsProvider } from "@/store/globalParamsStore"

// ── 新版 Zustand store ──
import { useAuthStore } from "@/store/useAuthStore"

// ── Layout ──
import { Sidebar } from "@/components/Sidebar"

// ── Pages ──
import { LoginPageNew } from "@/pages/LoginPage"
import {
  LivePitchPage,
} from "@/pages/index"
import { IntelPage } from "@/pages/IntelPage"
import { KnowledgePage } from "@/pages/KnowledgePage"
import { AcademyPage } from "@/pages/AcademyPage"
import { LeaderPage } from "@/pages/LeaderPage"
import { BiddingPage } from "@/pages/BiddingPage"
import { DealDeskPage } from "@/pages/DealDeskPage"
import { FinancePage } from "@/pages/FinancePage"
import { ContractPage } from "@/pages/ContractPage"
import { SandboxPage } from "@/pages/SandboxPage"
import { FirstScenePage } from "@/pages/FirstScenePage"

// ═══════════════════════════════════════════
// 鉴权守卫：未登录 → 跳转 /login
// ═══════════════════════════════════════════
function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════
// App 根组件
// ═══════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <GlobalParamsProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "hsl(220 20% 14%)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "14px",
                },
              }}
            />
            <Routes>
              {/* 公开路由 */}
              <Route path="/login" element={<LoginPageNew />} />

              {/* 鉴权保护路由 */}
              <Route element={<AuthGuard />}>
                <Route path="/first-scene" element={<FirstScenePage />} />
                <Route path="/intel" element={<IntelPage />} />
                <Route path="/sandbox" element={<SandboxPage />} />
                <Route path="/academy" element={<AcademyPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                <Route path="/live-pitch" element={<LivePitchPage />} />
                <Route path="/leader" element={<LeaderPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/bidding" element={<BiddingPage />} />
                <Route path="/deal-desk" element={<DealDeskPage />} />
                <Route path="/contract" element={<ContractPage />} />

                {/* 默认重定向 */}
                <Route path="/" element={<Navigate to="/sandbox" replace />} />
                <Route path="*" element={<Navigate to="/sandbox" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </GlobalParamsProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
