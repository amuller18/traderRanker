import { isUsingMockData } from "@/lib/trader-data"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { TokenSearch } from "@/app/components/token-search"

export const dynamic = "force-dynamic"
export const revalidate = 0 // Don't cache this page

export default async function TokenAnalysisPage() {
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    // Continue with assumption of mock data
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="container py-8">
        <DataSourceStatus usingMockData={usingMockData} />

      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Token Analysis</h1>
        <p className="text-muted-foreground">
          Search for any token by contract address to view detailed performance metrics and trading history.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <TokenSearch className="mb-8" />

        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Enter a Token Address</h2>
          <p className="text-muted-foreground">
            Enter a Solana token contract address above to view detailed analytics, trading history, and performance
            metrics.
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}

