'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { DeployStrategyFormData } from '../schemas/deployStrategySchema';
import { Settings, AlertTriangle, PlayCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface OperationalSettingsSectionProps {
  control: Control<DeployStrategyFormData>;
  errors: FieldErrors<DeployStrategyFormData>;
}

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Time (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

export function OperationalSettingsSection({ control, errors }: OperationalSettingsSectionProps) {
  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <CardTitle>Operational Settings</CardTitle>
        </div>
        <CardDescription>Configure strategy name, trading hours, and automation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strategy Name */}
        <div className="space-y-2">
          <Label htmlFor="strategy-name">
            Strategy Name <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="strategyName"
            control={control}
            render={({ field }) => (
              <Input
                id="strategy-name"
                placeholder="e.g., Conservative ETH Trader Copy"
                {...field}
                className={errors.strategyName ? 'border-destructive' : ''}
                maxLength={100}
              />
            )}
          />
          {errors.strategyName && (
            <p className="text-sm text-destructive">{errors.strategyName.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Give your strategy a unique name for easy tracking
          </p>
        </div>

        {/* Active Hours */}
        <div className="space-y-2">
          <Label>Active Trading Hours</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="active-hours-start" className="text-xs text-muted-foreground">
                Start Time
              </Label>
              <Controller
                name="operationalSettings.activeHours.start"
                control={control}
                render={({ field }) => (
                  <Input
                    id="active-hours-start"
                    type="time"
                    {...field}
                    className={errors.operationalSettings?.activeHours?.start ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.operationalSettings?.activeHours?.start && (
                <p className="text-xs text-destructive">
                  {errors.operationalSettings.activeHours.start.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="active-hours-end" className="text-xs text-muted-foreground">
                End Time
              </Label>
              <Controller
                name="operationalSettings.activeHours.end"
                control={control}
                render={({ field }) => (
                  <Input
                    id="active-hours-end"
                    type="time"
                    {...field}
                    className={errors.operationalSettings?.activeHours?.end ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.operationalSettings?.activeHours?.end && (
                <p className="text-xs text-destructive">
                  {errors.operationalSettings.activeHours.end.message}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Strategy will only trade during these hours
          </p>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Controller
            name="operationalSettings.timezone"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone..." />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.operationalSettings?.timezone && (
            <p className="text-sm text-destructive">
              {errors.operationalSettings.timezone.message}
            </p>
          )}
        </div>

        {/* Leverage */}
        <div className="space-y-2">
          <Label htmlFor="leverage">Leverage</Label>
          <Controller
            name="operationalSettings.leverage"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <input
                    id="leverage"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="w-16 text-sm font-medium text-center py-1.5 px-3 bg-muted rounded-md">
                    {field.value}x
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1x</span>
                  <span>10x</span>
                </div>
              </div>
            )}
          />
          {errors.operationalSettings?.leverage && (
            <p className="text-sm text-destructive">
              {errors.operationalSettings.leverage.message}
            </p>
          )}
          <Controller
            name="operationalSettings.leverage"
            control={control}
            render={({ field }) => (
              <>
                {field.value > 5 && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-900 dark:text-orange-100">
                      <strong>High Leverage Warning:</strong> Leverage above 5x significantly increases risk. Use with caution.
                    </p>
                  </div>
                )}
              </>
            )}
          />
        </div>

        {/* Auto Start */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <PlayCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label htmlFor="auto-start" className="cursor-pointer">
                Auto-Start Strategy
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically activate strategy after deployment
              </p>
            </div>
          </div>
          <Controller
            name="operationalSettings.autoStart"
            control={control}
            render={({ field }) => (
              <Switch
                id="auto-start"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
