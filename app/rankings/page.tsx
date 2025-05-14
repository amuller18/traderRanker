import { Suspense } from "react"
import { getAllTrades } from "@/lib/trader-data"
import type { Trade } from "@/lib/trader-data"
import ClientPage from "./client-page"

export const dynamic = "force-dynamic"

export default async function RankingsPage() {
  // Fetch all trades for all traders
  const allTrades = await getAllTrades()
  
  // Group trades by trader
  const tradesByTrader = allTrades.reduce((acc: Record<string, Trade[]>, trade: Trade) => {
    if (!acc[trade.caller]) {
      acc[trade.caller] = []
    }
    acc[trade.caller].push(trade)
    return acc
  }, {})

  // Calculate stats for each trader
  const traders = Object.entries(tradesByTrader).map(([caller, trades]) => {
    const total_calls = trades.length
    const winning_calls = trades.filter(trade => trade.roi_at_high > 0).length
    const win_rate = total_calls > 0 ? winning_calls / total_calls : 0
    const average_roi = total_calls > 0 ? trades.reduce((sum: number, trade: Trade) => sum + trade.roi_at_high, 0) / total_calls : 0

    // Calculate market cap performance
    const microCapTrades = trades.filter(trade => trade.initial_mc < 1_000_000)
    const smallCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000 && trade.initial_mc < 10_000_000)
    const midCapTrades = trades.filter(trade => trade.initial_mc >= 10_000_000 && trade.initial_mc < 100_000_000)
    const largeCapTrades = trades.filter(trade => trade.initial_mc >= 100_000_000 && trade.initial_mc < 1_000_000_000)
    const megaCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000_000)

    const calculateCapStats = (capTrades: Trade[]) => {
      if (capTrades.length === 0) return { roi: 0, winrate: 0 }
      const roi = capTrades.reduce((sum: number, trade: Trade) => sum + trade.roi_at_high, 0) / capTrades.length
      const winrate = capTrades.filter(trade => trade.roi_at_high > 0).length / capTrades.length
      return { roi, winrate }
    }

    const microCapStats = calculateCapStats(microCapTrades)
    const smallCapStats = calculateCapStats(smallCapTrades)
    const midCapStats = calculateCapStats(midCapTrades)
    const largeCapStats = calculateCapStats(largeCapTrades)
    const megaCapStats = calculateCapStats(megaCapTrades)

    return {
      caller,
      total_calls,
      winning_calls,
      win_rate,
      average_roi,
      micro_cap_roi: microCapStats.roi,
      micro_cap_winrate: microCapStats.winrate,
      small_cap_roi: smallCapStats.roi,
      small_cap_winrate: smallCapStats.winrate,
      mid_cap_roi: midCapStats.roi,
      mid_cap_winrate: midCapStats.winrate,
      large_cap_roi: largeCapStats.roi,
      large_cap_winrate: largeCapStats.winrate,
      mega_cap_roi: megaCapStats.roi,
      mega_cap_winrate: megaCapStats.winrate,
    }
  })

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Trader Rankings</h1>
        <p className="text-muted-foreground">Top performers based on win rate and ROI</p>
      </div>

      <Suspense fallback={<div>Loading traders...</div>}>
        <ClientPage initialTraders={traders} />
      </Suspense>
    </div>
  )
}

