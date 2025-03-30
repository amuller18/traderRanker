"use client"

import { useState, useEffect } from "react"
import { FilterPanel } from "./components/filter-panel"
import { TraderTable } from "./components/trader-table"
import type { FilterOptions, TraderStats } from "@/lib/mock-data-provider"
import { fetchTraderStats } from "../actions/trader-actions"

interface ClientPageProps {
  initialTraders: TraderStats[]
  defaultFilters: FilterOptions
}

// Change from named export to default export
export default function ClientPage({ initialTraders, defaultFilters }: ClientPageProps) {
  const [traders, setTraders] = useState<TraderStats[]>(initialTraders)
  const [isLoading, setIsLoading] = useState(false)

  // Log initial traders when component mounts
  useEffect(() => {
    console.log("CLIENT PAGE - Initial traders:", initialTraders)
  }, [initialTraders])

  // Log traders whenever they change
  useEffect(() => {
    console.log("CLIENT PAGE - Current traders after filtering:", traders)
  }, [traders])

  const handleFilterChange = async (filters: FilterOptions) => {
    setIsLoading(true)
    console.log("CLIENT PAGE - Filter change requested with filters:", filters)
    try {
      const filteredTraders = await fetchTraderStats(filters)
      console.log("CLIENT PAGE - Received filtered traders from API:", filteredTraders)
      setTraders(filteredTraders)
    } catch (error) {
      console.error("Error applying filters:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <FilterPanel onFilterChange={handleFilterChange} initialFilters={defaultFilters} />

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <TraderTable traders={traders} />
      )}
    </>
  )
}

