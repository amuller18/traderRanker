import type { TradeFilterOptions } from "@/lib/trader-data"
import { ClientPage } from "./client-page"
import { PageLayout } from "@/app/components/page-layout"

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
    <PageLayout
      title="All Trades"
      description="View and analyze all trading activity across all traders on the platform with advanced filtering and search capabilities."
    >
      <ClientPage initialTrades={[]} defaultFilters={defaultFilters} />
    </PageLayout>
  )
}

