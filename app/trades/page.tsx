import { isUsingMockData } from "@/lib/trader-data"
import type { TradeFilterOptions } from "@/lib/trader-data"
import { ClientPage } from "./client-page"
import { DataSourceStatus } from "@/app/components/data-source-status"

export const dynamic = "force-dynamic"
export const revalidate = 300 // Cache for 5 minutes

export default async function TradesPage() {
  // Default filters - set very wide ranges to ensure all trades are shown initially
  const defaultFilters: TradeFilterOptions = {
    roiRange: [-1000, 1000], // Much wider range to ensure we get all trades
    marketCapRange: [0, 1000000000],
    dateRange: [new Date(0), new Date()], // From beginning of time to now
    searchTerm: "",
    traderSearchTerm: "",
    timeframe: "all",
  }

  let trades = []
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()

    // Fetch trades directly from API endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const response = await fetch(`${apiUrl}/api/trades`, { cache: 'no-store' })
    
    if (response.ok) {
      trades = await response.json()
      console.log(`Loaded ${trades.length} trades for trades page (using ${usingMockData ? "mock" : "real"} data)`)
    } else {
      console.error("Failed to fetch trades from API:", response.status)
      // Continue with empty array, the client component will handle it
    }
  } catch (error) {
    console.error("Error loading trades for trades page:", error)
    // Continue with empty array, the client component will handle it
  }

  return (
    <div className="container py-8">
      <DataSourceStatus usingMockData={usingMockData} />

      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">All Trades</h1>
        <p className="text-muted-foreground">
          View and analyze all trading activity across all traders on the platform.
        </p>
      </div>

      <ClientPage initialTrades={trades} defaultFilters={defaultFilters} />
    </div>
  )
}

