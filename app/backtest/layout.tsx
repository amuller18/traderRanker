import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Backtesting | TraderRanker",
  description: "Test trading strategies against historical Solana market data. Validate your approach before risking real capital.",
  openGraph: {
    title: "Backtesting | TraderRanker",
    description: "Test trading strategies against historical Solana market data. Validate your approach before risking real capital.",
  },
}

export default function BacktestLayout({ children }: { children: ReactNode }) {
  return children
}
