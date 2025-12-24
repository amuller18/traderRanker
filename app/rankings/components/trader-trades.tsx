"use client"

import { useState, useEffect, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Trade } from "@/lib/trader-data"
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { formatMarketCap, formatROI } from "@/lib/utils"
import type { TokenInfo } from "@/lib/token-data"
import { useDisplayPreference } from "@/lib/display-preference-context"
import { PriceMarketCapToggle } from "@/components/price-marketcap-toggle"

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
  const [tokenInfos, setTokenInfos] = useState<Record<string, { currentPrice: number; currentMc?: number }>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({})
  const [retryCount, setRetryCount] = useState(0)
  const fetchedTokensRef = useRef<Set<string>>(new Set())
  const { displayMode } = useDisplayPreference()
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    date_called: true,
    token: true,
    entry_price: true,
    current_price: true,
    ath_price: true,
    ath_roi: true,
    roi: true,
  })

  const getPerformanceClass = (roi: number) => {
    if (roi > 0) return "text-green-500"
    if (roi < 0) return "text-red-500"
    return "text-muted-foreground"
  }

  const toggleColumn = (column: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [column]: !prev[column],
    }))
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`?${params.toString()}`)
  }

  const formatPrice = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return "0.00"

    if (value < 0.00000001) {
      return value.toExponential(2)
    }
    if (value < 0.0001) {
      return value.toFixed(8)
    }
    if (value < 1) {
      return value.toFixed(6)
    }
    return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
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
      const newTokenInfos: Record<string, { currentPrice: number; currentMc?: number }> = {}

      results.forEach((result: any) => {
        if (result.error) {
          console.warn(`⚠️ Error for token ${result.token}:`, result.error)
          setErrorStates(prev => ({ ...prev, [result.token]: true }))
        } else {
          newTokenInfos[result.token] = {
            currentPrice: result.price || 0,
            currentMc: result.market_cap || undefined,
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
      const currentPrice = tokenInfos[trade.ca]?.currentPrice
      const entryPrice = trade.entry_price

      if (currentPrice !== undefined && entryPrice > 0) {
        const roi = ((currentPrice - entryPrice) / entryPrice) * 100

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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages} total pages
        </div>
        <div className="flex items-center gap-2">
          <PriceMarketCapToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={columnVisibility.date_called}
                onCheckedChange={() => toggleColumn("date_called")}
              >
                Date Called
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.token}
                onCheckedChange={() => toggleColumn("token")}
              >
                Token
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.entry_price}
                onCheckedChange={() => toggleColumn("entry_price")}
              >
                Entry Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.current_price}
                onCheckedChange={() => toggleColumn("current_price")}
              >
                Current Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.ath_price}
                onCheckedChange={() => toggleColumn("ath_price")}
              >
                ATH Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.ath_roi}
                onCheckedChange={() => toggleColumn("ath_roi")}
              >
                ATH ROI
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.roi}
                onCheckedChange={() => toggleColumn("roi")}
              >
                Current ROI
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                {columnVisibility.date_called && (
                  <th className="px-4 py-3 text-left text-sm font-medium w-[160px]">Date & Time</th>
                )}
                {columnVisibility.token && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Token</th>
                )}
                {columnVisibility.entry_price && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    {displayMode === 'marketcap' ? 'Entry MC' : 'Entry Price'}
                  </th>
                )}
                {columnVisibility.current_price && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    {displayMode === 'marketcap' ? 'Current MC' : 'Current Price'}
                  </th>
                )}
                {columnVisibility.ath_price && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    {displayMode === 'marketcap' ? 'ATH MC' : 'ATH Price'}
                  </th>
                )}
                {columnVisibility.ath_roi && (
                  <th className="px-4 py-3 text-left text-sm font-medium">ATH ROI</th>
                )}
                {columnVisibility.roi && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Current ROI</th>
                )}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No trades found for this page. The trader may have stats but trades are not available from the API.
                  </td>
                </tr>
              ) : (
                trades.map((trade) => {
                  const currentPrice = tokenInfos[trade.ca]?.currentPrice
                  const entryPrice = trade.entry_price ?? 0
                  const athPrice = trade.ath_price ?? 0
                  const athRoi = trade.ath_roi ?? 0
                  const roi = currentPrice !== undefined && entryPrice > 0
                    ? ((currentPrice - entryPrice) / entryPrice) * 100
                    : null
                  const hasError = errorStates[trade.ca]

                  return (
                    <tr key={`${trade.caller}_${trade.ca}_${trade.date_called}`} className="border-b">
                      {columnVisibility.date_called && (
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDate(trade.date_called)}</td>
                      )}
                      {columnVisibility.token && (
                        <td className="px-4 py-3 text-sm">
                          <Link href={`/token-analysis?token=${encodeURIComponent(trade.ca)}`} className="text-primary hover:underline">
                            {trade.ca}
                          </Link>
                        </td>
                      )}
                      {columnVisibility.entry_price && (
                        <td className="px-4 py-3 text-sm">
                          {displayMode === 'marketcap' ? (
                            trade.initial_mc > 0 ? formatMarketCap(trade.initial_mc) : <span className="text-muted-foreground">N/A</span>
                          ) : (
                            entryPrice > 0 ? formatPrice(entryPrice) : <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.current_price && (
                        <td className="px-4 py-3 text-sm">
                          {hasError ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : displayMode === 'marketcap' ? (
                            tokenInfos[trade.ca]?.currentMc && tokenInfos[trade.ca].currentMc! > 0 ? (
                              formatMarketCap(tokenInfos[trade.ca].currentMc!)
                            ) : currentPrice !== undefined ? (
                              <span className="text-muted-foreground">N/A</span>
                            ) : (
                              <span className="animate-pulse text-muted-foreground">Loading...</span>
                            )
                          ) : currentPrice !== undefined && currentPrice > 0 ? (
                            formatPrice(currentPrice)
                          ) : (
                            <span className="animate-pulse text-muted-foreground">Loading...</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.ath_price && (
                        <td className="px-4 py-3 text-sm">
                          {displayMode === 'marketcap' ? (
                            trade.high_mc > 0 ? formatMarketCap(trade.high_mc) : <span className="text-muted-foreground">N/A</span>
                          ) : (
                            athPrice > 0 ? formatPrice(athPrice) : <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.ath_roi && (
                        <td className={`px-4 py-3 text-sm ${athRoi !== 0 ? getPerformanceClass(athRoi) : ''}`}>
                          {athRoi !== 0 ? `${athRoi.toFixed(2)}%` : <span className="text-muted-foreground">N/A</span>}
                        </td>
                      )}
                      {columnVisibility.roi && (
                        <td className={`px-4 py-3 text-sm ${roi !== null ? getPerformanceClass(roi) : ''}`}>
                          {hasError ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : roi !== null ? (
                            `${roi.toFixed(2)}%`
                          ) : (
                            <span className="animate-pulse text-muted-foreground">Loading...</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
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

