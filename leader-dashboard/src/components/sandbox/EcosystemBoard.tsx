/**
 * EcosystemBoard.tsx — 生态铁三角
 * =================================
 * 终端业主 · 设计院 · 总包方 — 横向 3 列语义色卡片
 */

import { Building2, Compass, HardHat } from "lucide-react"

interface EcosystemCardProps {
    icon: React.ReactNode
    label: string
    name: string
    contact?: string
    notes?: string
    bgClass: string
    borderClass: string
    iconColor: string
}

function EcosystemCard({
    icon,
    label,
    name,
    contact,
    notes,
    bgClass,
    borderClass,
    iconColor,
}: EcosystemCardProps) {
    return (
        <div
            className={`rounded-xl p-5 border ${bgClass} ${borderClass} transition-all hover:scale-[1.02] hover:shadow-lg`}
        >
            <div className="flex items-center gap-3 mb-3">
                <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}
                >
                    {icon}
                </div>
                <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                        {label}
                    </div>
                    <div className="text-sm font-bold text-white/90">
                        {name || "待录入"}
                    </div>
                </div>
            </div>

            {contact && (
                <div className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    联系人：{contact}
                </div>
            )}
            {notes && (
                <div className="text-xs text-white/40 leading-relaxed">{notes}</div>
            )}
            {!name && (
                <div className="text-xs text-white/20 italic mt-2">
                    暂无数据 — 请通过情报解析或手动录入
                </div>
            )}
        </div>
    )
}

interface EcosystemData {
    client?: string
    clientContact?: string
    clientNotes?: string
    designInstitute?: string
    designContact?: string
    designNotes?: string
    generalContractor?: string
    gcContact?: string
    gcNotes?: string
}

export function EcosystemBoard({ data }: { data: EcosystemData }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🔺</span>
                <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                    生态铁三角
                </h3>
                <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 终端业主 — 蓝色 */}
                <EcosystemCard
                    icon={<Building2 size={20} />}
                    label="终端业主"
                    name={data.client || ""}
                    contact={data.clientContact}
                    notes={data.clientNotes}
                    bgClass="bg-blue-500/5"
                    borderClass="border-blue-500/20 hover:border-blue-500/40"
                    iconColor="bg-blue-500/15 text-blue-400"
                />

                {/* 设计院 — 黄色 */}
                <EcosystemCard
                    icon={<Compass size={20} />}
                    label="设计院"
                    name={data.designInstitute || ""}
                    contact={data.designContact}
                    notes={data.designNotes}
                    bgClass="bg-yellow-500/5"
                    borderClass="border-yellow-500/20 hover:border-yellow-500/40"
                    iconColor="bg-yellow-500/15 text-yellow-400"
                />

                {/* 总包方 — 绿色 */}
                <EcosystemCard
                    icon={<HardHat size={20} />}
                    label="总包方"
                    name={data.generalContractor || ""}
                    contact={data.gcContact}
                    notes={data.gcNotes}
                    bgClass="bg-green-500/5"
                    borderClass="border-green-500/20 hover:border-green-500/40"
                    iconColor="bg-green-500/15 text-green-400"
                />
            </div>
        </div>
    )
}
