import { fetchTraderStats } from "../actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import type { FilterOptions } from "@/lib/mock-data-provider"
import ClientPage from "./client-page"
import { DataSourceStatus } from "@/app/components/data-source-status"

export const dynamic = "force-dynamic"
export const revalidate = 0 // Don't cache this page

export default async function RankingsPage() {
  // Default filters
  const defaultFilters: FilterOptions = {
    winRateRange: [-100, 100],
    totalCallsRange: [0, 1000000],
    roiRange: [-100, 100],
    searchTerm: "",
  }

  let traders = []
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()

    // Fetch traders with default filters
    traders = await fetchTraderStats(defaultFilters)
    console.log("INITIAL API RESPONSE - Traders from API:", traders)
    console.log(`Loaded ${traders.length} traders for rankings page (using ${usingMockData ? "mock" : "real"} data)`)
  } catch (error) {
    console.error("Error loading traders for rankings page:", error)
    // Continue with empty array, the client component will handle it
  }

  return (
    <div className="container py-8">
      <DataSourceStatus usingMockData={usingMockData} />

      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Trader Rankings</h1>
        <p className="text-muted-foreground">
          Compare and analyze the performance of traders based on their on-chain trading activity.
        </p>
      </div>

      <ClientPage initialTraders={traders} defaultFilters={defaultFilters} />
    </div>
  )
}

