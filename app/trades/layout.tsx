import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Trade Analysis | TraderRanker",
  description: "Analyze individual trades with detailed metrics. See entry/exit points, profits, and performance data.",
  openGraph: {
    title: "Trade Analysis | TraderRanker",
    description: "Analyze individual trades with detailed metrics. See entry/exit points, profits, and performance data.",
  },
}

export default function TradesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
    </div>
  )
}

