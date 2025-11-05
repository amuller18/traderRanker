import { fetchAllTrades } from "@/app/actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import BacktestClientPage from "./client-page"
import { PageHeader } from "@/app/page-header"
import type { Trade } from "@/lib/trader-data"

export const dynamic = "force-dynamic"
export const revalidate = 300 // Cache for 5 minutes

export default async function BacktestPage() {
  let trades: Trade[] = []

  try {
    trades = await fetchAllTrades()
  } catch (error) {
    console.error("Error fetching trades:", error)
    // Continue with empty trades array
  }

  return (
    <div>
      <PageHeader />
      <div className="min-h-screen gradient-background">
        <div className="container mx-auto py-10 px-4">
          <div className="flex flex-col gap-3 mb-10 animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight text-gradient">Strategy Backtesting</h1>
            <p className="text-muted-foreground text-lg">
              Test different trading strategies against historical trade data to find the most profitable approach with comprehensive analytics.
            </p>
          </div>

          <BacktestClientPage initialTrades={trades} />
        </div>
      </div>
    </div>
  )
} 