'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { DeployStrategyFormData } from '../schemas/deployStrategySchema';
import { DollarSign, Percent, Users } from 'lucide-react';

interface PositionSizingSectionProps {
  control: Control<DeployStrategyFormData>;
  errors: FieldErrors<DeployStrategyFormData>;
}

export function PositionSizingSection({ control, errors }: PositionSizingSectionProps) {
  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <CardTitle>Position Sizing</CardTitle>
        <CardDescription>Configure how positions are sized for each trade</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Position Size Mode */}
        <div className="space-y-2">
          <Label htmlFor="position-mode">Position Size Mode</Label>
          <Controller
            name="positionSizing.mode"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="position-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span>Fixed Amount</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="percentage">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      <span>% of Portfolio</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="mirror">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Mirror Trader %</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.positionSizing?.mode && (
            <p className="text-sm text-destructive">{errors.positionSizing.mode.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount Input (Dynamic based on mode) */}
          <div className="space-y-2">
            <Controller
              name="positionSizing.mode"
              control={control}
              render={({ field: modeField }) => (
                <>
                  <Label htmlFor="position-amount">
                    {modeField.value === 'fixed' ? 'Amount ($)' :
                     modeField.value === 'percentage' ? 'Portfolio %' :
                     'Mirror %'}
                  </Label>
                  <Controller
                    name="positionSizing.amount"
                    control={control}
                    render={({ field }) => (
                      <div className="relative">
                        <Input
                          id="position-amount"
                          type="number"
                          step={modeField.value === 'fixed' ? '100' : '0.1'}
                          min="0"
                          max={modeField.value === 'fixed' ? undefined : '100'}
                          placeholder={modeField.value === 'fixed' ? '1000' : '10'}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className={errors.positionSizing?.amount ? 'border-destructive' : ''}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                          {modeField.value === 'fixed' ? '$' : '%'}
                        </div>
                      </div>
                    )}
                  />
                </>
              )}
            />
            {errors.positionSizing?.amount && (
              <p className="text-sm text-destructive">{errors.positionSizing.amount.message}</p>
            )}
          </div>

          {/* Max Position Size */}
          <div className="space-y-2">
            <Label htmlFor="max-position-size">Max Position Size ($)</Label>
            <Controller
              name="positionSizing.maxPositionSize"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <Input
                    id="max-position-size"
                    type="number"
                    step="100"
                    min="1"
                    placeholder="10000"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className={errors.positionSizing?.maxPositionSize ? 'border-destructive' : ''}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    $
                  </div>
                </div>
              )}
            />
            {errors.positionSizing?.maxPositionSize && (
              <p className="text-sm text-destructive">{errors.positionSizing.maxPositionSize.message}</p>
            )}
          </div>

          {/* Max Concurrent Positions */}
          <div className="space-y-2">
            <Label htmlFor="max-concurrent-positions">Max Concurrent Positions</Label>
            <Controller
              name="positionSizing.maxConcurrentPositions"
              control={control}
              render={({ field }) => (
                <Input
                  id="max-concurrent-positions"
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  placeholder="5"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  className={errors.positionSizing?.maxConcurrentPositions ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.positionSizing?.maxConcurrentPositions && (
              <p className="text-sm text-destructive">
                {errors.positionSizing.maxConcurrentPositions.message}
              </p>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Position Sizing Modes:</strong>
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 mt-2">
            <li>• <strong>Fixed Amount:</strong> Each trade uses a fixed dollar amount</li>
            <li>• <strong>% of Portfolio:</strong> Each trade uses a percentage of your total portfolio</li>
            <li>• <strong>Mirror Trader %:</strong> Mirror the trader's position size as a percentage of their portfolio</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
