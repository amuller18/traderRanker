import { Suspense } from "react"
import { TraderRankings } from "./components/trader-rankings"
import { TraderRankingsSkeleton } from "./components/trader-rankings-skeleton"
import { PageLayout } from "@/app/components/page-layout"
import { fetchTraderStats, fetchTraderTrades } from "@/lib/api-client"
import { TraderTrades } from "./components/trader-trades"
import { TraderDetailDashboard } from "./components/trader-detail-dashboard"
import { BulkPriceUpdateButton } from "./components/bulk-price-update-button"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { notFound } from "next/navigation"
import { PageHeader } from "@/app/page-header";


export const metadata = {
  title: "Trader Rankings | Trader Ranker",
  description: "View the top traders and their performance metrics",
}

interface RankingsPageProps {
  searchParams: Promise<{
    trader?: string
    page?: string
    pageSize?: string
  }>
}

export default async function RankingsPage(props: RankingsPageProps) {
  const searchParams = await props.searchParams
  const traderParam = searchParams.trader

  // If no trader query param, show the rankings list
  if (!traderParam) {
    return (
      <PageLayout
        title="Trader Rankings"
        description="Discover top-performing traders and analyze their strategies with comprehensive performance metrics"
        className="mx-auto"
      >
        <Suspense fallback={<TraderRankingsSkeleton />}>
          <TraderRankings />
        </Suspense>
      </PageLayout>
    )
  }

  // Otherwise, show trader detail page
  // Note: searchParams are already decoded by Next.js, no need to decode again
  const traderId = traderParam
  const page = Number(searchParams.page) || 1
  const pageSize = 10 // Load 10 trades per page

  // Fetch trader stats from API (Pi backend)
  const allTraders = await fetchTraderStats()

  // Determine if using mock data based on API response
  const usingMockData = allTraders.length === 0

  // Deduplicate traders by caller (in case API returns duplicates)
  const uniqueTraders = allTraders.reduce((acc: any[], trader) => {
    if (!acc.find(t => t.caller === trader.caller)) {
      acc.push(trader)
    }
    return acc
  }, [])

  let trader = uniqueTraders.find(t => t.caller === traderId)

  if (!trader) {
    console.error(`Trader "${traderId}" not found in stats`)
    console.error(`Available traders (first 10):`, uniqueTraders.slice(0, 10).map(t => t.caller))
    console.error(`Looking for exact match with: "${traderId}"`)
    console.error(`Trader ID length: ${traderId.length}`)

    // Try case-insensitive match as fallback
    const caseInsensitiveMatch = uniqueTraders.find(t =>
      t.caller.toLowerCase() === traderId.toLowerCase()
    )

    if (caseInsensitiveMatch) {
      trader = caseInsensitiveMatch
    } else {
      notFound()
    }
  }

  // Calculate pagination
  const totalTrades = trader.total_calls
  const totalPages = Math.ceil(totalTrades / pageSize)
  const offset = (page - 1) * pageSize

  // Fetch only the trades for the current page
  const paginatedTrades = await fetchTraderTrades(traderId, {
    limit: pageSize,
    offset: offset
  })

  // Only throw notFound if trader stats don't exist AND no trades found
  // If trader has stats (total_calls > 0) but API returns no trades, show empty state instead
  if (paginatedTrades.length === 0 && page === 1 && trader.total_calls === 0) {
    console.error(`No trades found for trader ${traderId}`)
    notFound()
  }

  const startIndex = offset
  const endIndex = startIndex + paginatedTrades.length

  return (
    <div className="min-h-screen gradient-background">
      <div className="container py-10 px-4">
        <DataSourceStatus usingMockData={usingMockData} />

        <div className="space-y-8">
          <PageHeader/>

          {/* Trader Detail Dashboard */}
          <div className="animate-fade-in">
            <TraderDetailDashboard trader={trader} trades={paginatedTrades} />
          </div>

          {/* Trade History */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Trade History</h2>
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

