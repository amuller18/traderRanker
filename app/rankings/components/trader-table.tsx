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
    if (roi >= 1) return "text-green-500 font-medium"
    if (roi >= 0) return "text-green-400"
    if (roi >= -0.5) return "text-orange-400"
    return "text-red-500"
  }

  const handleRowClick = (trader: string) => {
    router.push(`/rankings/${encodeURIComponent(trader)}`)
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Trader</TableHead>
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
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(trader.caller)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1">
                    {index < 3 && (
                      <Trophy
                        className={`h-4 w-4 ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : "text-amber-600"}`}
                      />
                    )}
                    {index + 1}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{trader.caller}</div>
                </TableCell>
                <TableCell>{(trader.win_rate * 100).toFixed(1)}%</TableCell>
                <TableCell>{trader.total_calls}</TableCell>
                <TableCell>{trader.winning_calls}</TableCell>
                <TableCell className={getPerformanceClass(trader.average_roi)}>
                  {(trader.average_roi * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/rankings/${encodeURIComponent(trader.caller)}`}>
                    <Button variant="outline" size="sm">
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

