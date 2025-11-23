import { Suspense } from "react"
import { TraderRankings } from "./components/trader-rankings"
import { TraderRankingsSkeleton } from "./components/trader-rankings-skeleton"
import { PageLayout } from "@/app/components/page-layout"

export const metadata = {
  title: "Trader Rankings | Trader Ranker",
  description: "View the top traders and their performance metrics",
}

export default function RankingsPage() {
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

