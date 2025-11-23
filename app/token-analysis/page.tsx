import { TokenSearch } from "@/app/components/token-search"
import { PageLayout } from "@/app/components/page-layout"

export default function TokenAnalysisPage() {
  return (
    <PageLayout
      title="Token Analysis"
      description="Search for any token by contract address to view detailed performance metrics and trading history."
    >
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
    </PageLayout>
  )
}

