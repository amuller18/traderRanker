import { Suspense } from "react"
import { TraderRankings } from "./components/trader-rankings"
import { TraderRankingsSkeleton } from "./components/trader-rankings-skeleton"
import { PageHeader } from "@/app/page-header"

export const metadata = {
  title: "Trader Rankings | Trader Ranker",
  description: "View the top traders and their performance metrics",
}

export default function RankingsPage() {
  return (
    <div>
      <PageHeader />
      <div className="min-h-screen gradient-background">
        <div className="container mx-auto py-10 px-4">
          <div className="mb-10 animate-fade-in">
            <h1 className="text-4xl font-bold mb-3 text-gradient">Trader Rankings</h1>
            <p className="text-muted-foreground text-lg">
              Discover top-performing traders and analyze their strategies with comprehensive performance metrics
            </p>
          </div>
          <Suspense fallback={<TraderRankingsSkeleton />}>
            <TraderRankings />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

