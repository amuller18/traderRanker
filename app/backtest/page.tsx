import { fetchAllTradesFiltered } from "@/app/actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { BacktestClientPage } from "./client-page"

export const dynamic = "force-dynamic"

export default async function BacktestPage() {
  let trades = []
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()

    // Fetch all trades for backtesting
    trades = await fetchAllTradesFiltered({
      roiRange: [-Infinity, Infinity],
      marketCapRange: [0, 1e12],
      dateRange: [new Date(0), new Date()],
    })
    console.log(`Loaded ${trades.length} trades for backtesting (using ${usingMockData ? "mock" : "real"} data)`)
  } catch (error) {
    console.error("Error loading trades for backtesting:", error)
    // Continue with empty array, the client component will handle it
  }

  return (
    <div className="container py-8">
      <DataSourceStatus usingMockData={usingMockData} />

      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Strategy Backtesting</h1>
        <p className="text-muted-foreground">
          Test different trading strategies against historical trade data to find the most profitable approach.
        </p>
      </div>

      <BacktestClientPage initialTrades={trades} />
    </div>
  )
} 