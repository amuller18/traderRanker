"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Trophy, Users, Target } from "lucide-react"
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

    setError(null)

    try {
      const data = await fetchTraderStats()

      const uniqueTraders = data.reduce((acc: Trader[], trader) => {
        if (!acc.find(t => t.caller === trader.caller)) {
          acc.push(trader)
        }
        return acc
      }, [])

      setTraders(uniqueTraders)
      setLastUpdated(new Date())
      setError(null)
    } catch (error) {
      console.error('Error fetching traders:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load trader rankings'
      setError(errorMessage)

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

  const totalPages = Math.ceil(sortedTraders.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTraders = sortedTraders.slice(startIndex, endIndex)

  const avgWinRate = traders.length > 0
    ? (traders.reduce((sum, t) => sum + t.win_rate, 0) / traders.length * 100).toFixed(1)
    : '0'
  const avgROI = traders.length > 0
    ? (traders.reduce((sum, t) => sum + t.average_roi, 0) / traders.length).toFixed(1)
    : '0'

  if (loading) {
    return <TraderRankingsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-border/60 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Traders</p>
                <p className="text-2xl font-bold">{traders.length.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-border/60 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-success/10">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Win Rate</p>
                <p className="text-2xl font-bold">{avgWinRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-border/60 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-chart-4/10">
                <TrendingUp className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg ROI</p>
                <p className="text-2xl font-bold">{avgROI}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Rankings</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {lastUpdated && (
            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <span className="hidden sm:inline text-border">|</span>
          <span>
            Showing {startIndex + 1}-{Math.min(endIndex, sortedTraders.length)} of {sortedTraders.length}
          </span>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-2 w-fit"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedTraders.map((trader, index) => (
          <Card key={trader.caller} className="hover:border-border/60 transition-colors">
            <CardContent className="pt-5 pb-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {startIndex + index < 3 && (
                      <div className={`p-1.5 rounded-md ${
                        startIndex + index === 0 ? 'bg-yellow-500/10 text-yellow-500' :
                        startIndex + index === 1 ? 'bg-slate-400/10 text-slate-400' :
                        'bg-amber-600/10 text-amber-600'
                      }`}>
                        <Trophy className="h-4 w-4" />
                      </div>
                    )}
                    <Link
                      href={`/rankings?trader=${encodeURIComponent(trader.caller)}`}
                      className="text-primary hover:underline font-medium truncate"
                    >
                      {trader.caller}
                    </Link>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    #{startIndex + index + 1}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Win Rate</p>
                    <p className="font-semibold">{(trader.win_rate * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Total Calls</p>
                    <p className="font-semibold">{trader.total_calls}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Avg ROI</p>
                    <div className={`font-semibold flex items-center gap-1 ${
                      trader.average_roi >= 0 ? "text-success" : "text-destructive"
                    }`}>
                      {trader.average_roi >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
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
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">#</TableHead>
              <TableHead>Trader</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("win_rate")}
                  className="flex items-center gap-1 -ml-3 h-auto py-0 px-3 hover:bg-transparent text-xs uppercase tracking-wider font-medium"
                >
                  Win Rate
                  {getSortIcon("win_rate")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("total_calls")}
                  className="flex items-center gap-1 -ml-3 h-auto py-0 px-3 hover:bg-transparent text-xs uppercase tracking-wider font-medium"
                >
                  Total Calls
                  {getSortIcon("total_calls")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("average_roi")}
                  className="flex items-center gap-1 -ml-3 h-auto py-0 px-3 hover:bg-transparent text-xs uppercase tracking-wider font-medium"
                >
                  Average ROI
                  {getSortIcon("average_roi")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTraders.map((trader, index) => (
              <TableRow key={trader.caller}>
                <TableCell className="font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {startIndex + index < 3 ? (
                      <div className={`p-1.5 rounded ${
                        startIndex + index === 0 ? 'bg-yellow-500/10 text-yellow-500' :
                        startIndex + index === 1 ? 'bg-slate-400/10 text-slate-400' :
                        'bg-amber-600/10 text-amber-600'
                      }`}>
                        <Trophy className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <span className="w-7 text-center">{startIndex + index + 1}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/rankings?trader=${encodeURIComponent(trader.caller)}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {trader.caller}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{(trader.win_rate * 100).toFixed(1)}%</TableCell>
                <TableCell>{trader.total_calls}</TableCell>
                <TableCell>
                  <span className={`flex items-center gap-1 font-medium ${
                    trader.average_roi >= 0 ? "text-success" : "text-destructive"
                  }`}>
                    {trader.average_roi >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {formatROI(trader.average_roi)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
          <span className="text-sm text-muted-foreground px-4">
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
