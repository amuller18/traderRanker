"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TraderStats } from "@/lib/trader-data"
import { BarChart, LineChart, PieChart, TrendingUp } from "lucide-react"

interface PerformanceMetricsProps {
  trader: TraderStats
}

export function PerformanceMetrics({ trader }: PerformanceMetricsProps) {
  // Use new fields with backwards compatibility
  const winRatePct = trader.win_rate_pct ?? 0
  const meanAthRoiPct = trader.mean_ath_roi_pct ?? 0
  const evPct = trader.ev ?? 0
  const hit10xPct = trader.hit_10x_pct ?? 0
  const winRate = winRatePct / 100
  const avgRoi = meanAthRoiPct / 100
  const totalCalls = trader.n_calls || trader.total_calls || 0
  const winningCalls = Math.round((winRatePct / 100) * totalCalls)

  // Calculate risk score using new fields
  const calculateRiskScore = (winRatePct: number, roiPct: number) => {
    const winRate = winRatePct / 100
    const roi = roiPct / 100

    // Win rate contributes 60% to the score
    const winRateScore = winRate * 6 // 0-6 points

    // ROI contributes 40% to the score
    // Cap ROI at 200% to prevent extreme values from skewing the score
    const cappedRoi = Math.min(Math.max(roi, -1), 2)
    const roiScore = (cappedRoi + 1) * 2 // -1 to 2 ROI becomes 0 to 6 points

    const totalScore = winRateScore + roiScore

    if (totalScore >= 10) return { grade: "A+", color: "text-green-500" }
    if (totalScore >= 9) return { grade: "A", color: "text-green-500" }
    if (totalScore >= 8) return { grade: "A-", color: "text-green-400" }
    if (totalScore >= 7) return { grade: "B+", color: "text-green-400" }
    if (totalScore >= 6) return { grade: "B", color: "text-yellow-500" }
    if (totalScore >= 5) return { grade: "B-", color: "text-yellow-500" }
    if (totalScore >= 4) return { grade: "C+", color: "text-yellow-400" }
    if (totalScore >= 3) return { grade: "C", color: "text-orange-400" }
    if (totalScore >= 2) return { grade: "C-", color: "text-orange-500" }
    if (totalScore >= 1) return { grade: "D+", color: "text-red-400" }
    if (totalScore >= 0) return { grade: "D", color: "text-red-500" }
    return { grade: "F", color: "text-red-600" }
  }

  const riskScore = calculateRiskScore(winRatePct, meanAthRoiPct)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{winRatePct.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {winningCalls} winning calls out of {totalCalls} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mean ATH ROI</CardTitle>
          <LineChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${meanAthRoiPct >= 0 ? "text-green-500" : "text-red-500"}`}>
            {meanAthRoiPct.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">Average return at all-time high</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expected Value</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${evPct >= 0 ? "text-green-500" : "text-red-500"}`}>
            {evPct.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">Expected value per trade</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">10x Hit Rate</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{hit10xPct.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">Trades that hit 10x or more</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCalls}</div>
          <p className="text-xs text-muted-foreground">Total number of trading calls made</p>
        </CardContent>
      </Card>
    </div>
  )
}

