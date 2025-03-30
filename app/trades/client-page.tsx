"use client"

import { useState, useEffect } from "react"
import { TradesTable } from "./components/trades-table"
import { TradesFilterPanel } from "./components/trades-filter-panel"
import { Card } from "@/components/ui/card"
import { fetchAllTradesFiltered } from "../actions/trader-actions"
import type { Trade, TradeFilterOptions } from "@/lib/trader-data"

interface ClientPageProps {
  initialTrades: Trade[]
  defaultFilters: TradeFilterOptions
}

export function ClientPage({ initialTrades, defaultFilters }: ClientPageProps) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades)
  const [filters, setFilters] = useState<TradeFilterOptions>(defaultFilters)
  const [loading, setLoading] = useState(false)

  // Apply filters when they change
  useEffect(() => {
    const applyFilters = async () => {
      setLoading(true)
      try {
        const filteredTrades = await fetchAllTradesFiltered(filters)
        setTrades(filteredTrades)
      } catch (error) {
        console.error("Error filtering trades:", error)
      } finally {
        setLoading(false)
      }
    }

    applyFilters()
  }, [filters])

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <TradesFilterPanel filters={filters} setFilters={setFilters} />
      </Card>

      <TradesTable trades={trades} loading={loading} />
    </div>
  )
}

export default ClientPage

