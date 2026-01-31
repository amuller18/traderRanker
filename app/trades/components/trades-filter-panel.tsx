"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import type { TradeFilterOptions } from "@/lib/trader-data"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Define the fee address constant
const FEE_ADDRESS = "CHc1CC2Z97vJx61nXm6sQdexRApBYx43rTHXisRey1Xy"
const FEE_PERCENTAGE = 0.01 // 1%

interface TradesFilterPanelProps {
  filters: TradeFilterOptions
  setFilters: (filters: TradeFilterOptions) => void
  onProcessTransaction?: (transaction: any) => void
}

export function TradesFilterPanel({ filters, setFilters, onProcessTransaction }: TradesFilterPanelProps) {
  // Create a default filter object to use if filters is undefined
  const defaultFilters: TradeFilterOptions = {
    roiRange: [-10, 10],
    marketCapRange: [0, 1000000000],
    dateRange: [new Date(0), new Date()],
    searchTerm: "",
    traderSearchTerm: "",
    timeframe: "all",
  }

  // Use the provided filters or default if undefined
  const safeFilters = filters || defaultFilters

  const [localFilters, setLocalFilters] = useState<TradeFilterOptions>(safeFilters)
  const [isOpen, setIsOpen] = useState(false)

  const handleFilterChange = (key: keyof TradeFilterOptions, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
  }

  const applyFilters = () => {
    setFilters(localFilters)
    setIsOpen(false)
  }

  const resetFilters = () => {
    setLocalFilters(defaultFilters)
    setFilters(defaultFilters)
  }

  // Function to process transactions with the fee
  const processTransaction = (transaction: any) => {
    if (!transaction) return transaction

    // Check if this transaction is going to the fee address
    if (transaction.recipientAddress === FEE_ADDRESS) {
      // Calculate the fee (1% of the transaction amount)
      const feeAmount = transaction.amount * FEE_PERCENTAGE
      
      // Deduct the fee from the transaction amount
      const newAmount = transaction.amount - feeAmount
      
      // Create a new transaction object with the fee applied
      const processedTransaction = {
        ...transaction,
        amount: newAmount,
        fee: feeAmount,
        originalAmount: transaction.amount,
        feeApplied: true
      }
      
      // If there's a callback provided, call it with the processed transaction
      if (onProcessTransaction) {
        onProcessTransaction(processedTransaction)
      }
      
      return processedTransaction
    }
    
    // If the transaction is not going to the fee address, return it unchanged
    return transaction
  }

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tokens..."
            className="pl-8"
            value={localFilters.searchTerm || ""}
            onChange={(e) => {
              handleFilterChange("searchTerm", e.target.value)
              setFilters({ ...localFilters, searchTerm: e.target.value })
            }}
          />
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search traders..."
            className="pl-8"
            value={localFilters.traderSearchTerm || ""}
            onChange={(e) => {
              handleFilterChange("traderSearchTerm", e.target.value)
              setFilters({ ...localFilters, traderSearchTerm: e.target.value })
            }}
          />
        </div>

        <div className="w-full sm:w-auto">
          <Select
            value={localFilters.timeframe || "all"}
            onValueChange={(value) => {
              const now = new Date()
              let startDate = new Date()

              switch (value) {
                case "day":
                  startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                  break
                case "week":
                  startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                  break
                case "month":
                  startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                  break
                case "year":
                  startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
                  break
                default:
                  startDate = new Date(0) // Beginning of time
              }

              const newFilters = {
                ...localFilters,
                timeframe: value,
                dateRange: [startDate, now] as [Date, Date],
              }

              setLocalFilters(newFilters)
              setFilters(newFilters)
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
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
              <SheetTitle>Filter Trades</SheetTitle>
              <SheetDescription>Adjust the filters to find trades that match your criteria.</SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>ROI Range</Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(localFilters.roiRange[0] * 100)}% - {Math.round(localFilters.roiRange[1] * 100)}%
                  </span>
                </div>
                <Slider
                  defaultValue={[localFilters.roiRange[0], localFilters.roiRange[1]]}
                  min={-10}
                  max={10}
                  step={0.1}
                  onValueChange={(value) => handleFilterChange("roiRange", value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Market Cap</Label>
                  <span className="text-sm text-muted-foreground">
                    ${(localFilters.marketCapRange[0] / 1000000).toFixed(1)}M - $
                    {(localFilters.marketCapRange[1] / 1000000).toFixed(1)}M
                  </span>
                </div>
                <Slider
                  defaultValue={[localFilters.marketCapRange[0], localFilters.marketCapRange[1]]}
                  min={0}
                  max={1000000000}
                  step={1000000}
                  onValueChange={(value) => handleFilterChange("marketCapRange", value)}
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

        {(localFilters.roiRange[0] > -10 ||
          localFilters.roiRange[1] < 10 ||
          localFilters.marketCapRange[0] > 0 ||
          localFilters.marketCapRange[1] < 1000000000 ||
          localFilters.searchTerm ||
          localFilters.traderSearchTerm ||
          localFilters.timeframe !== "all") && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  )
}

