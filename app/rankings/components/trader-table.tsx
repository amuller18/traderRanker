"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { TraderStats } from "@/lib/trader-data"
import { ArrowUpDown, ChevronDown, ChevronUp, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface TraderTableProps {
  traders: TraderStats[]
}

type SortField = "win_rate_pct" | "n_calls" | "mean_ath_roi_pct" | "ev" | "sharpe_ratio" | "hit_10x_pct"
type SortDirection = "asc" | "desc"

export function TraderTable({ traders }: TraderTableProps) {
  const [sortField, setSortField] = useState<SortField>("mean_ath_roi_pct")
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

  const sortedTraders = [...traders].sort((a, b) => {
    const aValue = a[sortField] || 0
    const bValue = b[sortField] || 0

    if (sortDirection === "asc") {
      return aValue - bValue
    } else {
      return bValue - aValue
    }
  })

  const getPerformanceClass = (roi: number) => {
    if (roi >= 100) return "text-success font-semibold"
    if (roi >= 0) return "text-success font-medium"
    if (roi >= -50) return "text-warning font-medium"
    return "text-destructive font-medium"
  }

  const handleRowClick = (trader: string) => {
    router.push(`/rankings?trader=${encodeURIComponent(trader)}`)
  }

  return (
    <div className="rounded-xl border shadow-elevated glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-12 font-semibold">Rank</TableHead>
            <TableHead className="font-semibold">Trader</TableHead>
            <TableHead className="w-[120px]">
              <Button
                variant="ghost"
                onClick={() => handleSort("win_rate_pct")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                Win Rate
                {sortField === "win_rate_pct" ? (
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
                onClick={() => handleSort("n_calls")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                Total Calls
                {sortField === "n_calls" ? (
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
                onClick={() => handleSort("mean_ath_roi_pct")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                Mean ATH ROI
                {sortField === "mean_ath_roi_pct" ? (
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
                onClick={() => handleSort("hit_10x_pct")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                10x Hit %
                {sortField === "hit_10x_pct" ? (
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
                onClick={() => handleSort("ev")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                EV
                {sortField === "ev" ? (
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
            <TableHead className="text-right w-[100px]">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTraders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center">
                No traders found.
              </TableCell>
            </TableRow>
          ) : (
            sortedTraders.map((trader, index) => (
              <TableRow
                key={trader.caller}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(trader.caller)}
              >
                <TableCell className="font-semibold">
                  <div className="flex items-center gap-2">
                    {index < 3 && (
                      <Trophy
                        className={`h-4 w-4 ${index === 0 ? "text-warning" : index === 1 ? "text-muted-foreground" : "text-chart-3"}`}
                      />
                    )}
                    <span className={index < 3 ? "text-primary" : ""}>{index + 1}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-foreground">{trader.caller}</div>
                </TableCell>
                <TableCell className="font-medium">{(trader.win_rate_pct ?? 0).toFixed(1)}%</TableCell>
                <TableCell className="font-medium">{trader.n_calls}</TableCell>
                <TableCell className={getPerformanceClass(trader.mean_ath_roi_pct ?? 0)}>
                  {(trader.mean_ath_roi_pct ?? 0) >= 0 ? "+" : ""}{(trader.mean_ath_roi_pct ?? 0).toFixed(1)}%
                </TableCell>
                <TableCell className="font-medium">{(trader.hit_10x_pct ?? 0).toFixed(1)}%</TableCell>
                <TableCell className={getPerformanceClass(trader.ev ?? 0)}>
                  {(trader.ev ?? 0) >= 0 ? "+" : ""}{(trader.ev ?? 0).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/rankings?trader=${encodeURIComponent(trader.caller)}`}>
                    <Button variant="outline" size="sm" className="hover-lift">
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

