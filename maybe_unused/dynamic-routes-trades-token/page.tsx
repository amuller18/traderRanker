import { fetchAllTradesFiltered } from "@/lib/api-client"
import { isUsingMockData } from "@/lib/trader-data"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Clock, DollarSign, Users } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { formatDistanceToNow, format } from "date-fns"

// Disable dynamic params for static export
export const dynamicParams = false

// Return empty array to not pre-generate any pages
export function generateStaticParams(): { token: string }[] {
  return []
}

interface TokenDetailPageProps {
  params: {
    token: string
  }
}

export default async function TokenDetailPage({ params }: TokenDetailPageProps) {
  const tokenAddress = decodeURIComponent(params.token)
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    // Continue with assumption of mock data
  }

  // Fetch all trades for this token
  const trades = await fetchAllTradesFiltered({
    roiRange: [-10, 10],
    marketCapRange: [0, 1000000000],
    dateRange: [new Date(0), new Date()],
    searchTerm: tokenAddress,
  })

  // If no trades found, return 404
  if (trades.length === 0) {
    notFound()
  }

  // Get the first trade for token info
  const tokenTrade = trades[0]

  // Fetch current market cap data for this token (same as token-analysis page)
  let currentMc = 0
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/bulk-token-prices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ tokens: [tokenAddress] })
      }
    )

    if (response.ok) {
      const results = await response.json()
      const tokenResult = results.find((r: any) => r.token === tokenAddress)
      if (tokenResult && !tokenResult.error) {
        currentMc = tokenResult.market_cap || 0
      }
    }
  } catch (error) {
    console.error("Error fetching current market cap:", error)
  }

  // Calculate ROI function (same logic as token-analysis page)
  const calculateRoi = (initialMc: number) => {
    if (!initialMc || !currentMc) return 0
    if (currentMc < 10000) {
      const rawRoi = ((currentMc - initialMc) / initialMc) * 100
      return Math.min(rawRoi, 1000)
    }
    return ((currentMc - initialMc) / initialMc) * 100
  }

  // Calculate stats using current market cap
  const rois = trades.map(t => calculateRoi(t.initial_mc))
  const highestRoi = rois.length > 0 ? Math.max(...rois) : 0
  const lowestRoi = rois.length > 0 ? Math.min(...rois) : 0
  const averageRoi = rois.length > 0 ? rois.reduce((sum, roi) => sum + roi, 0) / rois.length : 0
  const totalTraders = new Set(trades.map((t) => t.caller)).size
  const firstTradeDate = new Date(Math.min(...trades.map((t) => new Date(t.date_called).getTime())))
  const lastTradeDate = new Date(Math.max(...trades.map((t) => new Date(t.date_called).getTime())))

  // Format market cap
  const formatMarketCap = (mc: number) => {
    if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(2)}K`
    return `$${mc.toFixed(2)}`
  }

  // Get performance class
  const getPerformanceClass = (roi: number) => {
    if (roi >= 1) return "text-green-500 font-medium"
    if (roi >= 0) return "text-green-400"
    if (roi >= -0.5) return "text-orange-400"
    return "text-red-500"
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <Link href="/trades">
          <Button variant="ghost" className="gap-2 pl-0">
            <ArrowLeft className="h-4 w-4" />
            Back to Trades
          </Button>
        </Link>
      </div>

      <DataSourceStatus usingMockData={usingMockData} />

      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Token Details</h1>
          <a href={`https://solscan.io/token/${tokenAddress}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              View on Solscan <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
        <p className="text-muted-foreground break-all">{tokenAddress}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Market Cap</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMarketCap(currentMc)}</div>
            <p className="text-xs text-muted-foreground">Initial: {formatMarketCap(tokenTrade.initial_mc)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
            {averageRoi >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceClass(averageRoi)}`}>
              {averageRoi.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across {trades.length} trades by {totalTraders} traders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceClass(highestRoi)}`}>
              {highestRoi.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Lowest: {lowestRoi.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First Called</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDistanceToNow(firstTradeDate, { addSuffix: true })}</div>
            <p className="text-xs text-muted-foreground">{format(firstTradeDate, "MMM d, yyyy")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Price History</CardTitle>
            <CardDescription>Token price movement since first call</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <iframe 
              width="100%" 
              height="600" 
              src="https://birdeye.so/tv-widget/CniPCE4b3s8gSUPhUiyMjXnytrEqUrMfSsnbBjLCpump?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=America%2FDenver&chartLeftToolbar=show&theme=dark" 
              frameBorder="0">
            </iframe>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trader Distribution</CardTitle>
            <CardDescription>Traders who called this token</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(new Set(trades.map((t) => t.caller))).map((trader) => {
                const traderTrades = trades.filter((t) => t.caller === trader)
                const avgRoi = traderTrades.reduce((sum, t) => sum + calculateRoi(t.initial_mc), 0) / traderTrades.length

                return (
                  <div key={trader} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <Link href={`/rankings/${encodeURIComponent(trader)}`} className="hover:underline">
                        {trader}
                      </Link>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{traderTrades.length} calls</span>
                      <span className={getPerformanceClass(avgRoi)}>{avgRoi.toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>All trades for this token</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Trader</th>
                  <th className="p-3 text-left font-medium">Initial MC</th>
                  <th className="p-3 text-left font-medium">Current MC</th>
                  <th className="p-3 text-left font-medium">ROI</th>
                  <th className="p-3 text-left font-medium">High ROI</th>
                  <th className="p-3 text-left font-medium">Low ROI</th>
                  <th className="p-3 text-left font-medium">Profit at High</th>
                  <th className="p-3 text-left font-medium">Profit at Low</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => {
                  const roi = calculateRoi(trade.initial_mc)
                  return (
                    <tr key={i} className="border-b">
                      <td className="p-3">{format(new Date(trade.date_called), "MMM d, yyyy")}</td>
                      <td className="p-3">
                        <Link
                          href={`/rankings/${encodeURIComponent(trade.caller)}`}
                          className="hover:underline text-primary"
                        >
                          {trade.caller}
                        </Link>
                      </td>
                      <td className="p-3">{formatMarketCap(trade.initial_mc)}</td>
                      <td className="p-3">{formatMarketCap(currentMc)}</td>
                      <td className={`p-3 ${getPerformanceClass(roi)}`}>{roi.toFixed(1)}%</td>
                      <td className={`p-3 ${getPerformanceClass(trade.roi_at_high * 100)}`}>
                        {(trade.roi_at_high * 100).toFixed(1)}%
                      </td>
                      <td className={`p-3 ${getPerformanceClass(trade.roi_at_low * 100)}`}>
                        {(trade.roi_at_low * 100).toFixed(1)}%
                      </td>
                      <td className="p-3">{formatMarketCap(trade.high_mc - trade.initial_mc)}</td>
                      <td className="p-3">{formatMarketCap(trade.low_mc - trade.initial_mc)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

