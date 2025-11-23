'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDeployStrategyStore } from '../store/deployStrategyStore';
import { DollarSign, Percent, Timer, TrendingDown } from 'lucide-react';

export function SafetyControlsSection() {
  const {
    safetyControls,
    setDailyLossLimitMode,
    setDailyLossLimitDollar,
    setDailyLossLimitPercentage,
    setCooldownPeriod,
    setMaxTradesPerDay,
  } = useDeployStrategyStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Safety Controls</h3>
        <p className="text-sm text-muted-foreground">
          Set protective limits to manage risk (optional)
        </p>
      </div>

      {/* Daily Loss Limit */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Daily Loss Limit</Label>

        {/* Mode Toggle */}
        <RadioGroup
          value={safetyControls.dailyLossLimitMode}
          onValueChange={(value) => setDailyLossLimitMode(value as 'dollar' | 'percentage')}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dollar" id="dollar-mode" />
            <Label htmlFor="dollar-mode" className="cursor-pointer font-normal">
              Dollar ($)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="percentage" id="percentage-mode" />
            <Label htmlFor="percentage-mode" className="cursor-pointer font-normal">
              Percentage (%)
            </Label>
          </div>
        </RadioGroup>

        {/* Dynamic Input */}
        <div className="grid gap-4 md:grid-cols-2">
          {safetyControls.dailyLossLimitMode === 'dollar' ? (
            <div className="space-y-2">
              <Label htmlFor="dailyLossLimitDollar">Maximum Daily Loss ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dailyLossLimitDollar"
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  value={safetyControls.dailyLossLimitDollar}
                  onChange={(e) => setDailyLossLimitDollar(Number(e.target.value))}
                  className="pl-9"
                  placeholder="500"
                  aria-label="Daily loss limit in dollars"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Stop trading after losing this amount in a single day
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="dailyLossLimitPercentage">
                Maximum Daily Loss (%)
              </Label>
              <div className="relative">
                <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dailyLossLimitPercentage"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={safetyControls.dailyLossLimitPercentage}
                  onChange={(e) =>
                    setDailyLossLimitPercentage(Number(e.target.value))
                  }
                  className="pl-9"
                  placeholder="10"
                  aria-label="Daily loss limit percentage"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Stop trading after losing this % of portfolio in a day
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cooldown Period */}
      <div className="space-y-2">
        <Label htmlFor="cooldownPeriod" className="text-base font-medium flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Cooldown Period After Stop Loss
        </Label>
        <Input
          id="cooldownPeriod"
          type="number"
          min={0}
          max={1440}
          step={1}
          value={safetyControls.cooldownPeriod}
          onChange={(e) => setCooldownPeriod(Number(e.target.value))}
          className="max-w-xs"
          placeholder="30"
          aria-label="Cooldown period in minutes"
        />
        <p className="text-xs text-muted-foreground">
          Wait this many minutes before resuming trading after a stop loss is hit
          (0-1440 minutes / 24 hours)
        </p>
      </div>

      {/* Max Trades Per Day */}
      <div className="space-y-2">
        <Label htmlFor="maxTradesPerDay" className="text-base font-medium flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Max Trades Per Day
        </Label>
        <Input
          id="maxTradesPerDay"
          type="number"
          min={1}
          max={1000}
          step={1}
          value={safetyControls.maxTradesPerDay}
          onChange={(e) => setMaxTradesPerDay(Number(e.target.value))}
          className="max-w-xs"
          placeholder="10"
          aria-label="Maximum trades per day"
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of trades allowed in a single day (1-1000)
        </p>
      </div>
    </div>
  );
}
