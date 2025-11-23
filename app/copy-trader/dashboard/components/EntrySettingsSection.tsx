'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDeployStrategyStore } from '../store/deployStrategyStore';
import { TrendingUp, Clock, Info } from 'lucide-react';

export function EntrySettingsSection() {
  const { entrySettings, setEntryType, setEntryDelay } = useDeployStrategyStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Entry Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure how trades are entered (optional)
        </p>
      </div>

      {/* Entry Type */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Entry Type</Label>
        <RadioGroup
          value={entrySettings.entryType}
          onValueChange={(value) => setEntryType(value as 'market' | 'limit')}
          className="flex flex-col space-y-3"
        >
          <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
            <RadioGroupItem value="market" id="market" />
            <Label htmlFor="market" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">Market Order</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enter trades immediately at current market price
              </p>
            </Label>
          </div>

          <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
            <RadioGroupItem value="limit" id="limit" />
            <Label htmlFor="limit" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Limit Order</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enter trades at a specific price or better
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Entry Delay */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="entryDelay" className="text-base font-medium">
            Entry Delay
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Delay trade execution by up to 30 seconds to help avoid
                  front-running and reduce slippage on volatile moves.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {entrySettings.entryDelay} seconds
            </span>
            <span className="text-xs text-muted-foreground">
              {entrySettings.entryDelay === 0
                ? 'Instant execution'
                : 'Anti-front-run protection'}
            </span>
          </div>

          <Slider
            id="entryDelay"
            min={0}
            max={30}
            step={1}
            value={[entrySettings.entryDelay]}
            onValueChange={(value) => setEntryDelay(value[0])}
            className="w-full"
            aria-label="Entry delay in seconds"
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0s (Instant)</span>
            <span>15s</span>
            <span>30s (Max)</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Add a delay before copying trades to reduce front-running risk
        </p>
      </div>
    </div>
  );
}
