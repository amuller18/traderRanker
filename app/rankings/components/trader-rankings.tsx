"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { formatROI } from "@/lib/utils"
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
  const [sortField, setSortField] = useState<keyof Trader>("win_rate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    const fetchTraders = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/traders`)
        if (!response.ok) throw new Error('Failed to fetch traders')
        const data = await response.json()
        setTraders(data)
      } catch (error) {
        console.error('Error fetching traders:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTraders()
  }, [])

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

  if (loading) {
    return <div>Loading traders...</div>
  }

  return (
    <div className="rounded-md border">
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
          {sortedTraders.map((trader) => (
            <TableRow key={trader.caller}>
              <TableCell>
                <Link href={`/trader/${trader.caller}`} className="text-primary hover:underline">
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
  )
} 