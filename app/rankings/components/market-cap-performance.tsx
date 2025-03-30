"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { TraderStats } from "@/lib/mock-data-provider"
import { Progress } from "@/components/ui/progress"

interface MarketCapPerformanceProps {
  trader: TraderStats
}

export function MarketCapPerformance({ trader }: MarketCapPerformanceProps) {
  const marketCaps = [
    { name: "Micro Cap", roi: trader.micro_cap_roi, winRate: trader.micro_cap_winrate, range: "< $1M" },
    { name: "Small Cap", roi: trader.small_cap_roi, winRate: trader.small_cap_winrate, range: "$1M - $5M" },
    { name: "Mid Cap", roi: trader.mid_cap_roi, winRate: trader.mid_cap_winrate, range: "$5M - $25M" },
    { name: "Large Cap", roi: trader.large_cap_roi, winRate: trader.large_cap_winrate, range: "$25M - $100M" },
    { name: "Mega Cap", roi: trader.mega_cap_roi, winRate: trader.mega_cap_winrate, range: "> $100M" },
  ]

  const getProgressColor = (value: number) => {
    if (value >= 0.7) return "bg-green-500"
    if (value >= 0.5) return "bg-green-400"
    if (value >= 0.3) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getRoiColor = (value: number) => {
    if (value >= 1) return "text-green-500"
    if (value >= 0) return "text-green-400"
    if (value >= -0.5) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Cap Performance</CardTitle>
        <CardDescription>Performance breakdown by market capitalization</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {marketCaps.map((cap) => (
            <div key={cap.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{cap.name}</div>
                  <div className="text-xs text-muted-foreground">{cap.range}</div>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${getRoiColor(cap.roi)}`}>{(cap.roi * 100).toFixed(1)}% ROI</div>
                  <div className="text-xs text-muted-foreground">{(cap.winRate * 100).toFixed(1)}% Win Rate</div>
                </div>
              </div>
              <Progress value={cap.winRate * 100} className={getProgressColor(cap.winRate)} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

