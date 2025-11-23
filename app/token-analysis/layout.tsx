import type { ReactNode } from "react"
import { WalletProvider } from "@/lib/wallet-context"

export default function TokenAnalysisLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <WalletProvider>
        <main className="flex-1">{children}</main>
      </WalletProvider>
    </div>
  )
}

