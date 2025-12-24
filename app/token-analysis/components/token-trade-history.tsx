"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import type { Trade } from "@/lib/trader-data"
import { useDisplayPreference } from "@/lib/display-preference-context"
import { PriceMarketCapToggle } from "@/components/price-marketcap-toggle"

interface TokenTradeHistoryProps {
  trades: Trade[]
  tokenSymbol: string
  currentPrice: number
  currentMc?: number
}

const formatPrice = (value: number | undefined): string => {
  if (value === undefined || value === null || isNaN(value)) return "0.00"

  if (value < 0.00000001) {
    return value.toExponential(2)
  }
  if (value < 0.0001) {
    return value.toFixed(8)
  }
  if (value < 1) {
    return value.toFixed(6)
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

const formatPercentage = (value: number | null): string => {
  if (value === null || isNaN(value)) return "N/A"
  return value.toFixed(2) + '%'
}

const formatMarketCap = (mc: number) => {
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(2)}K`
  return `$${mc.toFixed(2)}`
}

export function TokenTradeHistory({ trades, tokenSymbol, currentPrice, currentMc }: TokenTradeHistoryProps) {
  const { displayMode } = useDisplayPreference()
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    date_called: true,
    trader: true,
    entry_price: true,
    current_price: true,
    ath_price: true,
    ath_roi: true,
    roi: true,
  })

  const toggleColumn = (column: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [column]: !prev[column],
    }))
  }

  const calculateRoi = (trade: Trade): number | null => {
    const entryPrice = trade.entry_price
    if (entryPrice === 0 || currentPrice === 0) return null
    return ((currentPrice - entryPrice) / entryPrice) * 100
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Trade History</CardTitle>
            <CardDescription>All trades for {tokenSymbol}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <PriceMarketCapToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Columns <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={columnVisibility.date_called}
                onCheckedChange={() => toggleColumn("date_called")}
              >
                Date Called
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.trader}
                onCheckedChange={() => toggleColumn("trader")}
              >
                Trader
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.entry_price}
                onCheckedChange={() => toggleColumn("entry_price")}
              >
                Entry Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.current_price}
                onCheckedChange={() => toggleColumn("current_price")}
              >
                Current Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.ath_price}
                onCheckedChange={() => toggleColumn("ath_price")}
              >
                ATH Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.ath_roi}
                onCheckedChange={() => toggleColumn("ath_roi")}
              >
                ATH ROI
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.roi}
                onCheckedChange={() => toggleColumn("roi")}
              >
                Current ROI
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnVisibility.date_called && (
                  <th className="p-3 text-left font-medium">Date</th>
                )}
                {columnVisibility.trader && (
                  <th className="p-3 text-left font-medium">Trader</th>
                )}
                {columnVisibility.entry_price && (
                  <th className="p-3 text-left font-medium">
                    {displayMode === 'marketcap' ? 'Entry MC' : 'Entry Price'}
                  </th>
                )}
                {columnVisibility.current_price && (
                  <th className="p-3 text-left font-medium">
                    {displayMode === 'marketcap' ? 'Current MC' : 'Current Price'}
                  </th>
                )}
                {columnVisibility.ath_price && (
                  <th className="p-3 text-left font-medium">
                    {displayMode === 'marketcap' ? 'ATH MC' : 'ATH Price'}
                  </th>
                )}
                {columnVisibility.ath_roi && (
                  <th className="p-3 text-left font-medium">ATH ROI</th>
                )}
                {columnVisibility.roi && (
                  <th className="p-3 text-left font-medium">Current ROI</th>
                )}
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, i) => {
                const roi = calculateRoi(trade)
                return (
                  <tr key={i} className="border-b">
                    {columnVisibility.date_called && (
                      <td className="p-3">{format(new Date(trade.date_called), "MMM d, yyyy HH:mm")}</td>
                    )}
                    {columnVisibility.trader && (
                      <td className="p-3">
                        <Link
                          href={`/rankings?trader=${encodeURIComponent(trade.caller)}`}
                          className="hover:underline text-primary"
                        >
                          {trade.caller}
                        </Link>
                      </td>
                    )}
                    {columnVisibility.entry_price && (
                      <td className="p-3">
                        {displayMode === 'marketcap'
                          ? (trade.initial_mc > 0 ? formatMarketCap(trade.initial_mc) : 'N/A')
                          : formatPrice(trade.entry_price)
                        }
                      </td>
                    )}
                    {columnVisibility.current_price && (
                      <td className="p-3">
                        {displayMode === 'marketcap'
                          ? (currentMc && currentMc > 0 ? formatMarketCap(currentMc) : 'N/A')
                          : formatPrice(currentPrice)
                        }
                      </td>
                    )}
                    {columnVisibility.ath_price && (
                      <td className="p-3">
                        {displayMode === 'marketcap'
                          ? (trade.high_mc > 0 ? formatMarketCap(trade.high_mc) : 'N/A')
                          : formatPrice(trade.ath_price)
                        }
                      </td>
                    )}
                    {columnVisibility.ath_roi && (
                      <td className={`p-3 ${trade.ath_roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatPercentage(trade.ath_roi)}
                      </td>
                    )}
                    {columnVisibility.roi && (
                      <td className={`p-3 ${roi !== null && roi >= 0 ? "text-green-500" : roi !== null ? "text-red-500" : ""}`}>
                        {formatPercentage(roi)}
                      </td>
                    )}
                  </tr>
                )
              })}
              {trades.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-3 text-center text-muted-foreground">
                    No trades found for this token
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
