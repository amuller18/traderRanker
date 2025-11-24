"use client"

import { useState, useEffect, useCallback } from "react"
import { TradesTable } from "./components/trades-table"
import { TradesFilterPanel } from "./components/trades-filter-panel"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { fetchAllTradesFiltered } from "@/lib/api-client"
import type { Trade, TradeFilterOptions } from "@/lib/trader-data"

interface ClientPageProps {
  initialTrades: Trade[]
  defaultFilters: TradeFilterOptions
}

export function ClientPage({ initialTrades, defaultFilters }: ClientPageProps) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades)
  const [filters, setFilters] = useState<TradeFilterOptions>(defaultFilters)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const applyFilters = useCallback(async () => {
    setLoading(true)
    try {
      const filteredTrades = await fetchAllTradesFiltered(filters)
      setTrades(filteredTrades)
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Error filtering trades:", error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Apply filters when they change
  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <TradesFilterPanel filters={filters} setFilters={setFilters} />
      </Card>

      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lastUpdated && (
            <>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </>
          )}
        </div>
        <Button
          onClick={applyFilters}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <TradesTable trades={trades} loading={loading} />
    </div>
  )
}

export default ClientPage

