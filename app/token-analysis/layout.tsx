import type { ReactNode } from "react"
import { PageHeader } from "../page-header"
import { WalletProvider } from "@/lib/wallet-context"

export default function TokenAnalysisLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader />
      <WalletProvider>
        <main className="flex-1">{children}</main>
      </WalletProvider>
    </div>
  )
}

