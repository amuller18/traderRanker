"use client"

import { useState, useEffect, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Trade } from "@/lib/trader-data"
import type { TokenInfo } from "@/lib/token-data"

interface TradesTableProps {
  trades: Trade[]
  loading?: boolean
}

type SortField = "date_called" | "roi" | "initial_mc" | "caller"
type SortDirection = "asc" | "desc"

export function TradesTable({ trades, loading = false }: TradesTableProps) {
  const [sortField, setSortField] = useState<SortField>("date_called")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [tokenInfos, setTokenInfos] = useState<Record<string, number>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({})
  const [pageSize] = useState<number>(10) // Fixed at 10
  const [currentPage, setCurrentPage] = useState<number>(1)
  const fetchedTokensRef = useRef<Set<string>>(new Set())
  const router = useRouter()

  // First sort the trades
  const sortedTrades = [...trades].sort((a, b) => {
    if (sortField === "date_called") {
      const aDate = new Date(a.date_called).getTime()
      const bDate = new Date(b.date_called).getTime()
      return sortDirection === "asc" ? aDate - bDate : bDate - aDate
    } else if (sortField === "caller") {
      return sortDirection === "asc" ? a.caller.localeCompare(b.caller) : b.caller.localeCompare(a.caller)
    } else if (sortField === "roi") {
      const aCurrentMc = tokenInfos[a.ca] || 0
      const bCurrentMc = tokenInfos[b.ca] || 0
      const aRoi = ((aCurrentMc - a.initial_mc) / a.initial_mc) * 100
      const bRoi = ((bCurrentMc - b.initial_mc) / b.initial_mc) * 100
      return sortDirection === "asc" ? aRoi - bRoi : bRoi - aRoi
    } else {
      const aValue = a[sortField]
      const bValue = b[sortField]
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }
  })

  // Then paginate - strictly limit to 10
  const totalPages = Math.ceil(sortedTrades.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, startIndex + 10) // Ensure we never get more than 10
  const paginatedTrades = sortedTrades.slice(startIndex, endIndex)

  // Update ROI for a single trade
  const updateTradeRoi = async (trade: Trade) => {
    if (fetchedTokensRef.current.has(trade.ca)) return
    
    setLoadingStates(prev => ({ ...prev, [trade.ca]: true }))
    setErrorStates(prev => ({ ...prev, [trade.ca]: false }))
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/token-info?address=${encodeURIComponent(trade.ca)}`)
      if (!response.ok) {
        if (response.status === 404) {
          setErrorStates(prev => ({ ...prev, [trade.ca]: true }))
          return
        }
        throw new Error('Failed to fetch token info')
      }
      
      const tokenInfo: TokenInfo = await response.json()
      const fdv = tokenInfo?.marketInfo?.fdv
      
      if (typeof fdv === 'number' && !isNaN(fdv)) {
        setTokenInfos(prev => ({
          ...prev,
          [trade.ca]: fdv
        }))
        fetchedTokensRef.current.add(trade.ca)
      } else {
        setErrorStates(prev => ({ ...prev, [trade.ca]: true }))
      }
    } catch (error) {
      console.error(`Error fetching token info for ${trade.ca}:`, error)
      setErrorStates(prev => ({ ...prev, [trade.ca]: true }))
    } finally {
      setLoadingStates(prev => ({ ...prev, [trade.ca]: false }))
    }
  }

  // Update ROI for visible trades only
  useEffect(() => {
    // Only process the currently visible trades
    const updates = paginatedTrades.reduce((acc, trade) => {
      if (!tokenInfos[trade.ca] && !loadingStates[trade.ca] && !fetchedTokensRef.current.has(trade.ca)) {
        acc.push(trade)
      }
      return acc
    }, [] as Trade[])

    // Process updates in parallel for faster updates
    const processUpdates = async () => {
      await Promise.all(updates.map(trade => updateTradeRoi(trade)))
    }

    if (updates.length > 0) {
      processUpdates()
    }
  }, [currentPage, paginatedTrades]) // Removed pageSize since it's constant

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
                const currentMc = tokenInfos[trade.ca] || 0
                const roi = ((currentMc - trade.initial_mc) / trade.initial_mc) * 100
                const isLoading = loadingStates[trade.ca]

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
                      ) : errorStates[trade.ca] ? (
                        <span className="text-muted-foreground">N/A</span>
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
    </div>
  )
}

