"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
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
  const router = useRouter()

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
        // Temporarily disable ROI sorting to prevent infinite loop
        // Use the original ROI from the trade data instead
        const aRoi = a.roi || 0
        const bRoi = b.roi || 0
        return sortDirection === "asc" ? aRoi - bRoi : bRoi - aRoi
      } else {
        const aValue = a[sortField]
        const bValue = b[sortField]
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }
    })
  }, [trades, sortField, sortDirection]) // Removed tokenInfos dependency

  // Memoize paginated trades
  const { paginatedTrades, totalPages } = useMemo(() => {
    const totalPages = Math.ceil(sortedTrades.length / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, startIndex + 10) // Ensure we never get more than 10
    const paginatedTrades = sortedTrades.slice(startIndex, endIndex)
    return { paginatedTrades, totalPages }
  }, [sortedTrades, currentPage, pageSize])

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
                // Use the original ROI from trade data instead of calculating from current MC
                const roi = trade.roi || 0

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
                      {`${roi.toFixed(1)}%`}
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

