"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import type { FilterOptions } from "@/lib/mock-data-provider"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface FilterPanelProps {
  onFilterChange: (filters: FilterOptions) => void
  initialFilters: FilterOptions
}

export function FilterPanel({ onFilterChange, initialFilters }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterOptions>(initialFilters)
  const [isOpen, setIsOpen] = useState(false)

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    console.log("FILTER-PANEL - Filter changed:", key, value)
  }

  const applyFilters = () => {
    console.log("FILTER-PANEL - Applying filters:", filters)
    onFilterChange(filters)
    setIsOpen(false)
  }

  const resetFilters = () => {
    const defaultFilters: FilterOptions = {
      winRateRange: [-100, 100],
      totalCallsRange: [0, 1000000],
      roiRange: [-100, 100],
      searchTerm: "",
    }
    console.log("FILTER-PANEL - Resetting filters to:", defaultFilters)
    setFilters(defaultFilters)
    onFilterChange(defaultFilters)
  }

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search traders..."
            className="pl-8"
            value={filters.searchTerm || ""}
            onChange={(e) => {
              handleFilterChange("searchTerm", e.target.value)
              onFilterChange({ ...filters, searchTerm: e.target.value })
            }}
          />
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Traders</SheetTitle>
              <SheetDescription>Adjust the filters to find traders that match your criteria.</SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Win Rate</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Input
                      type="number"
                      className="w-16 h-6 px-1 text-right"
                      value={Math.round(filters.winRateRange[0] * 100)}
                      onChange={(e) => {
                        const value = Math.max(-100, Math.min(100, Number(e.target.value))) / 100
                        handleFilterChange("winRateRange", [value, filters.winRateRange[1]])
                      }}
                    />
                    <span>% -</span>
                    <Input
                      type="number"
                      className="w-16 h-6 px-1 text-right"
                      value={Math.round(filters.winRateRange[1] * 100)}
                      onChange={(e) => {
                        const value = Math.max(-100, Math.min(100, Number(e.target.value))) / 100
                        handleFilterChange("winRateRange", [filters.winRateRange[0], value])
                      }}
                    />
                    <span>%</span>
                  </div>
                </div>
                <Slider
                  value={[filters.winRateRange[0], filters.winRateRange[1]]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={(value) => handleFilterChange("winRateRange", value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Total Calls</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Input
                      type="number"
                      className="w-16 h-6 px-1 text-right"
                      value={filters.totalCallsRange[0]}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(1000, Number(e.target.value)))
                        handleFilterChange("totalCallsRange", [value, filters.totalCallsRange[1]])
                      }}
                    />
                    <span>-</span>
                    <Input
                      type="number"
                      className="w-16 h-6 px-1 text-right"
                      value={filters.totalCallsRange[1]}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(1000, Number(e.target.value)))
                        handleFilterChange("totalCallsRange", [filters.totalCallsRange[0], value])
                      }}
                    />
                  </div>
                </div>
                <Slider
                  value={[filters.totalCallsRange[0], filters.totalCallsRange[1]]}
                  min={0}
                  max={1000}
                  step={1}
                  onValueChange={(value) => handleFilterChange("totalCallsRange", value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Average ROI</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Input
                      type="number"
                      className="w-16 h-6 px-1 text-right"
                      value={Math.round(filters.roiRange[0] * 100)}
                      onChange={(e) => {
                        const value = Math.max(-100, Math.min(1000, Number(e.target.value))) / 100
                        handleFilterChange("roiRange", [value, filters.roiRange[1]])
                      }}
                    />
                    <span>% -</span>
                    <Input
                      type="number"
                      className="w-16 h-6 px-1 text-right"
                      value={Math.round(filters.roiRange[1] * 100)}
                      onChange={(e) => {
                        const value = Math.max(-100, Math.min(1000, Number(e.target.value))) / 100
                        handleFilterChange("roiRange", [filters.roiRange[0], value])
                      }}
                    />
                    <span>%</span>
                  </div>
                </div>
                <Slider
                  value={[filters.roiRange[0], filters.roiRange[1]]}
                  min={-1}
                  max={10}
                  step={0.1}
                  onValueChange={(value) => handleFilterChange("roiRange", value)}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={applyFilters} className="flex-1">
                  Apply Filters
                </Button>
                <Button variant="outline" onClick={resetFilters} className="flex-1">
                  Reset
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {(filters.winRateRange[0] > -1 ||
          filters.winRateRange[1] < 1 ||
          filters.totalCallsRange[0] > 0 ||
          filters.totalCallsRange[1] < 1000 ||
          filters.roiRange[0] > -1 ||
          filters.roiRange[1] < 10) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  )
}

