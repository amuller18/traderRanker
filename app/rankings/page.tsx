import { Suspense } from "react"
import { TraderRankings } from "./components/trader-rankings"
import { TraderRankingsSkeleton } from "./components/trader-rankings-skeleton"
import { PageLayout } from "@/app/components/page-layout"
import { fetchTraderStats, fetchTraderTrades } from "@/lib/api-client"
import { isUsingMockData } from "@/lib/trader-data"
import { PerformanceMetrics } from "./components/performance-metrics"
import { MarketCapPerformance } from "./components/market-cap-performance"
import { TraderTrades } from "./components/trader-trades"
import { BulkPriceUpdateButton } from "./components/bulk-price-update-button"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { DataSourceStatus } from "@/app/components/data-source-status"
import Link from "next/link"
import { notFound } from "next/navigation"

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
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    // Continue with assumption of mock data
  }

  // Fetch trader stats from API
  const allTraders = await fetchTraderStats()

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
      console.log(`Found case-insensitive match: "${caseInsensitiveMatch.caller}"`)
      trader = caseInsensitiveMatch
    } else {
      notFound()
    }
  }

  console.log(`📊 Loading trader profile: ${traderId}`)
  console.log(`📈 Total calls: ${trader.total_calls}, Page: ${page}`)

  // Calculate pagination
  const totalTrades = trader.total_calls
  const totalPages = Math.ceil(totalTrades / pageSize)
  const offset = (page - 1) * pageSize

  console.log(`📄 Fetching trades: limit=${pageSize}, offset=${offset}`)

  // Fetch only the trades for the current page
  const paginatedTrades = await fetchTraderTrades(traderId, {
    limit: pageSize,
    offset: offset
  })

  console.log(`✅ Fetched ${paginatedTrades.length} trades for page ${page}`)

  if (paginatedTrades.length === 0 && page === 1) {
    console.error(`No trades found for trader ${traderId}`)
    notFound()
  }

  const startIndex = offset
  const endIndex = startIndex + paginatedTrades.length

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
          
          {/* Trade History */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center justify-end gap-3">
              <span className="text-sm text-muted-foreground font-medium">
                Showing {startIndex + 1}-{Math.min(endIndex, totalTrades)} of {totalTrades} trades
              </span>
              <BulkPriceUpdateButton traderId={traderId} totalTrades={totalTrades} />
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

