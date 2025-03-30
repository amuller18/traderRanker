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

export const dynamic = "force-dynamic"
export const revalidate = 0 // Don't cache this page

interface TraderDetailPageProps {
  params: {
    trader: string
  }
}

export default async function TraderDetailPage({ params }: TraderDetailPageProps) {
  const traderId = decodeURIComponent(params.trader)
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    // Continue with assumption of mock data
  }

  // Fetch trader stats and trades
  const traders = await fetchTraderStats({
    winRateRange: [-100, 100],
    totalCallsRange: [0, 1000000],
    roiRange: [-100, 100],
    searchTerm: traderId,
  })

  const trader = traders.find((t) => t.caller === traderId)

  if (!trader) {
    notFound()
  }

  const trades = await fetchTraderTrades(traderId)

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
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Trade History</h2>
          <p className="text-muted-foreground">Recent trading activity and performance</p>
          <TraderTrades trades={trades} />
        </div>
      </div>
    </div>
  )
}

