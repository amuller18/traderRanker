"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  Columns,
  RotateCcw,
  Trophy,
  ArrowUpDown,
  Plus
} from "lucide-react"
import { formatROI } from "@/lib/utils"
import { fetchTraderStats } from "@/lib/api-client"
import { TraderRankingsSkeleton } from "./trader-rankings-skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import type { TraderStats } from "@/lib/trader-data"

type SortField =
  | "win_rate_pct"
  | "n_calls"
  | "mean_ath_roi_pct"
  | "median_ath_roi_pct"
  | "ev"
  | "hit_2x_pct"
  | "hit_5x_pct"
  | "hit_10x_pct"
  | "hit_20x_pct"
  | "best_roi_pct"
  | "worst_roi_pct"
  | "sharpe_ratio"
  | "consistency_score"
  | "risk_score"

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

export function TraderRankings() {
  const [traders, setTraders] = useState<TraderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("mean_ath_roi_pct")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [minWinRate, setMinWinRate] = useState("")
  const [minCalls, setMinCalls] = useState("")
  const [minROI, setMinROI] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    rank: true,
    trader: true,
    win_rate_pct: true,
    n_calls: true,
    mean_ath_roi_pct: true,
    median_ath_roi_pct: false,
    hit_2x_pct: false,
    hit_5x_pct: false,
    hit_10x_pct: true,
    hit_20x_pct: false,
    ev: true,
    sharpe_ratio: false,
    best_roi_pct: false,
    worst_roi_pct: false,
    consistency_score: false,
    risk_score: false,
  })

  const fetchTraders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      const data = await fetchTraderStats()

      // Deduplicate traders by caller
      const uniqueTraders = data.reduce((acc: TraderStats[], trader) => {
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

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setMinWinRate("")
    setMinCalls("")
    setMinROI("")
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || minWinRate || minCalls || minROI

  const toggleColumn = (key: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Filter and sort traders
  const filteredAndSortedTraders = useMemo(() => {
    let result = [...traders]

    // Apply filters
    if (searchTerm) {
      result = result.filter(t =>
        t.caller.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (minWinRate) {
      const minWR = parseFloat(minWinRate)
      if (!isNaN(minWR)) {
        result = result.filter(t => (t.win_rate_pct ?? 0) >= minWR)
      }
    }

    if (minCalls) {
      const minC = parseInt(minCalls)
      if (!isNaN(minC)) {
        result = result.filter(t => (t.n_calls ?? 0) >= minC)
      }
    }

    if (minROI) {
      const minR = parseFloat(minROI)
      if (!isNaN(minR)) {
        result = result.filter(t => (t.mean_ath_roi_pct ?? 0) >= minR)
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue = (a[sortField] as number) ?? 0
      const bValue = (b[sortField] as number) ?? 0

      if (sortDirection === "asc") {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return result
  }, [traders, searchTerm, minWinRate, minCalls, minROI, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTraders.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedTraders = filteredAndSortedTraders.slice(startIndex, startIndex + pageSize)

  const getPerformanceClass = (value: number, type: "roi" | "percentage" | "ratio" = "roi") => {
    if (type === "roi") {
      if (value >= 100) return "text-emerald-400 font-semibold"
      if (value >= 0) return "text-emerald-500"
      if (value >= -50) return "text-amber-400"
      return "text-red-400"
    }
    if (type === "percentage") {
      if (value >= 70) return "text-emerald-400 font-semibold"
      if (value >= 50) return "text-emerald-500"
      if (value >= 30) return "text-amber-400"
      return "text-red-400"
    }
    if (type === "ratio") {
      if (value >= 2) return "text-emerald-400 font-semibold"
      if (value >= 1) return "text-emerald-500"
      if (value >= 0) return "text-amber-400"
      return "text-red-400"
    }
    return ""
  }

  const getRiskClass = (value: number) => {
    if (value <= 30) return "text-emerald-400"
    if (value <= 50) return "text-amber-400"
    if (value <= 70) return "text-orange-400"
    return "text-red-400"
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 p-0 h-auto font-medium hover:bg-transparent"
    >
      {label}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </Button>
  )

  const columnOptions = [
    { key: "rank", label: "Rank" },
    { key: "trader", label: "Trader" },
    { key: "win_rate_pct", label: "Win Rate" },
    { key: "n_calls", label: "Total Calls" },
    { key: "mean_ath_roi_pct", label: "Mean ROI" },
    { key: "median_ath_roi_pct", label: "Median ROI" },
    { key: "hit_2x_pct", label: "2x Hit %" },
    { key: "hit_5x_pct", label: "5x Hit %" },
    { key: "hit_10x_pct", label: "10x Hit %" },
    { key: "hit_20x_pct", label: "20x Hit %" },
    { key: "ev", label: "EV" },
    { key: "sharpe_ratio", label: "Sharpe Ratio" },
    { key: "best_roi_pct", label: "Best ROI" },
    { key: "worst_roi_pct", label: "Worst ROI" },
    { key: "consistency_score", label: "Consistency" },
    { key: "risk_score", label: "Risk Score" },
  ]

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

      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        {/* Search and Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search traders..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9"
            />
          </div>

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {[searchTerm, minWinRate, minCalls, minROI].filter(Boolean).length}
              </Badge>
            )}
          </Button>

          {/* Column Visibility */}
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

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </Button>
          )}

          {/* Submit Group Button */}
          <Link href="/submit">
            <Button
              variant="default"
              size="sm"
              className="gap-2 ml-auto"
            >
              <Plus className="h-4 w-4" />
              Submit Group
            </Button>
          </Link>

          {/* Refresh Button */}
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

        {/* Filter Panel */}
        {showFilters && (
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg border bg-muted/30">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Min Win Rate %</label>
              <Input
                type="number"
                placeholder="0"
                value={minWinRate}
                onChange={(e) => {
                  setMinWinRate(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-24"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Min Calls</label>
              <Input
                type="number"
                placeholder="0"
                value={minCalls}
                onChange={(e) => {
                  setMinCalls(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-24"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Min ROI %</label>
              <Input
                type="number"
                placeholder="0"
                value={minROI}
                onChange={(e) => {
                  setMinROI(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-24"
              />
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
            <span>
              Showing {startIndex + 1}-{Math.min(startIndex + pageSize, filteredAndSortedTraders.length)} of {filteredAndSortedTraders.length} traders
              {hasActiveFilters && ` (filtered from ${traders.length})`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {paginatedTraders.map((trader, index) => {
          const globalRank = startIndex + index + 1
          return (
            <Card key={trader.caller} className="shadow-elevated">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {globalRank <= 3 && (
                        <Trophy className={`h-5 w-5 ${
                          globalRank === 1 ? "text-yellow-400" :
                          globalRank === 2 ? "text-gray-400" :
                          "text-amber-600"
                        }`} />
                      )}
                      <span className="text-sm text-muted-foreground">#{globalRank}</span>
                    </div>
                    <Link href={`/rankings?trader=${encodeURIComponent(trader.caller)}`} className="text-primary hover:underline font-semibold">
                      {trader.caller}
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                      <div className={`font-semibold ${getPerformanceClass(trader.win_rate_pct ?? 0, "percentage")}`}>
                        {(trader.win_rate_pct ?? 0).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Calls</div>
                      <div className="font-semibold">{trader.n_calls ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Mean ROI</div>
                      <div className={`font-semibold ${getPerformanceClass(trader.mean_ath_roi_pct ?? 0)}`}>
                        {(trader.mean_ath_roi_pct ?? 0) >= 0 ? "+" : ""}{(trader.mean_ath_roi_pct ?? 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {columnVisibility.hit_10x_pct && (
                    <div className="grid grid-cols-2 gap-3 text-center pt-2 border-t">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">10x Hit Rate</div>
                        <div className={`font-semibold ${getPerformanceClass(trader.hit_10x_pct ?? 0, "percentage")}`}>
                          {(trader.hit_10x_pct ?? 0).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">EV</div>
                        <div className={`font-semibold ${getPerformanceClass(trader.ev ?? 0)}`}>
                          {(trader.ev ?? 0) >= 0 ? "+" : ""}{(trader.ev ?? 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border shadow-elevated glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                {columnVisibility.rank && (
                  <TableHead className="w-16 text-center font-semibold">Rank</TableHead>
                )}
                {columnVisibility.trader && (
                  <TableHead className="min-w-[120px] text-center font-semibold">Trader</TableHead>
                )}
                {columnVisibility.win_rate_pct && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="win_rate_pct" label="Win Rate" />
                  </TableHead>
                )}
                {columnVisibility.n_calls && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="n_calls" label="Calls" />
                  </TableHead>
                )}
                {columnVisibility.mean_ath_roi_pct && (
                  <TableHead className="w-[110px] text-center">
                    <SortButton field="mean_ath_roi_pct" label="Mean ROI" />
                  </TableHead>
                )}
                {columnVisibility.median_ath_roi_pct && (
                  <TableHead className="w-[110px] text-center">
                    <SortButton field="median_ath_roi_pct" label="Median ROI" />
                  </TableHead>
                )}
                {columnVisibility.hit_2x_pct && (
                  <TableHead className="w-[90px] text-center">
                    <SortButton field="hit_2x_pct" label="2x %" />
                  </TableHead>
                )}
                {columnVisibility.hit_5x_pct && (
                  <TableHead className="w-[90px] text-center">
                    <SortButton field="hit_5x_pct" label="5x %" />
                  </TableHead>
                )}
                {columnVisibility.hit_10x_pct && (
                  <TableHead className="w-[90px] text-center">
                    <SortButton field="hit_10x_pct" label="10x %" />
                  </TableHead>
                )}
                {columnVisibility.hit_20x_pct && (
                  <TableHead className="w-[90px] text-center">
                    <SortButton field="hit_20x_pct" label="20x %" />
                  </TableHead>
                )}
                {columnVisibility.ev && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="ev" label="EV" />
                  </TableHead>
                )}
                {columnVisibility.sharpe_ratio && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="sharpe_ratio" label="Sharpe" />
                  </TableHead>
                )}
                {columnVisibility.best_roi_pct && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="best_roi_pct" label="Best ROI" />
                  </TableHead>
                )}
                {columnVisibility.worst_roi_pct && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="worst_roi_pct" label="Worst ROI" />
                  </TableHead>
                )}
                {columnVisibility.consistency_score && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="consistency_score" label="Consistency" />
                  </TableHead>
                )}
                {columnVisibility.risk_score && (
                  <TableHead className="w-[100px] text-center">
                    <SortButton field="risk_score" label="Risk" />
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTraders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={Object.values(columnVisibility).filter(Boolean).length}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-50" />
                      <p>No traders found matching your criteria.</p>
                      {hasActiveFilters && (
                        <Button variant="link" onClick={clearFilters} className="text-primary">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTraders.map((trader, index) => {
                  const globalRank = startIndex + index + 1
                  return (
                    <TableRow
                      key={trader.caller}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => window.location.href = `/rankings?trader=${encodeURIComponent(trader.caller)}`}
                    >
                      {columnVisibility.rank && (
                        <TableCell className="text-center font-semibold">
                          <div className="flex items-center justify-center gap-2">
                            {globalRank <= 3 && (
                              <Trophy
                                className={`h-4 w-4 ${
                                  globalRank === 1 ? "text-yellow-400" :
                                  globalRank === 2 ? "text-gray-400" :
                                  "text-amber-600"
                                }`}
                              />
                            )}
                            <span className={globalRank <= 3 ? "text-primary" : ""}>
                              {globalRank}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      {columnVisibility.trader && (
                        <TableCell className="text-center">
                          <Link
                            href={`/rankings?trader=${encodeURIComponent(trader.caller)}`}
                            className="font-semibold text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {trader.caller}
                          </Link>
                        </TableCell>
                      )}
                      {columnVisibility.win_rate_pct && (
                        <TableCell className={`text-center font-medium ${getPerformanceClass(trader.win_rate_pct ?? 0, "percentage")}`}>
                          {(trader.win_rate_pct ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.n_calls && (
                        <TableCell className="text-center font-medium">
                          {trader.n_calls ?? 0}
                        </TableCell>
                      )}
                      {columnVisibility.mean_ath_roi_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.mean_ath_roi_pct ?? 0)}`}>
                          {(trader.mean_ath_roi_pct ?? 0) >= 0 ? "+" : ""}
                          {(trader.mean_ath_roi_pct ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.median_ath_roi_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.median_ath_roi_pct ?? 0)}`}>
                          {(trader.median_ath_roi_pct ?? 0) >= 0 ? "+" : ""}
                          {(trader.median_ath_roi_pct ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.hit_2x_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.hit_2x_pct ?? 0, "percentage")}`}>
                          {(trader.hit_2x_pct ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.hit_5x_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.hit_5x_pct ?? 0, "percentage")}`}>
                          {(trader.hit_5x_pct ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.hit_10x_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.hit_10x_pct ?? 0, "percentage")}`}>
                          {(trader.hit_10x_pct ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.hit_20x_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.hit_20x_pct ?? 0, "percentage")}`}>
                          {(trader.hit_20x_pct ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.ev && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.ev ?? 0)}`}>
                          {(trader.ev ?? 0) >= 0 ? "+" : ""}
                          {(trader.ev ?? 0).toFixed(1)}%
                        </TableCell>
                      )}
                      {columnVisibility.sharpe_ratio && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.sharpe_ratio ?? 0, "ratio")}`}>
                          {(trader.sharpe_ratio ?? 0).toFixed(2)}
                        </TableCell>
                      )}
                      {columnVisibility.best_roi_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.best_roi_pct ?? 0)}`}>
                          {(trader.best_roi_pct ?? 0) >= 0 ? "+" : ""}
                          {(trader.best_roi_pct ?? 0).toFixed(0)}%
                        </TableCell>
                      )}
                      {columnVisibility.worst_roi_pct && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.worst_roi_pct ?? 0)}`}>
                          {(trader.worst_roi_pct ?? 0) >= 0 ? "+" : ""}
                          {(trader.worst_roi_pct ?? 0).toFixed(0)}%
                        </TableCell>
                      )}
                      {columnVisibility.consistency_score && (
                        <TableCell className={`text-center ${getPerformanceClass(trader.consistency_score ?? 0, "percentage")}`}>
                          {(trader.consistency_score ?? 0).toFixed(1)}
                        </TableCell>
                      )}
                      {columnVisibility.risk_score && (
                        <TableCell className={`text-center ${getRiskClass(trader.risk_score ?? 0)}`}>
                          {(trader.risk_score ?? 0).toFixed(1)}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
