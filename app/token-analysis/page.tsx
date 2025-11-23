import { TokenSearch } from "@/app/components/token-search"
import { PageHeader } from "@/app/page-header"

export default function TokenAnalysisPage() {
  return (
    <div>
      <PageHeader />
      <div className="min-h-screen gradient-background">
        <div className="container py-10 px-4">

        <div className="flex flex-col gap-3 mb-10 animate-fade-in">
          <h1 className="text-4xl font-bold tracking-tight text-gradient">Token Analysis</h1>
          <p className="text-muted-foreground text-lg">
            Search for any token by contract address to view detailed performance metrics and trading history.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <TokenSearch className="mb-8" />

          <div className="glass-card rounded-2xl shadow-elevated p-10 text-center animate-fade-in">
            <h2 className="text-2xl font-bold mb-3">Enter a Token Address</h2>
            <p className="text-muted-foreground text-lg">
              Enter a Solana token contract address above to view detailed analytics, trading history, and performance
              metrics.
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

