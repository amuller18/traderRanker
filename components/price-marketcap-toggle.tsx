"use client"

import { useDisplayPreference } from "@/lib/display-preference-context"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DollarSign, TrendingUp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PriceMarketCapToggleProps {
  className?: string
}

export function PriceMarketCapToggle({ className }: PriceMarketCapToggleProps) {
  const { displayMode, setDisplayMode } = useDisplayPreference()

  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={displayMode}
        onValueChange={(value) => {
          if (value) setDisplayMode(value as 'price' | 'marketcap')
        }}
        className={className}
        size="sm"
        variant="outline"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="price" aria-label="Show prices">
              <DollarSign className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show prices</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="marketcap" aria-label="Show market caps">
              <TrendingUp className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show market caps</p>
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  )
}
