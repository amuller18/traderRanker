import { fetchAllTrades } from "@/app/actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import { BacktestClientPage } from "./client-page"
import type { Trade } from "@/lib/trader-data"

export const dynamic = "force-dynamic"

export default async function BacktestPage() {
  let trades: Trade[] = []

  try {
    trades = await fetchAllTrades()
  } catch (error) {
    console.error("Error fetching trades:", error)
    // Continue with empty trades array
  }

  return (
    <div className="container mx-auto py-8">
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