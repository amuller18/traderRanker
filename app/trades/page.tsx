import type { TradeFilterOptions } from "@/lib/trader-data"
import { ClientPage } from "./client-page"
import { PageHeader } from "@/app/page-header"

export default function TradesPage() {
  // Default filters - set very wide ranges to ensure all trades are shown initially
  const defaultFilters: TradeFilterOptions = {
    roiRange: [-1000, 1000], // Much wider range to ensure we get all trades
    marketCapRange: [0, 1000000000],
    dateRange: [new Date(0), new Date()], // From beginning of time to now
    searchTerm: "",
    traderSearchTerm: "",
    timeframe: "all",
  }

  return (
    <div>
      <PageHeader />
      <div className="min-h-screen gradient-background">
        <div className="container py-10 px-4">

        <div className="flex flex-col gap-3 mb-10 animate-fade-in">
          <h1 className="text-4xl font-bold tracking-tight text-gradient">All Trades</h1>
          <p className="text-muted-foreground text-lg">
            View and analyze all trading activity across all traders on the platform with advanced filtering and search capabilities.
          </p>
        </div>

          <ClientPage initialTrades={[]} defaultFilters={defaultFilters} />
        </div>
      </div>
    </div>
  )
}

