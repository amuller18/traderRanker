'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDeployStrategyStore } from '../store/deployStrategyStore';
import { DollarSign, Percent } from 'lucide-react';

export function PositionSizingSection() {
  const {
    positionSizing,
    setPositionSizingMode,
    setFixedAmount,
    setPortfolioPercentage,
    setMaxPositionSize,
    setMaxConcurrentPositions,
  } = useDeployStrategyStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Position Sizing</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure how much capital to allocate per trade
        </p>
      </div>

      {/* Position Sizing Mode */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Sizing Mode <span className="text-destructive">*</span>
        </Label>
        <RadioGroup
          value={positionSizing.mode}
          onValueChange={(value) => setPositionSizingMode(value as 'fixed' | 'percentage')}
          className="flex flex-col space-y-3"
        >
          <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
            <RadioGroupItem value="fixed" id="fixed" />
            <Label htmlFor="fixed" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">Fixed Amount</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Use a fixed dollar amount for each position
              </p>
            </Label>
          </div>

          <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
            <RadioGroupItem value="percentage" id="percentage" />
            <Label htmlFor="percentage" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                <span className="font-medium">% of Portfolio</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Use a percentage of your total portfolio value
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Dynamic Input Based on Mode */}
      <div className="grid gap-6 md:grid-cols-2">
        {positionSizing.mode === 'fixed' ? (
          <div className="space-y-2">
            <Label htmlFor="fixedAmount">
              Fixed Amount ($) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="fixedAmount"
                type="number"
                min={1}
                max={1000000}
                step={1}
                value={positionSizing.fixedAmount}
                onChange={(e) => setFixedAmount(Number(e.target.value))}
                className="pl-9"
                placeholder="100"
                aria-label="Fixed amount in dollars"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum: $1, Maximum: $1,000,000
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="portfolioPercentage">
              Portfolio % <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="portfolioPercentage"
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={positionSizing.portfolioPercentage}
                onChange={(e) => setPortfolioPercentage(Number(e.target.value))}
                className="pl-9"
                placeholder="5"
                aria-label="Percentage of portfolio"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum: 0.1%, Maximum: 100%
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="maxPositionSize">
            Max Position Size ($) <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="maxPositionSize"
              type="number"
              min={0}
              max={10000000}
              step={1}
              value={positionSizing.maxPositionSize}
              onChange={(e) => setMaxPositionSize(Number(e.target.value))}
              className="pl-9"
              placeholder="0 for unlimited"
              aria-label="Maximum position size in dollars"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {positionSizing.maxPositionSize === 0
              ? 'Currently unlimited (no cap)'
              : 'Cap on individual position size'}
          </p>
        </div>
      </div>

      {/* Max Concurrent Positions */}
      <div className="space-y-2">
        <Label htmlFor="maxConcurrentPositions">
          Max Concurrent Positions <span className="text-destructive">*</span>
        </Label>
        <Input
          id="maxConcurrentPositions"
          type="number"
          min={0}
          max={100}
          step={1}
          value={positionSizing.maxConcurrentPositions}
          onChange={(e) => setMaxConcurrentPositions(Number(e.target.value))}
          className="max-w-xs"
          placeholder="0 for unlimited"
          aria-label="Maximum concurrent positions"
          required
        />
        <p className="text-xs text-muted-foreground">
          {positionSizing.maxConcurrentPositions === 0
            ? 'Currently unlimited (no limit on concurrent positions)'
            : `Maximum ${positionSizing.maxConcurrentPositions} simultaneous open positions`}
        </p>
      </div>
    </div>
  );
}
