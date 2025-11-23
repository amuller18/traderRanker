'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { DeployStrategyFormData } from '../schemas/deployStrategySchema';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TokenFilteringSectionProps {
  control: Control<DeployStrategyFormData>;
  errors: FieldErrors<DeployStrategyFormData>;
}

export function TokenFilteringSection({ control, errors }: TokenFilteringSectionProps) {
  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <CardTitle>Token Filtering</CardTitle>
        </div>
        <CardDescription>Control which blockchain tokens to trade</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Mode */}
        <div className="space-y-2">
          <Label>Filter Mode</Label>
          <Controller
            name="tokenFiltering.mode"
            control={control}
            render={({ field }) => (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={field.value === 'whitelist' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => field.onChange('whitelist')}
                >
                  Whitelist
                </Button>
                <Button
                  type="button"
                  variant={field.value === 'blacklist' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => field.onChange('blacklist')}
                >
                  Blacklist
                </Button>
              </div>
            )}
          />
          {errors.tokenFiltering?.mode && (
            <p className="text-sm text-destructive">{errors.tokenFiltering.mode.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            <strong>Whitelist:</strong> Only trade selected chains • <strong>Blacklist:</strong> Trade all except selected
          </p>
        </div>

        {/* Chain Selection */}
        <div className="space-y-2">
          <Label>Blockchain Chains</Label>
          <Controller
            name="tokenFiltering.chains"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2">
                {(['ETH', 'SOL', 'SUI'] as const).map((chain) => {
                  const isSelected = field.value.includes(chain);
                  return (
                    <Button
                      key={chain}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      className="h-12"
                      onClick={() => {
                        const newChains = isSelected
                          ? field.value.filter((c) => c !== chain)
                          : [...field.value, chain];
                        field.onChange(newChains);
                      }}
                    >
                      {chain}
                    </Button>
                  );
                })}
              </div>
            )}
          />
          {errors.tokenFiltering?.chains && (
            <p className="text-sm text-destructive">{errors.tokenFiltering.chains.message}</p>
          )}
        </div>

        {/* Info */}
        <Controller
          name="tokenFiltering.mode"
          control={control}
          render={({ field: modeField }) => (
            <Controller
              name="tokenFiltering.chains"
              control={control}
              render={({ field: chainsField }) => (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Current Configuration:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {modeField.value === 'whitelist' ? 'Only trade' : 'Trade all chains except'}{' '}
                    <strong>{chainsField.value.join(', ') || 'none selected'}</strong>
                  </p>
                </div>
              )}
            />
          )}
        />
      </CardContent>
    </Card>
  );
}
