'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { DeployStrategyFormData } from '../schemas/deployStrategySchema';
import { TrendingUp, Clock, Info } from 'lucide-react';
import { useState } from 'react';

interface EntrySettingsSectionProps {
  control: Control<DeployStrategyFormData>;
  errors: FieldErrors<DeployStrategyFormData>;
}

export function EntrySettingsSection({ control, errors }: EntrySettingsSectionProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <CardTitle>Entry Settings</CardTitle>
        <CardDescription>Configure how and when positions are entered</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Entry Type */}
          <div className="space-y-2">
            <Label htmlFor="entry-type">Entry Type</Label>
            <Controller
              name="entrySettings.entryType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="entry-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>Market Order</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="limit">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Limit Order</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.entrySettings?.entryType && (
              <p className="text-sm text-destructive">{errors.entrySettings.entryType.message}</p>
            )}
          </div>

          {/* Min Confidence Score */}
          <div className="space-y-2">
            <Label htmlFor="min-confidence-score">
              Min Confidence Score (Optional)
            </Label>
            <Controller
              name="entrySettings.minConfidenceScore"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <Input
                    id="min-confidence-score"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="70"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    className={errors.entrySettings?.minConfidenceScore ? 'border-destructive' : ''}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    %
                  </div>
                </div>
              )}
            />
            {errors.entrySettings?.minConfidenceScore && (
              <p className="text-sm text-destructive">
                {errors.entrySettings.minConfidenceScore.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Only copy trades with this confidence level or higher
            </p>
          </div>
        </div>

        {/* Entry Delay Slider */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="entry-delay">Entry Delay</Label>
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Anti-front-run protection information"
              >
                <Info className="h-4 w-4" />
              </button>
              {showTooltip && (
                <div className="absolute left-0 top-6 z-50 w-64 p-3 bg-popover text-popover-foreground border rounded-lg shadow-lg text-sm">
                  <strong>Anti-Front-Run Protection:</strong> Adds a delay before entering trades to prevent being front-run by bots monitoring the same trader.
                </div>
              )}
            </div>
          </div>
          <Controller
            name="entrySettings.entryDelay"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <input
                    id="entry-delay"
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={field.value}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="w-20 text-sm font-medium text-center py-1.5 px-3 bg-muted rounded-md">
                    {field.value}s
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Instant</span>
                  <span>30 seconds</span>
                </div>
              </div>
            )}
          />
          {errors.entrySettings?.entryDelay && (
            <p className="text-sm text-destructive">{errors.entrySettings.entryDelay.message}</p>
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Entry Type Guide:</strong>
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 mt-2">
            <li>• <strong>Market Order:</strong> Execute immediately at current market price</li>
            <li>• <strong>Limit Order:</strong> Set a price limit for better entry (may not fill)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
