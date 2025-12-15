"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, RefreshCw, AlertCircle } from "lucide-react"
import { formatROI } from "@/lib/utils"
import { fetchTraderStats } from "@/lib/api-client"
import { TraderRankingsSkeleton } from "./trader-rankings-skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

interface Trader {
  caller: string
  total_calls: number
  winning_calls: number
  win_rate: number
  average_roi: number
}

export function TraderRankings() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sortField, setSortField] = useState<keyof Trader>("win_rate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  const fetchTraders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null) // Clear previous errors

    try {
      const data = await fetchTraderStats()

      // Deduplicate traders by caller (keep first occurrence of each unique caller)
      const uniqueTraders = data.reduce((acc: Trader[], trader) => {
        if (!acc.find(t => t.caller === trader.caller)) {
          acc.push(trader)
        }
        return acc
      }, [])

      setTraders(uniqueTraders)
      setLastUpdated(new Date())
      setError(null) // Clear errors on success
    } catch (error) {
      console.error('Error fetching traders:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load trader rankings'
      setError(errorMessage)

      // Don't clear existing data on refresh errors, only on initial load
      if (!isRefresh) {
        setTraders([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTraders()
  }, [fetchTraders])

  const handleRefresh = () => {
    fetchTraders(true)
  }

  const handleSort = (field: keyof Trader) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const getSortIcon = (field: keyof Trader) => {
    if (field !== sortField) return null
    return sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
  }

  const sortedTraders = [...traders].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    const modifier = sortDirection === "asc" ? 1 : -1
    return aValue < bValue ? -1 * modifier : aValue > bValue ? 1 * modifier : 0
  })

  // Pagination
  const totalPages = Math.ceil(sortedTraders.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTraders = sortedTraders.slice(startIndex, endIndex)

  if (loading) {
    return <TraderRankingsSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Rankings</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Header with refresh button and stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {lastUpdated && (
              <>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedTraders.length)} of {sortedTraders.length} traders
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {paginatedTraders.map((trader) => (
          <Card key={trader.caller} className="shadow-elevated">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Trader</div>
                  <Link href={`/rankings?trader=${encodeURIComponent(trader.caller)}`} className="text-primary hover:underline font-medium">
                    {trader.caller}
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Win Rate</div>
                    <div className="font-semibold">{(trader.win_rate * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Calls</div>
                    <div className="font-semibold">{trader.total_calls}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Avg ROI</div>
                    <div className={`font-semibold ${trader.average_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatROI(trader.average_roi)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trader</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("win_rate")}
                className="flex items-center gap-1"
              >
                Win Rate
                {getSortIcon("win_rate")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("total_calls")}
                className="flex items-center gap-1"
              >
                Total Calls
                {getSortIcon("total_calls")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("average_roi")}
                className="flex items-center gap-1"
              >
                Average ROI
                {getSortIcon("average_roi")}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTraders.map((trader) => (
            <TableRow key={trader.caller}>
              <TableCell>
                <Link href={`/rankings?trader=${encodeURIComponent(trader.caller)}`} className="text-primary hover:underline">
                  {trader.caller}
                </Link>
              </TableCell>
              <TableCell>{(trader.win_rate * 100).toFixed(1)}%</TableCell>
              <TableCell>{trader.total_calls}</TableCell>
              <TableCell className={trader.average_roi >= 0 ? "text-green-500" : "text-red-500"}>
                {formatROI(trader.average_roi)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
} 