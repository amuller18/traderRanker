"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TraderStats } from "@/lib/dynamodb-client"
import { BarChart, LineChart, PieChart } from "lucide-react"

interface PerformanceMetricsProps {
  trader: TraderStats
}

export function PerformanceMetrics({ trader }: PerformanceMetricsProps) {
  // Calculate risk score (simple algorithm based on win rate and ROI)
  const calculateRiskScore = (winRate: number, roi: number) => {
    const winRateScore = winRate * 5 // 0-5 points
    const roiScore = Math.min(Math.max(roi, -1), 5) // -1 to 5 points
    const totalScore = winRateScore + roiScore

    if (totalScore >= 8) return { grade: "A+", color: "text-green-500" }
    if (totalScore >= 7) return { grade: "A", color: "text-green-500" }
    if (totalScore >= 6) return { grade: "A-", color: "text-green-400" }
    if (totalScore >= 5) return { grade: "B+", color: "text-green-400" }
    if (totalScore >= 4) return { grade: "B", color: "text-yellow-500" }
    if (totalScore >= 3) return { grade: "B-", color: "text-yellow-500" }
    if (totalScore >= 2) return { grade: "C+", color: "text-yellow-400" }
    if (totalScore >= 1) return { grade: "C", color: "text-orange-400" }
    if (totalScore >= 0) return { grade: "C-", color: "text-orange-500" }
    if (totalScore >= -1) return { grade: "D+", color: "text-red-400" }
    if (totalScore >= -2) return { grade: "D", color: "text-red-500" }
    return { grade: "F", color: "text-red-600" }
  }

  const riskScore = calculateRiskScore(trader.win_rate, trader.average_roi)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(trader.win_rate * 100).toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {trader.winning_calls} winning calls out of {trader.total_calls} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
          <LineChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${trader.average_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
            {(trader.average_roi * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">Average return on investment per trade</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${riskScore.color}`}>{riskScore.grade}</div>
          <p className="text-xs text-muted-foreground">Based on win rate and ROI consistency</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{trader.total_calls}</div>
          <p className="text-xs text-muted-foreground">Total number of trading calls made</p>
        </CardContent>
      </Card>
    </div>
  )
}

