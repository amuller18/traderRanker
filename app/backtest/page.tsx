import BacktestClientPage from "./client-page"
import { PageHeader } from "@/app/page-header"

export default function BacktestPage() {
  return (
    <div>
      <PageHeader />
      <div className="min-h-screen gradient-background">
        <div className="container mx-auto py-10 px-4">
          <div className="flex flex-col gap-3 mb-10 animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight text-gradient">Strategy Backtesting</h1>
            <p className="text-muted-foreground text-lg">
              Test different trading strategies against historical trade data to find the most profitable approach with comprehensive analytics.
            </p>
          </div>

          <BacktestClientPage initialTrades={[]} />
        </div>
      </div>
    </div>
  )
} 