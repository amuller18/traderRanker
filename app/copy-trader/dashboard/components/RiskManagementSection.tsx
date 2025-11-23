'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { DeployStrategyFormData } from '../schemas/deployStrategySchema';
import { TrendingDown } from 'lucide-react';

interface RiskManagementSectionProps {
  control: Control<DeployStrategyFormData>;
  errors: FieldErrors<DeployStrategyFormData>;
}

export function RiskManagementSection({ control, errors }: RiskManagementSectionProps) {
  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          <CardTitle>Risk Management</CardTitle>
        </div>
        <CardDescription>Additional risk controls and trading parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slippage Tolerance */}
          <div className="space-y-2">
            <Label htmlFor="slippage-tolerance">Slippage Tolerance</Label>
            <div className="relative">
              <Controller
                name="riskManagement.slippageTolerance"
                control={control}
                render={({ field }) => (
                  <Input
                    id="slippage-tolerance"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="1"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className={errors.riskManagement?.slippageTolerance ? 'border-destructive' : ''}
                  />
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                %
              </div>
            </div>
            {errors.riskManagement?.slippageTolerance && (
              <p className="text-sm text-destructive">
                {errors.riskManagement.slippageTolerance.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum acceptable price movement during trade execution
            </p>
          </div>

          {/* Max Drawdown */}
          <div className="space-y-2">
            <Label htmlFor="max-drawdown">Max Drawdown Protection</Label>
            <div className="relative">
              <Controller
                name="riskManagement.maxDrawdown"
                control={control}
                render={({ field }) => (
                  <Input
                    id="max-drawdown"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="20"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className={errors.riskManagement?.maxDrawdown ? 'border-destructive' : ''}
                  />
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                %
              </div>
            </div>
            {errors.riskManagement?.maxDrawdown && (
              <p className="text-sm text-destructive">
                {errors.riskManagement.maxDrawdown.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Strategy pauses if portfolio drops by this percentage from peak
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Risk Management Tips:</strong>
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 mt-2">
            <li>• Lower slippage tolerance = better prices but higher chance of failed trades</li>
            <li>• Max drawdown protection helps preserve capital during market downturns</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
