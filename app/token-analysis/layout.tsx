import type { ReactNode } from "react"
import type { Metadata } from "next"
import { WalletProvider } from "@/lib/wallet-context"
import Script from "next/script"

export const metadata: Metadata = {
  title: "Token Analysis | TraderRanker",
  description: "Deep dive into Solana tokens. Analyze price movements, trading volume, and holder activity.",
  openGraph: {
    title: "Token Analysis | TraderRanker",
    description: "Deep dive into Solana tokens. Analyze price movements, trading volume, and holder activity.",
  },
}

export default function TokenAnalysisLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script src="https://terminal.jup.ag/main-v4.js" strategy="lazyOnload" />
      <div className="flex min-h-screen flex-col">
        <WalletProvider>
          <main className="flex-1">{children}</main>
        </WalletProvider>
      </div>
    </>
  )
}

