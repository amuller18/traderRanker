'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockCallerOptions } from '../data/mock';
import { Plus, Trash2, Rocket, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { deployStrategySchema, deployStrategyDefaults, DeployStrategyFormData } from '../schemas/deployStrategySchema';
import { PositionSizingSection } from './PositionSizingSection';
import { EntrySettingsSection } from './EntrySettingsSection';
import { SafetyControlsSection } from './SafetyControlsSection';
import { OperationalSettingsSection } from './OperationalSettingsSection';
import { TokenFilteringSection } from './TokenFilteringSection';
import { RiskManagementSection } from './RiskManagementSection';

export function EnhancedDeployStrategyForm() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<DeployStrategyFormData>({
    resolver: zodResolver(deployStrategySchema),
    defaultValues: deployStrategyDefaults,
    mode: 'onChange',
  });

  const profitStrategy = watch('profitStrategy');
  const tpslRows = watch('tpslRows');

  const generateId = () => `tpsl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addTPSLRow = () => {
    const newRow = {
      id: generateId(),
      conditionType: 'TP' as const,
      percentageTrigger: 0,
      sellPercent: 0,
    };
    setValue('tpslRows', [...tpslRows, newRow]);
  };

  const removeTPSLRow = (id: string) => {
    setValue('tpslRows', tpslRows.filter((row) => row.id !== id));
  };

  const updateTPSLRow = (id: string, field: string, value: any) => {
    setValue(
      'tpslRows',
      tpslRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const onSubmit = async (data: DeployStrategyFormData) => {
    setIsDeploying(true);

    // TODO: Replace with actual API call
    const config = {
      ...data,
      tpslRows: profitStrategy === 'custom' ? data.tpslRows : data.tpslRows.slice(0, 2),
    };

    console.log('Deploy Strategy Config:', config);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const selectedTrader = mockCallerOptions.find((opt) => opt.value === data.callerInput);
    toast.success('Strategy Deployed Successfully!', {
      description: `"${data.strategyName}" deployed for ${selectedTrader?.label || 'selected trader'}`,
      duration: 5000,
    });

    setTimeout(() => {
      reset(deployStrategyDefaults);
      setIsDeploying(false);
    }, 500);
  };

  const onSaveDraft = async () => {
    setIsSavingDraft(true);

    // Get current form values
    const formData = watch();

    // TODO: Replace with actual API call to save draft
    const draft = {
      id: `draft-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...formData,
    };

    console.log('Save Draft:', draft);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    toast.success('Draft Saved!', {
      description: 'Your strategy configuration has been saved as a draft',
      duration: 3000,
    });

    setIsSavingDraft(false);
  };

  const isDefaultStrategy = profitStrategy === 'default';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Trader Selection */}
      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle>Select Trader</CardTitle>
          <CardDescription>Choose a trader to copy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="caller-input">Trader</Label>
            <Controller
              name="callerInput"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="caller-input" className={errors.callerInput ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select a trader..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCallerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.callerInput && (
              <p className="text-sm text-destructive">{errors.callerInput.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exit Strategy (TP/SL) */}
      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle>Exit Strategy</CardTitle>
          <CardDescription>Configure your take profit and stop loss settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profit-strategy">Strategy Type</Label>
            <Controller
              name="profitStrategy"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="profit-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Strategy</SelectItem>
                    <SelectItem value="custom">Custom Strategy</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Default Strategy Display */}
          {isDefaultStrategy && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="text-sm font-medium">Default Configuration:</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• Take Profit: +100% → Sell 100%</div>
                <div>• Stop Loss: -90% → Sell 100%</div>
              </div>
            </div>
          )}

          {/* Custom Strategy Table */}
          {!isDefaultStrategy && (
            <div className="space-y-4">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Type</TableHead>
                      <TableHead>Trigger %</TableHead>
                      <TableHead>Sell %</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tpslRows.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Select
                            value={row.conditionType}
                            onValueChange={(value) => updateTPSLRow(row.id, 'conditionType', value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TP">Take Profit</SelectItem>
                              <SelectItem value="SL">Stop Loss</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={row.percentageTrigger}
                              onChange={(e) => updateTPSLRow(row.id, 'percentageTrigger', Number(e.target.value))}
                              className="h-9"
                              placeholder="0"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={row.sellPercent}
                              onChange={(e) => updateTPSLRow(row.id, 'sellPercent', Number(e.target.value))}
                              className="h-9"
                              placeholder="0"
                              min="0"
                              max="100"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => removeTPSLRow(row.id)}
                            disabled={tpslRows.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={addTPSLRow}>
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Sizing */}
      <PositionSizingSection control={control} errors={errors} />

      {/* Entry Settings */}
      <EntrySettingsSection control={control} errors={errors} />

      {/* Safety Controls */}
      <SafetyControlsSection control={control} errors={errors} />

      {/* Operational Settings */}
      <OperationalSettingsSection control={control} errors={errors} />

      {/* Token Filtering */}
      <TokenFilteringSection control={control} errors={errors} />

      {/* Risk Management */}
      <RiskManagementSection control={control} errors={errors} />

      {/* Action Buttons */}
      <div className="flex gap-3 sticky bottom-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 rounded-lg border shadow-lg">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onSaveDraft}
          disabled={isSavingDraft || isDeploying}
        >
          {isSavingDraft ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Save Draft
            </>
          )}
        </Button>
        <Button
          type="submit"
          size="lg"
          className="flex-1 text-base font-semibold"
          disabled={isDeploying || isSavingDraft}
        >
          {isDeploying ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Deploying Strategy...
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5 mr-2" />
              Deploy Strategy
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
