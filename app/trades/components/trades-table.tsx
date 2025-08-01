"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronUp, ChevronDown, ArrowUpDown, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const [pageSize] = useState<number>(10) // Fixed at 10
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [tokenInfos, setTokenInfos] = useState<Record<string, { currentMc: number }>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({})
  const [retryCount, setRetryCount] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const fetchedTokensRef = useRef<Set<string>>(new Set())
  const router = useRouter()



  // Calculate ROI for a trade (same logic as token-analysis page)
  const calculateRoi = (trade: Trade) => {
    const currentMc = tokenInfos[trade.ca]?.currentMc || 0
    const initialMc = trade.initial_mc
    
    if (initialMc === 0) return 0
    
    return ((currentMc - initialMc) / initialMc) * 100
  }

  // Memoize sorted trades to prevent infinite re-renders
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      if (sortField === "date_called") {
        const aDate = new Date(a.date_called).getTime()
        const bDate = new Date(b.date_called).getTime()
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate
      } else if (sortField === "caller") {
        return sortDirection === "asc" ? a.caller.localeCompare(b.caller) : b.caller.localeCompare(a.caller)
      } else if (sortField === "roi") {
        const aRoi = calculateRoi(a)
        const bRoi = calculateRoi(b)
        return sortDirection === "asc" ? aRoi - bRoi : bRoi - aRoi
      } else {
        const aValue = a[sortField]
        const bValue = b[sortField]
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }
    })
  }, [trades, sortField, sortDirection, tokenInfos])

  // Memoize paginated trades
  const { paginatedTrades, totalPages } = useMemo(() => {
    const totalPages = Math.ceil(sortedTrades.length / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, startIndex + 10) // Ensure we never get more than 10
    const paginatedTrades = sortedTrades.slice(startIndex, endIndex)
    return { paginatedTrades, totalPages }
  }, [sortedTrades, currentPage, pageSize])

  // Update ROI for all trades
  useEffect(() => {
    // Only fetch data for tokens on the current page that haven't been fetched yet
    const currentPageTokens = paginatedTrades.filter(trade => {
      return !tokenInfos[trade.ca] && 
             !loadingStates[trade.ca] && 
             !fetchedTokensRef.current.has(trade.ca) &&
             !errorStates[trade.ca] // Don't retry failed tokens automatically
    })

    // Remove duplicates by token address
    const uniqueTokens = currentPageTokens.filter((trade, index, self) => 
      index === self.findIndex(t => t.ca === trade.ca)
    )

    const processUpdates = async () => {
      if (isUpdating || uniqueTokens.length === 0) return // Prevent multiple simultaneous updates
      
      setIsUpdating(true)
      try {
        // Use bulk API call for all tokens at once (much faster)
        const tokenAddresses = uniqueTokens.map(trade => trade.ca)
        
        // Mark all tokens as loading
        const loadingStatesUpdate: Record<string, boolean> = {}
        tokenAddresses.forEach(ca => {
          loadingStatesUpdate[ca] = true
        })
        setLoadingStates(prev => ({ ...prev, ...loadingStatesUpdate }))

        // Single bulk API call
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
        
        // Process all results at once
        const tokenInfosUpdate: Record<string, { currentMc: number }> = {}
        const errorStatesUpdate: Record<string, boolean> = {}
        
        uniqueTokens.forEach(trade => {
          const tokenResult = data.find((result: any) => result.token === trade.ca)
          
          if (tokenResult && tokenResult.market_cap > 0) {
            tokenInfosUpdate[trade.ca] = {
              currentMc: tokenResult.market_cap,
            }
            fetchedTokensRef.current.add(trade.ca)
          } else {
            // Fallback to stored current_mc if API doesn't have data
            tokenInfosUpdate[trade.ca] = {
              currentMc: trade.current_mc,
            }
            fetchedTokensRef.current.add(trade.ca)
          }
        })

        // Update all states at once
        setTokenInfos(prev => ({ ...prev, ...tokenInfosUpdate }))
        setErrorStates(prev => ({ ...prev, ...errorStatesUpdate }))
        
      } catch (error) {
        console.error('Error updating ROI for tokens:', error)
        
        // Fallback to stored data for all tokens on error
        const tokenInfosUpdate: Record<string, { currentMc: number }> = {}
        const errorStatesUpdate: Record<string, boolean> = {}
        
        uniqueTokens.forEach(trade => {
          tokenInfosUpdate[trade.ca] = {
            currentMc: trade.current_mc,
          }
          fetchedTokensRef.current.add(trade.ca)
          errorStatesUpdate[trade.ca] = true
        })
        
        setTokenInfos(prev => ({ ...prev, ...tokenInfosUpdate }))
        setErrorStates(prev => ({ ...prev, ...errorStatesUpdate }))
      } finally {
        // Clear loading states for all tokens
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
  }, [currentPage, retryCount]) // Only run when page changes or retry is triggered

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

  const getPerformanceClass = (roi: number) => {
    if (roi > 0) return "text-green-500"
    if (roi < 0) return "text-red-500"
    return "text-muted-foreground"
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (e) {
      return dateString
    }
  }

  const handleTokenClick = (ca: string) => {
    router.push(`/token-analysis/${encodeURIComponent(ca)}`)
  }

  // Handle retry for all failed tokens
  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    setErrorStates({})
    fetchedTokensRef.current.clear()
  }

  // Handle retry for a specific token
  const handleRetryToken = (token: string) => {
    setErrorStates(prev => ({ ...prev, [token]: false }))
    fetchedTokensRef.current.delete(token)
    // Trigger a re-fetch by incrementing retry count
    setRetryCount(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="rounded-md border p-8 flex justify-center items-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Showing {paginatedTrades.length} trades</span>
          {isUpdating && (
            <div className="flex items-center gap-1 text-sm text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
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
          <span className="text-sm text-muted-foreground">
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("date_called")}
                  className="flex items-center gap-1 p-0 h-auto font-medium"
                >
                  Date Called
                  {sortField === "date_called" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("caller")}
                  className="flex items-center gap-1 p-0 h-auto font-medium"
                >
                  Trader
                  {sortField === "caller" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="w-[150px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("initial_mc")}
                  className="flex items-center gap-1 p-0 h-auto font-medium"
                >
                  Initial MC
                  {sortField === "initial_mc" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("roi")}
                  className="flex items-center gap-1 p-0 h-auto font-medium"
                >
                  ROI
                  {sortField === "roi" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
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
                    <TableCell>{formatDate(trade.date_called)}</TableCell>
                    <TableCell>
                      <Link href={`/rankings/${encodeURIComponent(trade.caller)}`} className="hover:underline text-primary">
                        {trade.caller}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/token-analysis/${encodeURIComponent(trade.ca)}`}
                        className="hover:underline text-primary font-mono truncate max-w-[200px] block"
                        title={trade.ca}
                      >
                        {trade.ca.substring(0, 6)}...{trade.ca.substring(trade.ca.length - 4)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatMarketCap(trade.initial_mc)}</TableCell>
                    <TableCell className={getPerformanceClass(roi)}>
                      {isLoading ? (
                        <span className="animate-pulse text-muted-foreground">•••%</span>
                      ) : hasError ? (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Failed to load price data</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setErrorStates(prev => ({ ...prev, [trade.ca]: false }))
                              fetchedTokensRef.current.delete(trade.ca)
                              setRetryCount(prev => prev + 1)
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        `${roi.toFixed(1)}%`
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <a href={`https://solscan.io/token/${trade.ca}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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

