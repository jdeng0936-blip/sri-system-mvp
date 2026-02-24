import { useState, useEffect } from "react"
import {
    kpiCards as mockKpiCards,
    funnelStages as mockFunnelStages,
    collectionItems as mockCollectionItems,
    intelFeedItems as mockIntelFeedItems,
    type KpiCardData,
    type FunnelStage,
    type CollectionItem,
    type IntelFeedItem,
} from "@/data/mockData"
import { fetchKpi, fetchPipeline, fetchFeed } from "@/lib/apiClient"

interface DashboardData {
    readonly kpiCards: readonly KpiCardData[]
    readonly funnelStages: readonly FunnelStage[]
    readonly collectionItems: readonly CollectionItem[]
    readonly intelFeedItems: readonly IntelFeedItem[]
    readonly isLoading: boolean
    readonly isLive: boolean // true = API 数据, false = mock fallback
}

/**
 * Custom hook: API 优先 + mock 降级
 * 尝试从 FastAPI 后端获取真实数据，失败时自动 fallback 到 mock 数据。
 */
export function useDashboardData(): DashboardData {
    const [isLoading, setIsLoading] = useState(true)
    const [isLive, setIsLive] = useState(false)
    const [kpiCards, setKpiCards] = useState<readonly KpiCardData[]>(mockKpiCards)
    const [funnelStages, setFunnelStages] = useState<readonly FunnelStage[]>(mockFunnelStages)
    const [intelFeedItems, setIntelFeedItems] = useState<readonly IntelFeedItem[]>(mockIntelFeedItems)

    useEffect(() => {
        let cancelled = false

        async function loadData() {
            // Fire all 3 API calls in parallel
            const [kpiResult, pipelineResult, feedResult] = await Promise.all([
                fetchKpi(),
                fetchPipeline(),
                fetchFeed(),
            ])

            if (cancelled) return

            let anyLive = false

            if (kpiResult && kpiResult.length > 0) {
                setKpiCards(kpiResult)
                anyLive = true
            }

            if (pipelineResult && pipelineResult.length > 0) {
                setFunnelStages(pipelineResult)
                anyLive = true
            }

            if (feedResult && feedResult.length > 0) {
                setIntelFeedItems(feedResult)
                anyLive = true
            }

            setIsLive(anyLive)
            setIsLoading(false)
        }

        loadData()

        return () => {
            cancelled = true
        }
    }, [])

    return {
        kpiCards,
        funnelStages,
        collectionItems: mockCollectionItems, // 回款数据暂无 API，保留 mock
        intelFeedItems,
        isLoading,
        isLive,
    }
}
