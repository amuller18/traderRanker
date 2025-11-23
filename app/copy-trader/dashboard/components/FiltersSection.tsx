'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Combobox } from '@/components/ui/combobox';
import { useDeployStrategyStore } from '../store/deployStrategyStore';
import { TokenChain } from '../types';
import { Filter, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Common timezone options
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

const TOKEN_CHAINS: { value: TokenChain; label: string; color: string }[] = [
  { value: 'ETH', label: 'Ethereum', color: 'bg-blue-500' },
  { value: 'SOL', label: 'Solana', color: 'bg-purple-500' },
  { value: 'SUI', label: 'Sui', color: 'bg-cyan-500' },
];

export function FiltersSection() {
  const {
    tokenFilters,
    activeHours,
    setFilterMode,
    toggleTokenChain,
    setActiveHoursEnabled,
    setActiveHoursStartTime,
    setActiveHoursEndTime,
    setActiveHoursTimezone,
  } = useDeployStrategyStore();

  return (
    <div className="space-y-8">
      {/* Token Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Token Filters</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Control which blockchain tokens to include or exclude (optional)
        </p>

        {/* Filter Mode */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Filter Mode</Label>
          <RadioGroup
            value={tokenFilters.mode}
            onValueChange={(value) => setFilterMode(value as 'whitelist' | 'blacklist')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="whitelist" id="whitelist" />
              <Label htmlFor="whitelist" className="cursor-pointer font-normal">
                Whitelist (Only selected)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="blacklist" id="blacklist" />
              <Label htmlFor="blacklist" className="cursor-pointer font-normal">
                Blacklist (Exclude selected)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Token Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">
            Select Blockchains
            {tokenFilters.selectedChains.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {tokenFilters.selectedChains.length} selected
              </Badge>
            )}
          </Label>
          <div className="grid gap-3 md:grid-cols-3">
            {TOKEN_CHAINS.map((chain) => {
              const isSelected = tokenFilters.selectedChains.includes(chain.value);
              return (
                <div
                  key={chain.value}
                  className={`
                    flex items-center space-x-3 rounded-lg border p-4 cursor-pointer
                    transition-colors hover:bg-accent
                    ${isSelected ? 'border-primary bg-accent' : ''}
                  `}
                  onClick={() => toggleTokenChain(chain.value)}
                >
                  <Checkbox
                    id={chain.value}
                    checked={isSelected}
                    onCheckedChange={() => toggleTokenChain(chain.value)}
                    aria-label={`Toggle ${chain.label}`}
                  />
                  <Label
                    htmlFor={chain.value}
                    className="flex-1 cursor-pointer flex items-center gap-2"
                  >
                    <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                    <span className="font-medium">{chain.label}</span>
                  </Label>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {tokenFilters.mode === 'whitelist'
              ? 'Only copy trades on selected blockchains'
              : 'Exclude trades on selected blockchains'}
          </p>
        </div>
      </div>

      {/* Active Hours */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Active Trading Hours</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Restrict trading to specific hours (optional)
        </p>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="activeHoursToggle" className="text-base font-medium">
              Enable Active Hours
            </Label>
            <p className="text-sm text-muted-foreground">
              Only copy trades during specified time window
            </p>
          </div>
          <Switch
            id="activeHoursToggle"
            checked={activeHours.enabled}
            onCheckedChange={setActiveHoursEnabled}
            aria-label="Toggle active hours"
          />
        </div>

        {/* Time Configuration (only show when enabled) */}
        {activeHours.enabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Start Time */}
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={activeHours.startTime}
                  onChange={(e) => setActiveHoursStartTime(e.target.value)}
                  aria-label="Trading start time"
                />
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={activeHours.endTime}
                  onChange={(e) => setActiveHoursEndTime(e.target.value)}
                  aria-label="Trading end time"
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Combobox
                id="timezone"
                options={TIMEZONES.map((tz) => ({
                  value: tz,
                  label: tz.replace(/_/g, ' '),
                }))}
                value={activeHours.timezone}
                onValueChange={setActiveHoursTimezone}
                placeholder="Select timezone..."
                searchPlaceholder="Search timezones..."
                emptyText="No timezone found."
              />
            </div>

            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm">
                <span className="font-medium">Active window:</span>{' '}
                {activeHours.startTime} - {activeHours.endTime}{' '}
                <span className="text-muted-foreground">
                  ({activeHours.timezone.replace(/_/g, ' ')})
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
