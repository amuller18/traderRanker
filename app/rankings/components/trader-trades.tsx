"use client"

import { useState, useEffect, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { Trade } from "@/lib/trader-data"
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { formatMarketCap, formatROI } from "@/lib/utils"
import type { TokenInfo } from "@/lib/token-data"

interface TraderTradesProps {
  trades: Trade[]
  currentPage: number
  totalPages: number
  totalTrades: number
  traderName: string
}

export function TraderTrades({ trades, currentPage, totalPages, totalTrades, traderName }: TraderTradesProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tokenInfos, setTokenInfos] = useState<Record<string, NonNullable<TokenInfo['marketInfo']>>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({})
  const [retryCount, setRetryCount] = useState(0)
  const fetchedTokensRef = useRef<Set<string>>(new Set())

  const getPerformanceClass = (roi: number) => {
    if (roi > 0) return "text-green-500"
    if (roi < 0) return "text-red-500"
    return "text-muted-foreground"
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`?${params.toString()}`)
  }

  // Fetch all token prices in one bulk request
  const fetchAllTokenPrices = async (tokenAddresses: string[]) => {
    if (tokenAddresses.length === 0) return

    try {
      console.log(`📊 Fetching prices for ${tokenAddresses.length} tokens in bulk...`)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/bulk-token-prices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({ tokens: tokenAddresses })
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch bulk prices: ${response.status}`)
      }

      const results = await response.json()
      console.log(`✅ Received ${results.length} price results`)

      // Update all token infos at once
      const newTokenInfos: Record<string, NonNullable<TokenInfo['marketInfo']>> = {}

      results.forEach((result: any) => {
        if (result.error) {
          console.warn(`⚠️ Error for token ${result.token}:`, result.error)
          setErrorStates(prev => ({ ...prev, [result.token]: true }))
        } else {
          newTokenInfos[result.token] = {
            fdv: result.market_cap,
            price: result.price,
            volume24h: 0,
            liquidity: 0
          }
          fetchedTokensRef.current.add(result.token)
        }
      })

      setTokenInfos(prev => ({ ...prev, ...newTokenInfos }))

    } catch (error) {
      console.error('Error fetching bulk token prices:', error)
      // Mark all tokens as failed
      tokenAddresses.forEach(token => {
        setErrorStates(prev => ({ ...prev, [token]: true }))
      })
    }
  }

  // Calculate performance stats
  const calculatePerformanceStats = () => {
    const stats = {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      totalRoi: 0,
      averageRoi: 0,
      marketCapPerformance: {
        micro: { count: 0, roi: 0, wins: 0 },
        small: { count: 0, roi: 0, wins: 0 },
        mid: { count: 0, roi: 0, wins: 0 },
        large: { count: 0, roi: 0, wins: 0 },
        mega: { count: 0, roi: 0, wins: 0 }
      }
    }

    trades.forEach(trade => {
      const currentMc = tokenInfos[trade.ca]?.fdv || trade.current_mc
      const roi = ((currentMc - trade.initial_mc) / trade.initial_mc) * 100

      if (!isNaN(roi)) {
        stats.totalRoi += roi
        if (roi > 0) stats.winningTrades++
        if (roi < 0) stats.losingTrades++

        // Categorize by market cap
        const initialMc = trade.initial_mc
        if (initialMc < 1_000_000) {
          stats.marketCapPerformance.micro.count++
          stats.marketCapPerformance.micro.roi += roi
          if (roi > 0) stats.marketCapPerformance.micro.wins++
        } else if (initialMc < 5_000_000) {
          stats.marketCapPerformance.small.count++
          stats.marketCapPerformance.small.roi += roi
          if (roi > 0) stats.marketCapPerformance.small.wins++
        } else if (initialMc < 25_000_000) {
          stats.marketCapPerformance.mid.count++
          stats.marketCapPerformance.mid.roi += roi
          if (roi > 0) stats.marketCapPerformance.mid.wins++
        } else if (initialMc < 100_000_000) {
          stats.marketCapPerformance.large.count++
          stats.marketCapPerformance.large.roi += roi
          if (roi > 0) stats.marketCapPerformance.large.wins++
        } else {
          stats.marketCapPerformance.mega.count++
          stats.marketCapPerformance.mega.roi += roi
          if (roi > 0) stats.marketCapPerformance.mega.wins++
        }
      }
    })

    // Calculate averages
    stats.averageRoi = stats.totalTrades > 0 ? stats.totalRoi / stats.totalTrades : 0

    // Calculate market cap performance averages
    Object.keys(stats.marketCapPerformance).forEach(key => {
      const cap = stats.marketCapPerformance[key as keyof typeof stats.marketCapPerformance]
      if (cap.count > 0) {
        cap.roi = cap.roi / cap.count
      }
    })

    return stats
  }

  // Fetch prices for all trades in one bulk request
  useEffect(() => {
    const tokensToFetch = trades
      .filter(trade => !fetchedTokensRef.current.has(trade.ca))
      .map(trade => trade.ca)
      // Remove duplicates
      .filter((value, index, self) => self.indexOf(value) === index)

    if (tokensToFetch.length > 0) {
      fetchAllTokenPrices(tokensToFetch)
    }
  }, [trades, retryCount])

  const stats = calculatePerformanceStats()

  // Handle retry for all failed tokens
  const handleRetry = () => {
    const failedTokens = Object.keys(errorStates).filter(token => errorStates[token])
    if (failedTokens.length > 0) {
      setErrorStates({})
      failedTokens.forEach(token => fetchedTokensRef.current.delete(token))
      fetchAllTokenPrices(failedTokens)
    }
  }

  // Format date - handle both Unix timestamp (seconds) and ISO string
  const formatDate = (dateValue: string | number) => {
    try {
      const dateNum = typeof dateValue === 'string' ? parseFloat(dateValue) : dateValue
      // If it's a Unix timestamp (less than year 3000 in seconds)
      if (dateNum < 32503680000) {
        // Multiply by 1000 to convert seconds to milliseconds
        return format(new Date(dateNum * 1000), "MMM d, yyyy HH:mm")
      }
      // Otherwise treat as ISO string or milliseconds
      return format(new Date(dateValue), "MMM d, yyyy HH:mm")
    } catch (error) {
      console.error('Error formatting date:', dateValue, error)
      return 'Invalid date'
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{traderName}</h1>
        <p className="text-muted-foreground">
          Detailed performance analysis and trade history
        </p>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-muted p-4 rounded-lg">
          <div className="text-sm text-muted-foreground">Win Rate</div>
          <div className="text-2xl font-bold">
            {stats.totalTrades > 0 ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.winningTrades} winning calls out of {stats.totalTrades} total
          </div>
        </div>
        <div className="bg-muted p-4 rounded-lg">
          <div className="text-sm text-muted-foreground">Average ROI</div>
          <div className={`text-2xl font-bold ${stats.averageRoi >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stats.averageRoi.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Average return on investment per trade
          </div>
        </div>
        <div className="bg-muted p-4 rounded-lg">
          <div className="text-sm text-muted-foreground">Total Calls</div>
          <div className="text-2xl font-bold">
            {stats.totalTrades}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Total number of trading calls made
          </div>
        </div>
      </div>

      {/* Market Cap Performance */}
      <div className="bg-muted p-4 rounded-lg">
        <div className="text-sm font-medium mb-2">Market Cap Performance</div>
        <div className="text-xs text-muted-foreground mb-4">Performance breakdown by market capitalization</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <div className="text-sm font-medium">Micro Cap</div>
            <div className="text-xs text-muted-foreground">&lt; $1M</div>
            <div className={`text-lg font-bold ${stats.marketCapPerformance.micro.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.marketCapPerformance.micro.roi.toFixed(1)}% ROI
            </div>
            <div className="text-xs text-muted-foreground">
              {((stats.marketCapPerformance.micro.wins / stats.marketCapPerformance.micro.count) * 100).toFixed(1)}% Win Rate
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Small Cap</div>
            <div className="text-xs text-muted-foreground">$1M - $5M</div>
            <div className={`text-lg font-bold ${stats.marketCapPerformance.small.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.marketCapPerformance.small.roi.toFixed(1)}% ROI
            </div>
            <div className="text-xs text-muted-foreground">
              {((stats.marketCapPerformance.small.wins / stats.marketCapPerformance.small.count) * 100).toFixed(1)}% Win Rate
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Mid Cap</div>
            <div className="text-xs text-muted-foreground">$5M - $25M</div>
            <div className={`text-lg font-bold ${stats.marketCapPerformance.mid.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.marketCapPerformance.mid.roi.toFixed(1)}% ROI
            </div>
            <div className="text-xs text-muted-foreground">
              {((stats.marketCapPerformance.mid.wins / stats.marketCapPerformance.mid.count) * 100).toFixed(1)}% Win Rate
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Large Cap</div>
            <div className="text-xs text-muted-foreground">$25M - $100M</div>
            <div className={`text-lg font-bold ${stats.marketCapPerformance.large.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.marketCapPerformance.large.roi.toFixed(1)}% ROI
            </div>
            <div className="text-xs text-muted-foreground">
              {((stats.marketCapPerformance.large.wins / stats.marketCapPerformance.large.count) * 100).toFixed(1)}% Win Rate
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Mega Cap</div>
            <div className="text-xs text-muted-foreground">&gt; $100M</div>
            <div className={`text-lg font-bold ${stats.marketCapPerformance.mega.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.marketCapPerformance.mega.roi.toFixed(1)}% ROI
            </div>
            <div className="text-xs text-muted-foreground">
              {((stats.marketCapPerformance.mega.wins / stats.marketCapPerformance.mega.count) * 100).toFixed(1)}% Win Rate
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium w-[160px]">Date & Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Token</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Initial MC</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Current MC</th>
                <th className="px-4 py-3 text-left text-sm font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const currentMc = tokenInfos[trade.ca]?.fdv || trade.current_mc
                const roi = ((currentMc - trade.initial_mc) / trade.initial_mc) * 100
                const isLoading = loadingStates[trade.ca]
                const hasError = errorStates[trade.ca]

                return (
                  <tr key={`${trade.caller}_${trade.ca}_${trade.date_called}`} className="border-b">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDate(trade.date_called)}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/token-analysis?token=${encodeURIComponent(trade.ca)}`} className="text-primary hover:underline">
                        {trade.ca}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatMarketCap(trade.initial_mc)}</td>
                    <td className="px-4 py-3 text-sm">
                      {hasError ? (
                        <span className="text-muted-foreground">N/A</span>
                      ) : tokenInfos[trade.ca] ? (
                        formatMarketCap(currentMc)
                      ) : (
                        <span className="animate-pulse text-muted-foreground">Loading...</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm ${getPerformanceClass(roi)}`}>
                      {hasError ? (
                        <span className="text-muted-foreground">N/A</span>
                      ) : tokenInfos[trade.ca] ? (
                        `${roi.toFixed(1)}%`
                      ) : (
                        <span className="animate-pulse text-muted-foreground">Loading...</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {Object.values(errorStates).some(Boolean) && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Failed Requests
          </Button>
        </div>
      )}
    </div>
  )
}

