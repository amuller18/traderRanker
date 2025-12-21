"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TraderStats, Trade } from "@/lib/trader-data"
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Zap,
  BarChart3,
  Percent,
  ArrowLeft,
  Clock,
  Calendar,
  Award,
  AlertTriangle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TraderDetailDashboardProps {
  trader: TraderStats
  trades?: Trade[]
}

// Utility function to format numbers with appropriate precision
function formatNumber(value: number, decimals: number = 2): string {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + "M"
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + "K"
  }
  return value.toFixed(decimals)
}

// Utility function to format percentage
function formatPercent(value: number, decimals: number = 1): string {
  return value.toFixed(decimals) + "%"
}

// Get color class based on value (positive/negative)
function getValueColor(value: number): string {
  if (value > 0) return "text-green-500"
  if (value < 0) return "text-red-500"
  return "text-muted-foreground"
}

// Get background color class for cards based on value
function getValueBgColor(value: number): string {
  if (value > 0) return "bg-green-500/10 border-green-500/20"
  if (value < 0) return "bg-red-500/10 border-red-500/20"
  return "bg-muted/50"
}

// Get progress bar color based on percentage
function getProgressColor(percent: number): string {
  if (percent >= 50) return "bg-green-500"
  if (percent >= 25) return "bg-yellow-500"
  if (percent >= 10) return "bg-orange-500"
  return "bg-red-500"
}

// Calculate grade based on overall performance
function calculateGrade(trader: TraderStats): { grade: string; color: string } {
  const winRate = trader.win_rate_pct || 0
  const roi = trader.mean_ath_roi_pct || 0
  const sharpe = trader.sharpe_ratio || 0

  // Weighted score calculation
  const winRateScore = Math.min(winRate / 10, 6) // max 6 points
  const roiScore = Math.min(Math.max((roi + 100) / 50, 0), 4) // max 4 points
  const sharpeScore = Math.min(Math.max(sharpe, 0), 2) // max 2 points

  const totalScore = winRateScore + roiScore + sharpeScore

  if (totalScore >= 10) return { grade: "A+", color: "text-green-500 bg-green-500/10" }
  if (totalScore >= 9) return { grade: "A", color: "text-green-500 bg-green-500/10" }
  if (totalScore >= 8) return { grade: "A-", color: "text-green-400 bg-green-400/10" }
  if (totalScore >= 7) return { grade: "B+", color: "text-green-400 bg-green-400/10" }
  if (totalScore >= 6) return { grade: "B", color: "text-yellow-500 bg-yellow-500/10" }
  if (totalScore >= 5) return { grade: "B-", color: "text-yellow-500 bg-yellow-500/10" }
  if (totalScore >= 4) return { grade: "C+", color: "text-yellow-400 bg-yellow-400/10" }
  if (totalScore >= 3) return { grade: "C", color: "text-orange-400 bg-orange-400/10" }
  if (totalScore >= 2) return { grade: "C-", color: "text-orange-500 bg-orange-500/10" }
  if (totalScore >= 1) return { grade: "D", color: "text-red-400 bg-red-400/10" }
  return { grade: "F", color: "text-red-600 bg-red-600/10" }
}

// Calculate average gain and loss from trades
function calculateAvgGainLoss(trades: Trade[]): { avgGain: number; avgLoss: number } {
  if (!trades || trades.length === 0) {
    return { avgGain: 0, avgLoss: 0 }
  }

  const wins = trades.filter(t => t.roi_at_high > 0)
  const losses = trades.filter(t => t.roi_at_high <= 0)

  const avgGain = wins.length > 0
    ? wins.reduce((sum, t) => sum + t.roi_at_high, 0) / wins.length
    : 0
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, t) => sum + t.roi_at_high, 0) / losses.length)
    : 0

  return { avgGain, avgLoss }
}

// Format date to readable string
function formatDate(dateString: string): string {
  if (!dateString) return "N/A"
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return "N/A"
  }
}

