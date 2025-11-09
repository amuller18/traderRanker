import { fetchTraderStats, fetchTraderTrades } from "@/app/actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import { PerformanceMetrics } from "../components/performance-metrics"
import { MarketCapPerformance } from "../components/market-cap-performance"
import { TraderTrades } from "../components/trader-trades"
import { BulkPriceUpdateButton } from "../components/bulk-price-update-button"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { DataSourceStatus } from "@/app/components/data-source-status"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Trade } from "@/lib/trader-data"

// Disable dynamic params for static export
export const dynamicParams = false

// Return empty array to not pre-generate any pages
export function generateStaticParams(): { trader: string }[] {
  return []
}

interface TraderDetailPageProps {
  params: {
    trader: string
  }
  searchParams: {
    page?: string
    pageSize?: string
  }
}

export default async function TraderDetailPage({ params, searchParams }: TraderDetailPageProps) {
  const traderId = decodeURIComponent(params.trader)
  const page = Number(searchParams.page) || 1
  const pageSize = Number(searchParams.pageSize) || 25
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    // Continue with assumption of mock data
  }

  // Fetch all trades for the trader
  const allTrades = await fetchTraderTrades(traderId)
  
  if (allTrades.length === 0) {
    notFound()
  }

  // Fetch current market data for all trades
  const tokenInfos = await Promise.all(
    allTrades.map(async (trade) => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/token-info?address=${trade.ca}`)
        if (response.ok) {
          const data = await response.json()
          return {
            token: trade.ca,
            marketInfo: data.marketInfo
          }
        }
      } catch (error) {
        console.error(`Error fetching token info for ${trade.ca}:`, error)
      }
      return {
        token: trade.ca,
        marketInfo: null
      }
    })
  )

  // Calculate trader stats from trades with current market data
  const total_calls = allTrades.length
  const winning_calls = allTrades.filter((trade, index) => {
    const tokenInfo = tokenInfos[index]
    if (!tokenInfo?.marketInfo) return false
    const currentMc = tokenInfo.marketInfo.fdv || 0
    return currentMc > trade.initial_mc
  }).length
  const win_rate = total_calls > 0 ? winning_calls / total_calls : 0

  // Calculate average ROI using current market data
  const average_roi = total_calls > 0 ? allTrades.reduce((sum, trade, index) => {
    const tokenInfo = tokenInfos[index]
    if (!tokenInfo?.marketInfo) return sum
    const currentMc = tokenInfo.marketInfo.fdv || 0
    const roi = ((currentMc - trade.initial_mc) / trade.initial_mc) * 100
    return sum + roi
  }, 0) / total_calls : 0

  // Calculate market cap performance
  const microCapTrades = allTrades.filter(trade => trade.initial_mc < 1_000_000)
  const smallCapTrades = allTrades.filter(trade => trade.initial_mc >= 1_000_000 && trade.initial_mc < 10_000_000)
  const midCapTrades = allTrades.filter(trade => trade.initial_mc >= 10_000_000 && trade.initial_mc < 100_000_000)
  const largeCapTrades = allTrades.filter(trade => trade.initial_mc >= 100_000_000 && trade.initial_mc < 1_000_000_000)
  const megaCapTrades = allTrades.filter(trade => trade.initial_mc >= 1_000_000_000)

  const calculateCapStats = (capTrades: Trade[]) => {
    if (capTrades.length === 0) return { roi: 0, winrate: 0 }
    
    let totalRoi = 0
    let winningTrades = 0
    
    capTrades.forEach((trade, index) => {
      const tokenInfo = tokenInfos[allTrades.indexOf(trade)]
      if (!tokenInfo?.marketInfo) return
      
      const currentMc = tokenInfo.marketInfo.fdv || 0
      const roi = ((currentMc - trade.initial_mc) / trade.initial_mc) * 100
      totalRoi += roi
      if (currentMc > trade.initial_mc) winningTrades++
    })
    
    return {
      roi: totalRoi / capTrades.length,
      winrate: winningTrades / capTrades.length
    }
  }

  const microCapStats = calculateCapStats(microCapTrades)
  const smallCapStats = calculateCapStats(smallCapTrades)
  const midCapStats = calculateCapStats(midCapTrades)
  const largeCapStats = calculateCapStats(largeCapTrades)
  const megaCapStats = calculateCapStats(megaCapTrades)

  const trader = {
    caller: traderId,
    total_calls,
    winning_calls,
    win_rate,
    average_roi,
    micro_cap_roi: microCapStats.roi,
    micro_cap_winrate: microCapStats.winrate,
    small_cap_roi: smallCapStats.roi,
    small_cap_winrate: smallCapStats.winrate,
    mid_cap_roi: midCapStats.roi,
    mid_cap_winrate: midCapStats.winrate,
    large_cap_roi: largeCapStats.roi,
    large_cap_winrate: largeCapStats.winrate,
    mega_cap_roi: megaCapStats.roi,
    mega_cap_winrate: megaCapStats.winrate,
  }
  
  // Calculate pagination
  const totalTrades = allTrades.length
  const totalPages = Math.ceil(totalTrades / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTrades = allTrades.slice(startIndex, endIndex)

  return (
    <div className="min-h-screen gradient-background">
      <div className="container py-10 px-4">
        <div className="mb-8 animate-fade-in">
          <Link href="/rankings">
            <Button variant="ghost" className="gap-2 pl-0 hover-lift mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Rankings
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2 text-gradient">{traderId}</h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive performance analysis and trading history
          </p>
        </div>

        <DataSourceStatus usingMockData={usingMockData} />

        <div className="space-y-8">
          {/* Performance Metrics */}
          <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <PerformanceMetrics trader={trader} />
          </div>

          {/* Market Cap Performance */}
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <MarketCapPerformance trader={trader} />
          </div>

          {/* Trade History */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Trade History</h2>
                <p className="text-muted-foreground">Recent trading activity and performance</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground font-medium">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalTrades)} of {totalTrades} trades
                </span>
                <BulkPriceUpdateButton traderId={traderId} totalTrades={totalTrades} />
              </div>
            </div>
            <TraderTrades
              trades={paginatedTrades}
              currentPage={page}
              totalPages={totalPages}
              totalTrades={totalTrades}
              traderName={traderId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

