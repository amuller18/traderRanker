import { Suspense } from "react"
import { TraderRankings } from "./components/trader-rankings"
import { TraderRankingsSkeleton } from "./components/trader-rankings-skeleton"

export const metadata = {
  title: "Trader Rankings | Trader Ranker",
  description: "View the top traders and their performance metrics",
}

export default function RankingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Trader Rankings</h1>
          <p className="text-muted-foreground">
            View the top traders and their performance metrics
          </p>
        </div>
        <Suspense fallback={<TraderRankingsSkeleton />}>
          <TraderRankings />
        </Suspense>
      </div>
    </div>
  )
}

