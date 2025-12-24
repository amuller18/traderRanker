"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronUp, ChevronDown, ArrowUpDown, ExternalLink, Loader2, RefreshCw, Columns } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Trade } from "@/lib/trader-data"
import { useDisplayPreference } from "@/lib/display-preference-context"
import { PriceMarketCapToggle } from "@/components/price-marketcap-toggle"

interface TradesTableProps {
  trades: Trade[]
  loading?: boolean
}

type SortField = "date_called" | "roi" | "entry_price" | "caller" | "ath_price" | "ath_roi"
type SortDirection = "asc" | "desc"

export function TradesTable({ trades, loading = false }: TradesTableProps) {
  const [sortField, setSortField] = useState<SortField>("date_called")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [pageSize] = useState<number>(10) // Fixed at 10
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [tokenInfos, setTokenInfos] = useState<Record<string, { currentPrice: number; currentMc?: number }>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({})
  const [retryCount, setRetryCount] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const fetchedTokensRef = useRef<Set<string>>(new Set())
  const router = useRouter()
  const { displayMode } = useDisplayPreference()

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    date_called: true,
    trader: true,
    token: true,
    entry_price: true,
    current_price: true,
    ath_price: true,
    ath_roi: true,
    roi: true,
    links: true,
  })



  // Calculate ROI for a trade using prices
  const calculateRoi = (trade: Trade) => {
    const currentPrice = tokenInfos[trade.ca]?.currentPrice
    const entryPrice = trade.entry_price

    // If we don't have current price data yet, return null to indicate loading
    if (currentPrice === undefined) return null

    // If entry price is 0 or current price is 0, can't calculate ROI
    if (entryPrice === 0 || currentPrice === 0) return null

    return ((currentPrice - entryPrice) / entryPrice) * 100
  }

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Column options for the dropdown
  const columnOptions = [
    { key: "date_called", label: "Date Called" },
    { key: "trader", label: "Trader" },
    { key: "token", label: "Token" },
    { key: "entry_price", label: "Entry Price" },
    { key: "current_price", label: "Current Price" },
    { key: "ath_price", label: "ATH Price" },
    { key: "ath_roi", label: "ATH ROI" },
    { key: "roi", label: "Current ROI" },
    { key: "links", label: "Links" },
  ]

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
        const aRoi = calculateRoi(a) ?? -Infinity
        const bRoi = calculateRoi(b) ?? -Infinity
        return sortDirection === "asc" ? aRoi - bRoi : bRoi - aRoi
      } else if (sortField === "entry_price") {
        return sortDirection === "asc" ? a.entry_price - b.entry_price : b.entry_price - a.entry_price
      } else if (sortField === "ath_price") {
        return sortDirection === "asc" ? a.ath_price - b.ath_price : b.ath_price - a.ath_price
      } else if (sortField === "ath_roi") {
        return sortDirection === "asc" ? a.ath_roi - b.ath_roi : b.ath_roi - a.ath_roi
      }
      return 0
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

        console.log('Bulk price API response:', data)

        // Process all results at once
        const tokenInfosUpdate: Record<string, { currentPrice: number; currentMc?: number }> = {}
        const errorStatesUpdate: Record<string, boolean> = {}

        uniqueTokens.forEach(trade => {
          const tokenResult = data.find((result: any) => result.token === trade.ca)

          console.log(`Token ${trade.ca}: API result =`, tokenResult)

          if (tokenResult && tokenResult.price > 0) {
            tokenInfosUpdate[trade.ca] = {
              currentPrice: tokenResult.price,
              currentMc: tokenResult.market_cap || undefined,
            }
            fetchedTokensRef.current.add(trade.ca)
          } else {
            // No data available from API
            console.warn(`No price data available for ${trade.ca}`)
            tokenInfosUpdate[trade.ca] = {
              currentPrice: 0,
              currentMc: undefined,
            }
            fetchedTokensRef.current.add(trade.ca)
          }
        })

        // Update all states at once
        setTokenInfos(prev => ({ ...prev, ...tokenInfosUpdate }))
        setErrorStates(prev => ({ ...prev, ...errorStatesUpdate }))
        
      } catch (error) {
        console.error('Error updating prices for tokens:', error)

        // Mark all tokens as error
        const tokenInfosUpdate: Record<string, { currentPrice: number; currentMc?: number }> = {}
        const errorStatesUpdate: Record<string, boolean> = {}

        uniqueTokens.forEach(trade => {
          tokenInfosUpdate[trade.ca] = {
            currentPrice: 0,
            currentMc: undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, retryCount, paginatedTrades]) // Run when page changes, retry is triggered, or trades change

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

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(4)}`
    if (price >= 0.01) return `$${price.toFixed(6)}`
    return `$${price.toFixed(8)}`
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
    router.push(`/token-analysis?token=${encodeURIComponent(ca)}`)
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
          {/* Price/Market Cap Toggle */}
          <PriceMarketCapToggle />

          {/* Column Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnOptions.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={columnVisibility[col.key]}
                  onCheckedChange={() => toggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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

      {/* Table View */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnVisibility.date_called && (
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
              )}
              {columnVisibility.trader && (
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
              )}
              {columnVisibility.token && <TableHead>Token</TableHead>}
              {columnVisibility.entry_price && (
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("entry_price")}
                    className="flex items-center gap-1 p-0 h-auto font-medium"
                  >
                    {displayMode === 'marketcap' ? 'Entry MC' : 'Entry Price'}
                    {sortField === "entry_price" ? (
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
              )}
              {columnVisibility.current_price && (
                <TableHead className="w-[140px] text-xs uppercase tracking-wider font-medium">
                  {displayMode === 'marketcap' ? 'Current MC' : 'Current Price'}
                </TableHead>
              )}
              {columnVisibility.ath_price && (
                <TableHead className="w-[140px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("ath_price")}
                    className="flex items-center gap-1 p-0 h-auto font-medium"
                  >
                    {displayMode === 'marketcap' ? 'ATH MC' : 'ATH Price'}
                    {sortField === "ath_price" ? (
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
              )}
              {columnVisibility.ath_roi && (
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("ath_roi")}
                    className="flex items-center gap-1 p-0 h-auto font-medium"
                  >
                    ATH ROI
                    {sortField === "ath_roi" ? (
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
              )}
              {columnVisibility.roi && (
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("roi")}
                    className="flex items-center gap-1 p-0 h-auto font-medium"
                  >
                    Current ROI
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
              )}
              {columnVisibility.links && <TableHead className="w-[100px]">Links</TableHead>}
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
                const currentPrice = tokenInfos[trade.ca]?.currentPrice

                return (
                  <TableRow key={`${trade.caller}-${trade.ca}-${trade.date_called}`}>
                    {columnVisibility.date_called && (
                      <TableCell>
                        {trade.date_called ? formatDate(trade.date_called) : <span className="text-muted-foreground">N/A</span>}
                      </TableCell>
                    )}
                    {columnVisibility.trader && (
                      <TableCell>
                        <Link href={`/rankings?trader=${encodeURIComponent(trade.caller)}`} className="hover:underline text-primary">
                          {trade.caller}
                        </Link>
                      </TableCell>
                    )}
                    {columnVisibility.token && (
                      <TableCell>
                        <Link
                          href={`/token-analysis?token=${encodeURIComponent(trade.ca)}`}
                          className="hover:underline text-primary font-mono truncate max-w-[200px] block"
                          title={trade.ca}
                        >
                          {trade.ca.substring(0, 6)}...{trade.ca.substring(trade.ca.length - 4)}
                        </Link>
                      </TableCell>
                    )}
                    {columnVisibility.entry_price && (
                      <TableCell>
                        {displayMode === 'marketcap' ? (
                          trade.initial_mc > 0 ? (
                            formatMarketCap(trade.initial_mc)
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )
                        ) : (
                          trade.entry_price > 0 ? (
                            formatPrice(trade.entry_price)
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )
                        )}
                      </TableCell>
                    )}
                    {columnVisibility.current_price && (
                      <TableCell>
                        {isLoading ? (
                          <span className="animate-pulse text-muted-foreground">...</span>
                        ) : hasError ? (
                          <span className="text-muted-foreground">N/A</span>
                        ) : displayMode === 'marketcap' ? (
                          tokenInfos[trade.ca]?.currentMc && tokenInfos[trade.ca].currentMc! > 0 ? (
                            <span className="font-medium">{formatMarketCap(tokenInfos[trade.ca].currentMc!)}</span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )
                        ) : currentPrice && currentPrice > 0 ? (
                          <span className="font-medium">{formatPrice(currentPrice)}</span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    )}
                    {columnVisibility.ath_price && (
                      <TableCell>
                        {displayMode === 'marketcap' ? (
                          trade.high_mc > 0 ? (
                            formatMarketCap(trade.high_mc)
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )
                        ) : (
                          trade.ath_price > 0 ? (
                            formatPrice(trade.ath_price)
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )
                        )}
                      </TableCell>
                    )}
                    {columnVisibility.ath_roi && (
                      <TableCell className={trade.ath_roi !== 0 ? getPerformanceClass(trade.ath_roi) : ""}>
                        {trade.ath_roi !== 0 ? (
                          `${trade.ath_roi > 0 ? '+' : ''}${trade.ath_roi.toFixed(1)}%`
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    )}
                    {columnVisibility.roi && (
                      <TableCell className={roi !== null ? getPerformanceClass(roi) : ""}>
                        {isLoading ? (
                          <span className="animate-pulse text-muted-foreground">...</span>
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
                              className="h-6 w-6 p-0"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : roi !== null ? (
                          `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%`
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    )}
                    {columnVisibility.links && (
                      <TableCell>
                        <div className="flex gap-1">
                          <a href={`https://solscan.io/token/${trade.ca}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    )}
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

