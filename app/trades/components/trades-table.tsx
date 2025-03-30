"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { Trade } from "@/lib/trader-data"
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface TradesTableProps {
  trades: Trade[]
  loading?: boolean
}

type SortField = "date_called" | "roi" | "initial_mc" | "caller"
type SortDirection = "asc" | "desc"

export function TradesTable({ trades, loading = false }: TradesTableProps) {
  const [sortField, setSortField] = useState<SortField>("date_called")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const router = useRouter()

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const sortedTrades = [...trades].sort((a, b) => {
    if (sortField === "date_called") {
      const aDate = new Date(a.date_called).getTime()
      const bDate = new Date(b.date_called).getTime()
      return sortDirection === "asc" ? aDate - bDate : bDate - aDate
    } else if (sortField === "caller") {
      return sortDirection === "asc" ? a.caller.localeCompare(b.caller) : b.caller.localeCompare(a.caller)
    } else {
      const aValue = a[sortField]
      const bValue = b[sortField]
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }
  })

  const formatMarketCap = (mc: number) => {
    if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(2)}K`
    return `$${mc.toFixed(2)}`
  }

  const getPerformanceClass = (roi: number) => {
    if (roi >= 1) return "text-green-500 font-medium"
    if (roi >= 0) return "text-green-400"
    if (roi >= -0.5) return "text-orange-400"
    return "text-red-500"
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      </div>
    )
  }

  return (
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
            <TableHead className="w-[120px]">High ROI</TableHead>
            <TableHead className="w-[100px]">Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTrades.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No trades found.
              </TableCell>
            </TableRow>
          ) : (
            sortedTrades.map((trade) => (
              <TableRow
                key={`${trade.caller}-${trade.ca}-${trade.date_called}`}
                onClick={() => handleTokenClick(trade.ca)}
              >
                <TableCell>{formatDate(trade.date_called)}</TableCell>
                <TableCell>
                  <Link
                    href={`/rankings/${encodeURIComponent(trade.caller)}`}
                    className="hover:underline text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {trade.caller}
                  </Link>
                </TableCell>
                <TableCell>
                  <div
                    className="hover:underline text-primary font-mono truncate max-w-[200px] cursor-pointer"
                    title={trade.ca}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTokenClick(trade.ca)
                    }}
                  >
                    {trade.ca.substring(0, 6)}...{trade.ca.substring(trade.ca.length - 4)}
                  </div>
                </TableCell>
                <TableCell>{formatMarketCap(trade.initial_mc)}</TableCell>
                <TableCell className={getPerformanceClass(trade.roi)}>{(trade.roi * 100).toFixed(1)}%</TableCell>
                <TableCell className={getPerformanceClass(trade.roi_at_high)}>
                  {(trade.roi_at_high * 100).toFixed(1)}%
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <a
                      href={`https://solscan.io/token/${trade.ca}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

