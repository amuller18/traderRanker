"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { TraderStats } from "@/lib/mock-data-provider"
import { ArrowUpDown, ChevronDown, ChevronUp, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface TraderTableProps {
  traders: TraderStats[]
}

type SortField = "win_rate" | "total_calls" | "average_roi" | "winning_calls"
type SortDirection = "asc" | "desc"

export function TraderTable({ traders }: TraderTableProps) {
  const [sortField, setSortField] = useState<SortField>("average_roi")
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
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (sortDirection === "asc") {
      return aValue - bValue
    } else {
      return bValue - aValue
    }
  })

  const getPerformanceClass = (roi: number) => {
    if (roi >= 1) return "text-success font-semibold"
    if (roi >= 0) return "text-success font-medium"
    if (roi >= -0.5) return "text-warning font-medium"
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
                onClick={() => handleSort("win_rate")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                Win Rate
                {sortField === "win_rate" ? (
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
                onClick={() => handleSort("total_calls")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                Total Calls
                {sortField === "total_calls" ? (
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
                onClick={() => handleSort("winning_calls")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                Winning Calls
                {sortField === "winning_calls" ? (
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
                onClick={() => handleSort("average_roi")}
                className="flex items-center gap-1 p-0 h-auto font-medium"
              >
                Avg. ROI
                {sortField === "average_roi" ? (
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
              <TableCell colSpan={6} className="h-24 text-center">
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
                <TableCell className="font-medium">{(trader.win_rate * 100).toFixed(1)}%</TableCell>
                <TableCell className="font-medium">{trader.total_calls}</TableCell>
                <TableCell className="font-medium">{trader.winning_calls}</TableCell>
                <TableCell className={getPerformanceClass(trader.average_roi)}>
                  {trader.average_roi >= 0 ? "+" : ""}{(trader.average_roi * 100).toFixed(1)}%
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

