'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useDeployStrategyStore } from '../store/deployStrategyStore';
import { Settings, Play } from 'lucide-react';

export function OperationalSettingsSection() {
  const {
    operationalSettings,
    setStrategyName,
    setAutoStart,
  } = useDeployStrategyStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Operational Settings</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure strategy naming and startup behavior (optional)
      </p>

      {/* Strategy Name */}
      <div className="space-y-2">
        <Label htmlFor="strategyName" className="text-base font-medium">
          Strategy Name
        </Label>
        <Input
          id="strategyName"
          type="text"
          maxLength={50}
          value={operationalSettings.strategyName}
          onChange={(e) => setStrategyName(e.target.value)}
          placeholder="e.g., Conservative BTC Strategy"
          aria-label="Strategy name"
        />
        <p className="text-xs text-muted-foreground">
          Give your strategy a unique name for easy tracking (max 50 characters)
        </p>
        {operationalSettings.strategyName && (
          <p className="text-xs text-muted-foreground">
            {operationalSettings.strategyName.length} / 50 characters
          </p>
        )}
      </div>

      {/* Auto Start Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5 flex-1">
          <Label htmlFor="autoStart" className="text-base font-medium flex items-center gap-2">
            <Play className="h-4 w-4" />
            Auto-Start Strategy
          </Label>
          <p className="text-sm text-muted-foreground">
            Automatically activate this strategy after deployment
          </p>
        </div>
        <Switch
          id="autoStart"
          checked={operationalSettings.autoStart}
          onCheckedChange={setAutoStart}
          aria-label="Toggle auto-start"
        />
      </div>

      {!operationalSettings.autoStart && (
        <div className="bg-muted rounded-lg p-3">
          <p className="text-sm text-muted-foreground">
            Strategy will be saved as inactive. You can manually activate it later
            from the dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
