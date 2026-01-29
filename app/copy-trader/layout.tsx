import type { ReactNode } from "react"
import type { Metadata } from "next"
import { PageHeader } from "../page-header"

export const metadata: Metadata = {
  title: "Copy Trading | TraderRanker",
  description: "Automatically copy trades from top-performing Solana traders. Set your risk, pick your traders, and let it run.",
  openGraph: {
    title: "Copy Trading | TraderRanker",
    description: "Automatically copy trades from top-performing Solana traders. Set your risk, pick your traders, and let it run.",
  },
}

export default function CopyTraderLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}

