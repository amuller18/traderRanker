import type { ReactNode } from "react"
import { WalletProvider } from "@/lib/wallet-context"
import Script from "next/script"

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

