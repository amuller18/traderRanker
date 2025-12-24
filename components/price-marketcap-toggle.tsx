"use client"

import { useDisplayPreference } from "@/lib/display-preference-context"
import { Button } from "@/components/ui/button"
import { ArrowLeftRight } from "lucide-react"

interface PriceMarketCapToggleProps {
  className?: string
}

export function PriceMarketCapToggle({ className }: PriceMarketCapToggleProps) {
  const { displayMode, toggleDisplayMode } = useDisplayPreference()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleDisplayMode}
      className={className}
    >
      <ArrowLeftRight className="h-4 w-4 mr-2" />
      {displayMode === 'price' ? 'Price' : 'Market Cap'}
    </Button>
  )
}
