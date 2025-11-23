'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { DeployStrategyFormData } from '../schemas/deployStrategySchema';
import { Shield, DollarSign, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SafetyControlsSectionProps {
  control: Control<DeployStrategyFormData>;
  errors: FieldErrors<DeployStrategyFormData>;
}

export function SafetyControlsSection({ control, errors }: SafetyControlsSectionProps) {
  return (
    <Card className="shadow-sm border border-orange-200 dark:border-orange-900/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-600 dark:text-orange-500" />
          <CardTitle>Safety Controls</CardTitle>
        </div>
        <CardDescription>Protect your capital with automatic risk limits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Loss Limit */}
        <div className="space-y-2">
          <Label htmlFor="daily-loss-limit">Daily Loss Limit</Label>
          <div className="flex gap-2">
            <Controller
              name="safetyControls.dailyLossLimit"
              control={control}
              render={({ field }) => (
                <div className="flex-1 relative">
                  <Input
                    id="daily-loss-limit"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="5"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className={errors.safetyControls?.dailyLossLimit ? 'border-destructive' : ''}
                  />
                  <Controller
                    name="safetyControls.dailyLossLimitType"
                    control={control}
                    render={({ field: typeField }) => (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        {typeField.value === 'dollar' ? '$' : '%'}
                      </div>
                    )}
                  />
                </div>
              )}
            />
            <Controller
              name="safetyControls.dailyLossLimitType"
              control={control}
              render={({ field }) => (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={field.value === 'dollar' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => field.onChange('dollar')}
                    className="h-10 w-10"
                    aria-label="Set dollar limit"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={field.value === 'percentage' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => field.onChange('percentage')}
                    className="h-10 w-10"
                    aria-label="Set percentage limit"
                  >
                    <Percent className="h-4 w-4" />
                  </Button>
                </div>
              )}
            />
          </div>
          {errors.safetyControls?.dailyLossLimit && (
            <p className="text-sm text-destructive">{errors.safetyControls.dailyLossLimit.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Trading will pause when daily losses reach this limit
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cooldown Period */}
          <div className="space-y-2">
            <Label htmlFor="cooldown-period">Cooldown After Stop Loss</Label>
            <div className="relative">
              <Controller
                name="safetyControls.cooldownPeriod"
                control={control}
                render={({ field }) => (
                  <Input
                    id="cooldown-period"
                    type="number"
                    step="1"
                    min="0"
                    max="1440"
                    placeholder="30"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    className={errors.safetyControls?.cooldownPeriod ? 'border-destructive' : ''}
                  />
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                min
              </div>
            </div>
            {errors.safetyControls?.cooldownPeriod && (
              <p className="text-sm text-destructive">
                {errors.safetyControls.cooldownPeriod.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Wait time before allowing new trades after a stop loss
            </p>
          </div>

          {/* Max Trades Per Day */}
          <div className="space-y-2">
            <Label htmlFor="max-trades-per-day">Max Trades Per Day</Label>
            <Controller
              name="safetyControls.maxTradesPerDay"
              control={control}
              render={({ field }) => (
                <Input
                  id="max-trades-per-day"
                  type="number"
                  step="1"
                  min="1"
                  max="1000"
                  placeholder="20"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  className={errors.safetyControls?.maxTradesPerDay ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.safetyControls?.maxTradesPerDay && (
              <p className="text-sm text-destructive">
                {errors.safetyControls.maxTradesPerDay.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Prevent overtrading by limiting daily trade count
            </p>
          </div>
        </div>

        {/* Safety Info */}
        <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-lg">
          <div className="flex gap-2">
            <Shield className="h-4 w-4 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Safety First
              </p>
              <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                These controls automatically protect your capital by pausing trading when limits are reached. Review and adjust them based on your risk tolerance.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
