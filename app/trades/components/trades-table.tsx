"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronUp, ChevronDown, ArrowUpDown, ExternalLink, Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Trade } from "@/lib/trader-data"

interface TradesTableProps {
  trades: Trade[]
  loading?: boolean
}

type SortField = "date_called" | "roi" | "initial_mc" | "caller"
type SortDirection = "asc" | "desc"

export function TradesTable({ trades, loading = false }: TradesTableProps) {
  const [sortField, setSortField] = useState<SortField>("date_called")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [pageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [tokenInfos, setTokenInfos] = useState<Record<string, { currentMc: number }>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({})
  const [retryCount, setRetryCount] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const fetchedTokensRef = useRef<Set<string>>(new Set())
  const router = useRouter()

  const calculateRoi = (trade: Trade) => {
    const currentMc = tokenInfos[trade.ca]?.currentMc
    const initialMc = trade.initial_mc

    if (currentMc === undefined) return null
    if (initialMc === 0 || currentMc === 0) return null

    if (currentMc < 10000) {
      const rawRoi = ((currentMc - initialMc) / initialMc) * 100
      return Math.min(rawRoi, 1000)
    }

    return ((currentMc - initialMc) / initialMc) * 100
  }

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      if (sortField === "date_called") {
        const aDate = new Date(a.date_called).getTime()
        const bDate = new Date(b.date_called).getTime()
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate
      } else if (sortField === "caller") {
        return sortDirection === "asc" ? a.caller.localeCompare(b.caller) : b.caller.localeCompare(a.caller)
      } else if (sortField === "roi") {
        const aRoi = calculateRoi(a) ?? -Infinity
        const bRoi = calculateRoi(b) ?? -Infinity
        return sortDirection === "asc" ? aRoi - bRoi : bRoi - aRoi
      } else {
        const aValue = a[sortField]
        const bValue = b[sortField]
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }
    })
  }, [trades, sortField, sortDirection, tokenInfos])

  const { paginatedTrades, totalPages } = useMemo(() => {
    const totalPages = Math.ceil(sortedTrades.length / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, startIndex + 10)
    const paginatedTrades = sortedTrades.slice(startIndex, endIndex)
    return { paginatedTrades, totalPages }
  }, [sortedTrades, currentPage, pageSize])

  useEffect(() => {
    const currentPageTokens = paginatedTrades.filter(trade => {
      return !tokenInfos[trade.ca] &&
             !loadingStates[trade.ca] &&
             !fetchedTokensRef.current.has(trade.ca) &&
             !errorStates[trade.ca]
    })

    const uniqueTokens = currentPageTokens.filter((trade, index, self) =>
      index === self.findIndex(t => t.ca === trade.ca)
    )

    const processUpdates = async () => {
      if (isUpdating || uniqueTokens.length === 0) return

      setIsUpdating(true)
      try {
        const tokenAddresses = uniqueTokens.map(trade => trade.ca)

        const loadingStatesUpdate: Record<string, boolean> = {}
        tokenAddresses.forEach(ca => {
          loadingStatesUpdate[ca] = true
        })
        setLoadingStates(prev => ({ ...prev, ...loadingStatesUpdate }))

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
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()

        const tokenInfosUpdate: Record<string, { currentMc: number }> = {}
        const errorStatesUpdate: Record<string, boolean> = {}

        uniqueTokens.forEach(trade => {
          const tokenResult = data.find((result: any) => result.token === trade.ca)

          if (tokenResult && tokenResult.market_cap > 0) {
            tokenInfosUpdate[trade.ca] = { currentMc: tokenResult.market_cap }
            fetchedTokensRef.current.add(trade.ca)
          } else if (trade.current_mc && trade.current_mc > 0) {
            tokenInfosUpdate[trade.ca] = { currentMc: trade.current_mc }
            fetchedTokensRef.current.add(trade.ca)
          } else {
            tokenInfosUpdate[trade.ca] = { currentMc: 0 }
            fetchedTokensRef.current.add(trade.ca)
          }
        })

        setTokenInfos(prev => ({ ...prev, ...tokenInfosUpdate }))
        setErrorStates(prev => ({ ...prev, ...errorStatesUpdate }))

      } catch (error) {
        console.error('Error updating ROI for tokens:', error)

        const tokenInfosUpdate: Record<string, { currentMc: number }> = {}
        const errorStatesUpdate: Record<string, boolean> = {}

        uniqueTokens.forEach(trade => {
          if (trade.current_mc && trade.current_mc > 0) {
            tokenInfosUpdate[trade.ca] = { currentMc: trade.current_mc }
          } else {
            tokenInfosUpdate[trade.ca] = { currentMc: 0 }
          }
          fetchedTokensRef.current.add(trade.ca)
          errorStatesUpdate[trade.ca] = true
        })

        setTokenInfos(prev => ({ ...prev, ...tokenInfosUpdate }))
        setErrorStates(prev => ({ ...prev, ...errorStatesUpdate }))
      } finally {
        const loadingStatesUpdate: Record<string, boolean> = {}
        uniqueTokens.forEach(trade => {
          loadingStatesUpdate[trade.ca] = false
        })
        setLoadingStates(prev => ({ ...prev, ...loadingStatesUpdate }))
        setIsUpdating(false)
      }
    }

    if (uniqueTokens.length > 0) {
      processUpdates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, retryCount, paginatedTrades])

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const formatMarketCap = (mc: number) => {
    if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(2)}K`
    return `$${mc.toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (e) {
      return dateString
    }
  }

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    setErrorStates({})
    fetchedTokensRef.current.clear()
  }

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Showing {paginatedTrades.length} trades</span>
          {isUpdating && (
            <div className="flex items-center gap-1.5 text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Updating prices...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedTrades.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No trades found.
          </Card>
        ) : (
          paginatedTrades.map((trade) => {
            const roi = calculateRoi(trade)
            const isLoading = loadingStates[trade.ca]

            return (
              <Card key={`${trade.caller}-${trade.ca}-${trade.date_called}`} className="hover:border-border/60 transition-colors">
                <CardContent className="pt-5 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/rankings?trader=${encodeURIComponent(trade.caller)}`}
                        className="text-primary hover:underline font-medium truncate"
                      >
                        {trade.caller}
                      </Link>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(trade.date_called)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/token-analysis?token=${encodeURIComponent(trade.ca)}`}
                        className="text-xs text-muted-foreground hover:text-primary font-mono truncate"
                      >
                        {trade.ca.substring(0, 8)}...{trade.ca.substring(trade.ca.length - 6)}
                      </Link>
                      <a
                        href={`https://solscan.io/token/${trade.ca}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Initial MC</p>
                        <p className="font-medium">
                          {trade.initial_mc > 0 ? formatMarketCap(trade.initial_mc) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Current MC</p>
                        {isLoading ? (
                          <p className="font-medium text-muted-foreground animate-pulse">Loading...</p>
                        ) : tokenInfos[trade.ca]?.currentMc ? (
                          <p className="font-medium">{formatMarketCap(tokenInfos[trade.ca].currentMc)}</p>
                        ) : (
                          <p className="font-medium text-muted-foreground">N/A</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">ROI</p>
                        {isLoading ? (
                          <p className="font-medium text-muted-foreground animate-pulse">Loading...</p>
                        ) : roi !== null ? (
                          <div className={`font-semibold flex items-center gap-1 ${
                            roi >= 0 ? "text-success" : "text-destructive"
                          }`}>
                            {roi >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {roi.toFixed(1)}%
                          </div>
                        ) : (
                          <p className="font-medium text-muted-foreground">N/A</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[160px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("date_called")}
                  className="flex items-center gap-1 -ml-3 h-auto py-0 px-3 hover:bg-transparent text-xs uppercase tracking-wider font-medium"
                >
                  Date Called
                  {sortField === "date_called" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("caller")}
                  className="flex items-center gap-1 -ml-3 h-auto py-0 px-3 hover:bg-transparent text-xs uppercase tracking-wider font-medium"
                >
                  Trader
                  {sortField === "caller" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-medium">Token</TableHead>
              <TableHead className="w-[140px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("initial_mc")}
                  className="flex items-center gap-1 -ml-3 h-auto py-0 px-3 hover:bg-transparent text-xs uppercase tracking-wider font-medium"
                >
                  Initial MC
                  {sortField === "initial_mc" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[140px] text-xs uppercase tracking-wider font-medium">Current MC</TableHead>
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("roi")}
                  className="flex items-center gap-1 -ml-3 h-auto py-0 px-3 hover:bg-transparent text-xs uppercase tracking-wider font-medium"
                >
                  ROI
                  {sortField === "roi" ? (
                    sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[80px] text-xs uppercase tracking-wider font-medium">Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No trades found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedTrades.map((trade) => {
                const roi = calculateRoi(trade)
                const isLoading = loadingStates[trade.ca]
                const hasError = errorStates[trade.ca]

                return (
                  <TableRow key={`${trade.caller}-${trade.ca}-${trade.date_called}`}>
                    <TableCell className="text-muted-foreground">
                      {trade.date_called ? formatDate(trade.date_called) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Link href={`/rankings?trader=${encodeURIComponent(trade.caller)}`} className="hover:underline text-primary font-medium">
                        {trade.caller}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/token-analysis?token=${encodeURIComponent(trade.ca)}`}
                        className="hover:underline text-primary/80 hover:text-primary font-mono text-sm"
                        title={trade.ca}
                      >
                        {trade.ca.substring(0, 6)}...{trade.ca.substring(trade.ca.length - 4)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {trade.initial_mc > 0 ? (
                        <span className="font-medium">{formatMarketCap(trade.initial_mc)}</span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isLoading ? (
                        <span className="animate-pulse text-muted-foreground">Loading...</span>
                      ) : hasError ? (
                        <span className="text-muted-foreground">N/A</span>
                      ) : tokenInfos[trade.ca]?.currentMc ? (
                        <span className="font-medium">{formatMarketCap(tokenInfos[trade.ca].currentMc)}</span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isLoading ? (
                        <span className="animate-pulse text-muted-foreground">Loading...</span>
                      ) : hasError ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Error</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setErrorStates(prev => ({ ...prev, [trade.ca]: false }))
                              fetchedTokensRef.current.delete(trade.ca)
                              setRetryCount(prev => prev + 1)
                            }}
                            className="h-6 w-6 p-0 hover:bg-accent/50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : roi !== null ? (
                        <span className={`flex items-center gap-1 font-medium ${
                          roi >= 0 ? "text-success" : "text-destructive"
                        }`}>
                          {roi >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {roi.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://solscan.io/token/${trade.ca}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent/50">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {Object.values(errorStates).some(Boolean) && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Failed Requests
          </Button>
        </div>
      )}
    </div>
  )
}
