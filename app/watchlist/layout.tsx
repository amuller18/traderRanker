import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Watchlist | TraderRanker",
  description: "Track your favorite traders and tokens. Build your personalized watchlist to monitor performance and get alerts.",
  openGraph: {
    title: "Watchlist | TraderRanker",
    description: "Track your favorite traders and tokens. Build your personalized watchlist to monitor performance and get alerts.",
  },
}

export default function WatchlistLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