export function TraderDetailDashboard({ trader, trades = [] }: TraderDetailDashboardProps) {
  const gradeInfo = calculateGrade(trader)
  const { avgGain, avgLoss } = calculateAvgGainLoss(trades)

  const totalCalls = trader.n_calls || trader.total_calls || 0
  const winRatePct = trader.win_rate_pct || 0
  const meanRoiPct = trader.mean_ath_roi_pct || 0
  const evPct = trader.ev || 0
  const sharpeRatio = trader.sharpe_ratio || 0
  const maxDrawdown = trader.max_drawdown_pct || 0
  const consistencyScore = trader.consistency_score || 0

  // Hit rate percentages for the performance quality section
  const hitRates = [
    { label: "2x Rate", value: trader.hit_2x_pct || 0, description: "Trades that hit 2x" },
    { label: "5x Rate", value: trader.hit_5x_pct || 0, description: "Trades that hit 5x" },
    { label: "10x Rate", value: trader.hit_10x_pct || 0, description: "Trades that hit 10x" },
    { label: "20x Rate", value: trader.hit_20x_pct || 0, description: "Trades that hit 20x" },
    { label: "50x Rate", value: trader.hit_50x_pct || 0, description: "Trades that hit 50x" },
    { label: "100x Rate", value: trader.hit_100x_pct || 0, description: "Trades that hit 100x" },
  ]

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/rankings">
            <ArrowLeft className="h-4 w-4" />
            Back to Rankings
          </Link>
        </Button>
      </div>

      {/* Hero Header Card */}
      <Card className="overflow-hidden border-0 shadow-elevated-lg bg-gradient-to-br from-card via-card to-muted/30">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Trader Info */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight break-all">
                  {trader.caller}
                </h1>
                <Badge className={`text-sm font-bold px-3 py-1 ${gradeInfo.color}`}>
                  Grade: {gradeInfo.grade}
                </Badge>
              </div>

              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {/* ROI */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Mean ROI</p>
                  <div className="flex items-center gap-1">
                    {meanRoiPct >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-2xl font-bold ${getValueColor(meanRoiPct)}`}>
                      {formatPercent(meanRoiPct)}
                    </span>
                  </div>
                </div>

                {/* Win Rate */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Win Rate</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>A trade is counted as a win if it reaches 25% gain at any point</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{formatPercent(winRatePct)}</span>
                  </div>
                </div>

                {/* Expected Value */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Expected Value</p>
                  <div className="flex items-center gap-1">
                    <Zap className={`h-5 w-5 ${evPct >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                    <span className={`text-2xl font-bold ${getValueColor(evPct)}`}>
                      {formatPercent(evPct)}
                    </span>
                  </div>
                </div>

                {/* Total Trades */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Trades</p>
                  <div className="flex items-center gap-1">
                    <Activity className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{totalCalls}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Date Info */}
            <div className="flex flex-col gap-2 text-sm text-muted-foreground md:text-right">
              <div className="flex items-center gap-2 md:justify-end">
                <Calendar className="h-4 w-4" />
                <span>First call: {formatDate(trader.first_call_date)}</span>
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <Clock className="h-4 w-4" />
                <span>Last call: {formatDate(trader.last_call_date)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {/* Avg Gain */}
        <Card className="hover-lift transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Gain</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +{formatPercent(avgGain)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per winning trade</p>
          </CardContent>
        </Card>

        {/* Avg Loss */}
        <Card className="hover-lift transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Loss</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -{formatPercent(avgLoss)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per losing trade</p>
          </CardContent>
        </Card>

        {/* Sharpe Ratio */}
        <Card className="hover-lift transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sharpe Ratio</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${sharpeRatio >= 1 ? 'text-green-500' : sharpeRatio >= 0.5 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
              {sharpeRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Risk-adjusted return</p>
          </CardContent>
        </Card>

        {/* Max Drawdown */}
        <Card className="hover-lift transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Drawdown</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {formatPercent(maxDrawdown)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Largest decline</p>
          </CardContent>
        </Card>

        {/* Consistency Score */}
        <Card className="hover-lift transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consistency</CardTitle>
            <Award className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${consistencyScore >= 70 ? 'text-green-500' : consistencyScore >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
              {formatPercent(consistencyScore, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Performance stability</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Quality Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Performance Quality
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hit rate percentages for different return multipliers
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {hitRates.map((rate) => (
              <div key={rate.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{rate.label}</span>
                  <span className={`text-sm font-bold ${rate.value >= 10 ? 'text-green-500' : rate.value >= 5 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {formatPercent(rate.value)}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full transition-all duration-500 ease-out rounded-full ${getProgressColor(rate.value)}`}
                    style={{ width: `${Math.min(rate.value, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{rate.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Detailed Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="space-y-1 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Median ROI</p>
              <p className={`text-lg font-semibold ${getValueColor(trader.median_ath_roi_pct || 0)}`}>
                {formatPercent(trader.median_ath_roi_pct || 0)}
              </p>
            </div>
            <div className="space-y-1 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Best Trade</p>
              <p className="text-lg font-semibold text-green-500">
                {formatPercent(trader.best_roi_pct || 0)}
              </p>
            </div>
            <div className="space-y-1 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Worst Trade</p>
              <p className="text-lg font-semibold text-red-500">
                {formatPercent(trader.worst_roi_pct || 0)}
              </p>
            </div>
            <div className="space-y-1 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Sortino Ratio</p>
              <p className={`text-lg font-semibold ${(trader.sortino_ratio || 0) >= 1 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {(trader.sortino_ratio || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
