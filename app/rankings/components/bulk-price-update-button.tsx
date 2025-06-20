"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface BulkPriceUpdateButtonProps {
  traderId: string
  totalTrades: number
}

export function BulkPriceUpdateButton({ traderId, totalTrades }: BulkPriceUpdateButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(0)

  const handleBulkUpdate = async () => {
    setIsUpdating(true)
    setUpdateProgress(0)

    try {
      // First, get all trades for this trader
      const response = await fetch(`/api/trader-trades?trader=${encodeURIComponent(traderId)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch trader trades')
      }
      
      const trades = await response.json()
      const tokens = trades.map((trade: any) => trade.ca)

      setUpdateProgress(10)

      // Call the new CoinGecko bulk price endpoint
      const bulkResponse = await fetch('/api/bulk-token-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens })
      })

      if (!bulkResponse.ok) {
        throw new Error('Failed to update prices')
      }

      setUpdateProgress(90)

      const result = await bulkResponse.json()
      
      // Refresh the page to show updated data
      window.location.reload()
      
    } catch (error) {
      console.error('Bulk update error:', error)
      alert('Failed to update prices. Please try again.')
    } finally {
      setIsUpdating(false)
      setUpdateProgress(0)
    }
  }

  return (
    <Button
      onClick={handleBulkUpdate}
      disabled={isUpdating}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
      {isUpdating ? `Updating (${updateProgress}%)` : `Update All Prices (${totalTrades} trades)`}
    </Button>
  )
} 