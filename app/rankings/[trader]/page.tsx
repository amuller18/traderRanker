import { fetchTraderStats, fetchTraderTrades } from "@/app/actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import { PerformanceMetrics } from "../components/performance-metrics"
import { MarketCapPerformance } from "../components/market-cap-performance"
import { TraderTrades } from "../components/trader-trades"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { DataSourceStatus } from "@/app/components/data-source-status"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Trade } from "@/lib/trader-data"

export const dynamic = "force-dynamic"

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

  // Calculate trader stats from trades
  const total_calls = allTrades.length
  const winning_calls = allTrades.filter(trade => trade.roi_at_high > 0).length
  const win_rate = total_calls > 0 ? winning_calls / total_calls : 0
  const average_roi = total_calls > 0 ? allTrades.reduce((sum, trade) => sum + trade.roi_at_high, 0) / total_calls : 0

  // Calculate market cap performance
  const microCapTrades = allTrades.filter(trade => trade.initial_mc < 1_000_000)
  const smallCapTrades = allTrades.filter(trade => trade.initial_mc >= 1_000_000 && trade.initial_mc < 10_000_000)
  const midCapTrades = allTrades.filter(trade => trade.initial_mc >= 10_000_000 && trade.initial_mc < 100_000_000)
  const largeCapTrades = allTrades.filter(trade => trade.initial_mc >= 100_000_000 && trade.initial_mc < 1_000_000_000)
  const megaCapTrades = allTrades.filter(trade => trade.initial_mc >= 1_000_000_000)

  const calculateCapStats = (capTrades: Trade[]) => {
    if (capTrades.length === 0) return { roi: 0, winrate: 0 }
    const roi = capTrades.reduce((sum, trade) => sum + trade.roi_at_high, 0) / capTrades.length
    const winrate = capTrades.filter(trade => trade.roi_at_high > 0).length / capTrades.length
    return { roi, winrate }
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
    <div className="container py-8">
      <div className="mb-8">
        <Link href="/rankings">
          <Button variant="ghost" className="gap-2 pl-0">
            <ArrowLeft className="h-4 w-4" />
            Back to Rankings
          </Button>
        </Link>
      </div>

      <DataSourceStatus usingMockData={usingMockData} />

      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{trader.caller}</h1>
        <p className="text-muted-foreground">Detailed performance analysis and trade history</p>
      </div>

      <div className="space-y-8">
        <PerformanceMetrics trader={trader} />

        <div className="grid gap-8 md:grid-cols-2">
          <MarketCapPerformance trader={trader} />

          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Performance Summary</h2>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Win Rate</div>
                  <div className="text-2xl font-bold">{(trader.win_rate * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Calls</div>
                  <div className="text-2xl font-bold">{trader.total_calls}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Winning Calls</div>
                  <div className="text-2xl font-bold">{trader.winning_calls}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Average ROI</div>
                  <div className={`text-2xl font-bold ${trader.average_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(trader.average_roi * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Micro Cap ROI</div>
                  <div className={`text-2xl font-bold ${trader.micro_cap_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(trader.micro_cap_roi * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Small Cap ROI</div>
                  <div className={`text-2xl font-bold ${trader.small_cap_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(trader.small_cap_roi * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Mid Cap ROI</div>
                  <div className={`text-2xl font-bold ${trader.mid_cap_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(trader.mid_cap_roi * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Large Cap ROI</div>
                  <div className={`text-2xl font-bold ${trader.large_cap_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(trader.large_cap_roi * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Mega Cap ROI</div>
                  <div className={`text-2xl font-bold ${trader.mega_cap_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(trader.mega_cap_roi * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Trade History</h2>
              <p className="text-muted-foreground">Recent trading activity and performance</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, totalTrades)} of {totalTrades} trades
              </span>
            </div>
          </div>
          <TraderTrades 
            trades={paginatedTrades} 
            currentPage={page}
            totalPages={totalPages}
            totalTrades={totalTrades}
          />
        </div>
      </div>
    </div>
  )
}

