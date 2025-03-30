import type { ReactNode } from "react"
import { PageHeader } from "../page-header"

export default function TradesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}

