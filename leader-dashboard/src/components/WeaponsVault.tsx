/**
 * 💎 企业武器库 & 🛡️ 公章签章管理
 * 原版 app.py L317-381
 * - 企业公章上传 (PNG/JPG)
 * - VP个人签章上传
 * - 核心优势武器库 (增删)
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const DEFAULT_ADVANTAGES = [
    "唯一具备 C5-M 级防腐认证的大型成套设备",
    "主控芯片实现 100% 全国产化替代，无断供风险",
    "独家双核异构架构，单板故障秒级无缝切换",
]

export function WeaponsVault() {
    const [advantages, setAdvantages] = useState<string[]>(DEFAULT_ADVANTAGES)
    const [newAdv, setNewAdv] = useState("")
    const [, setOfficialSeal] = useState<File | null>(null)
    const [, setPersonalSign] = useState<File | null>(null)
    const [sealPreview, setSealPreview] = useState<string | null>(null)
    const [signPreview, setSignPreview] = useState<string | null>(null)

    function handleSealUpload(file: File | null) {
        setOfficialSeal(file)
        if (file) {
            const url = URL.createObjectURL(file)
            setSealPreview(url)
        }
    }

    function handleSignUpload(file: File | null) {
        setPersonalSign(file)
        if (file) {
            const url = URL.createObjectURL(file)
            setSignPreview(url)
        }
    }

    function handleAddAdv() {
        if (!newAdv.trim() || advantages.includes(newAdv.trim())) return
        setAdvantages(prev => [...prev, newAdv.trim()])
        setNewAdv("")
    }

    function handleRemoveAdv(idx: number) {
        setAdvantages(prev => prev.filter((_, i) => i !== idx))
    }

    const inputClass = "w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))]/50 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">💎 企业武器库 & 签章管理</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">WEAPONS VAULT — 核心差异化优势沉淀 / 电子公章与签章管理</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 💎 核心优势武器库 */}
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50 lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                💎 企业核心优势武器库
                                <Badge variant="outline" className="text-[9px]">控标弹药</Badge>
                            </CardTitle>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">沉淀和迭代公司的"绝活"，供前线控标打单时一键调取。</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-2">
                                {advantages.map((adv, i) => (
                                    <div key={i} className="flex items-center justify-between bg-[hsl(var(--background))]/50 rounded-md px-3 py-2">
                                        <span className="text-xs text-[hsl(var(--foreground))]">🛡️ {adv}</span>
                                        <button onClick={() => handleRemoveAdv(i)} className="text-[10px] text-red-400 hover:text-red-300 ml-2">❌</button>
                                    </div>
                                ))}
                            </div>
                            <Separator className="bg-[hsl(var(--border))]/30" />
                            <div className="flex gap-2">
                                <textarea
                                    value={newAdv}
                                    onChange={e => setNewAdv(e.target.value)}
                                    placeholder="➕ 录入新优势/绝活：输入新的技术壁垒..."
                                    className={`${inputClass} resize-none`}
                                    rows={2}
                                />
                                <Button variant="default" size="sm" className="text-xs self-end" onClick={handleAddAdv}>💾 入库</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 🔴 企业公章 */}
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardHeader>
                            <CardTitle className="text-sm">🔴 企业法定公章</CardTitle>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">建议上传透明背景的 PNG 格式图片</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <input
                                type="file"
                                accept=".png,.jpg,.jpeg"
                                onChange={e => handleSealUpload(e.target.files?.[0] || null)}
                                className="text-xs text-[hsl(var(--muted-foreground))]"
                            />
                            {sealPreview && (
                                <div className="text-center">
                                    <img src={sealPreview} alt="企业公章" className="max-w-[120px] mx-auto rounded" />
                                    <p className="text-[10px] text-emerald-400 mt-1">✅ 公章已入库</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ✍️ 个人签章 */}
                    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]/50">
                        <CardHeader>
                            <CardTitle className="text-sm">✍️ 审批人个人签章</CardTitle>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">VP/审批人手写签名 (PNG/JPG)</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <input
                                type="file"
                                accept=".png,.jpg,.jpeg"
                                onChange={e => handleSignUpload(e.target.files?.[0] || null)}
                                className="text-xs text-[hsl(var(--muted-foreground))]"
                            />
                            {signPreview && (
                                <div className="text-center">
                                    <img src={signPreview} alt="个人签章" className="max-w-[120px] mx-auto rounded" />
                                    <p className="text-[10px] text-emerald-400 mt-1">✅ 签章已入库</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
