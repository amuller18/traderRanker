import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export function PageHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">TraderRanker</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/rankings" className="transition-colors hover:text-foreground/80">
              Rankings
            </Link>
            <Link href="/trades" className="transition-colors hover:text-foreground/80">
              Trades
            </Link>
            <Link href="/token-analysis" className="transition-colors hover:text-foreground/80">
              Token Analysis
            </Link>
            <Link href="/copy-trader" className="transition-colors hover:text-foreground/80">
              Copy Trading
            </Link>
            <Link href="/backtest" className="transition-colors hover:text-foreground/80">
              Backtesting
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}

