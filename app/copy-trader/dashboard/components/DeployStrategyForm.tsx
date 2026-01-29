'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import { useDeployStrategyStore } from '../store/deployStrategyStore';
import { mockCallerOptions } from '../data/mock';
import { Plus, Trash2, Rocket, Loader2, Save, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { ZodError } from 'zod';
import { PositionSizingSection } from './PositionSizingSection';
import { EntrySettingsSection } from './EntrySettingsSection';
import { SafetyControlsSection } from './SafetyControlsSection';
import { FiltersSection } from './FiltersSection';
import { OperationalSettingsSection } from './OperationalSettingsSection';
import { basicStrategySchema, deployStrategySchema } from '../validation/schema';
import { DeployTabType } from '../types';

export function DeployStrategyForm() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [currentTab, setCurrentTab] = useState<DeployTabType>('basic');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    callerInput,
    profitStrategy,
    tpslRows,
    positionSizing,
    entrySettings,
    safetyControls,
    tokenFilters,
    activeHours,
    operationalSettings,
    hasCustomizedAdvanced,
    setCallerInput,
    setProfitStrategy,
    addTPSLRow,
    removeTPSLRow,
    updateTPSLRow,
    setIsDraft,
    resetToDefault,
  } = useDeployStrategyStore();

  const validateBasicTab = (): boolean => {
    try {
      basicStrategySchema.parse({
        callerInput,
        profitStrategy,
        tpslRows,
        positionSizing,
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const validateFullForm = (): boolean => {
    try {
      deployStrategySchema.parse({
        callerInput,
        profitStrategy,
        tpslRows,
        positionSizing,
        entrySettings,
        safetyControls,
        tokenFilters,
        activeHours,
        operationalSettings,
        isDraft: false,
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleDeploy = async () => {
    // Validate full form
    if (!validateFullForm()) {
      toast.error('Validation Failed', {
        description: 'Please check all required fields and fix any errors',
      });
      // Switch to basic tab if errors are there
      if (Object.keys(errors).some(key => key.startsWith('callerInput') || key.startsWith('positionSizing'))) {
        setCurrentTab('basic');
      }
      return;
    }

    setIsDeploying(true);
    setIsDraft(false);

    // TODO connect backend later
    const config = {
      callerInput,
      profitStrategy,
      tpslRows: profitStrategy === 'custom' ? tpslRows : tpslRows.slice(0, 2),
      positionSizing,
      entrySettings,
      safetyControls,
      tokenFilters,
      activeHours,
      operationalSettings,
      isDraft: false,
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Show success toast
    const selectedTraders = mockCallerOptions.filter(opt => callerInput.includes(opt.value));
    const traderNames = selectedTraders.map(t => t.label).join(', ');
    const strategyName = operationalSettings.strategyName ||
      `${profitStrategy === 'default' ? 'Default' : 'Custom'} Strategy`;

    toast.success('Strategy Deployed Successfully!', {
      description: `"${strategyName}" deployed for ${callerInput.length} trader${callerInput.length > 1 ? 's' : ''}: ${traderNames}`,
      duration: 5000,
    });

    // Reset form after successful deployment
    setTimeout(() => {
      resetToDefault();
      setIsDeploying(false);
      setCurrentTab('basic');
    }, 500);
  };

  const handleSaveDraft = async () => {
    // Basic validation only for drafts
    if (!validateBasicTab()) {
      toast.error('Validation Failed', {
        description: 'Please complete required fields in Basic Strategy tab',
      });
      setCurrentTab('basic');
      return;
    }

    setIsSavingDraft(true);
    setIsDraft(true);

    const config = {
      callerInput,
      profitStrategy,
      tpslRows,
      positionSizing,
      entrySettings,
      safetyControls,
      tokenFilters,
      activeHours,
      operationalSettings,
      isDraft: true,
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success('Draft Saved!', {
      description: 'Your strategy configuration has been saved as a draft',
      duration: 3000,
    });

    setIsSavingDraft(false);
  };

  const isDefaultStrategy = profitStrategy === 'default';
  const canDeploy = callerInput.length > 0 && !isDeploying && !isSavingDraft;

  return (
    <div className="space-y-6">
      <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as DeployTabType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic" className="relative">
            Basic Strategy
            {Object.keys(errors).length > 0 && currentTab !== 'basic' && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                !
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="advanced" className="relative">
            Advanced Strategy
            {hasCustomizedAdvanced && (
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="h-3 w-3" />
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* BASIC TAB */}
        <TabsContent value="basic" className="space-y-6 mt-6">
          {/* Trader Selection */}
          <Card className="shadow-sm border">
            <CardHeader>
              <CardTitle>Select Traders</CardTitle>
              <CardDescription>Choose one or more traders to copy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="caller-input">
                  Traders <span className="text-destructive">*</span>
                </Label>
                <MultiSearchableSelect
                  id="caller-input"
                  options={mockCallerOptions}
                  values={callerInput}
                  onValuesChange={setCallerInput}
                  placeholder="Search traders..."
                  emptyText="No trader found."
                  className={errors.callerInput ? 'border-destructive' : ''}
                />
                {errors.callerInput && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.callerInput}
                  </p>
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
                <Label htmlFor="profit-strategy">
                  Strategy Type <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="profit-strategy"
                  options={[
                    { value: 'default', label: 'Default Strategy' },
                    { value: 'custom', label: 'Custom Strategy' },
                  ]}
                  value={profitStrategy}
                  onValueChange={(value) => setProfitStrategy(value as 'default' | 'custom')}
                  placeholder="Search strategy type..."
                  emptyText="No strategy found."
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
                        {tpslRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <SearchableSelect
                                options={[
                                  { value: 'TP', label: 'Take Profit' },
                                  { value: 'SL', label: 'Stop Loss' },
                                ]}
                                value={row.conditionType}
                                onValueChange={(value) => updateTPSLRow(row.id, 'conditionType', value)}
                                placeholder="Search..."
                                emptyText="No type found."
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={row.percentageTrigger}
                                  onChange={(e) =>
                                    updateTPSLRow(row.id, 'percentageTrigger', Number(e.target.value))
                                  }
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
                                  onChange={(e) =>
                                    updateTPSLRow(row.id, 'sellPercent', Number(e.target.value))
                                  }
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

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={addTPSLRow}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Row
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Position Sizing */}
          <Card className="shadow-sm border">
            <CardContent className="pt-6">
              <PositionSizingSection />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVANCED TAB */}
        <TabsContent value="advanced" className="space-y-6 mt-6">
          <div className="bg-muted/50 border border-dashed rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              All settings in this tab are optional. Configure advanced features to fine-tune
              your trading strategy.
            </p>
          </div>

          {/* Entry Settings */}
          <Card className="shadow-sm border">
            <CardContent className="pt-6">
              <EntrySettingsSection />
            </CardContent>
          </Card>

          <Separator />

          {/* Safety Controls */}
          <Card className="shadow-sm border">
            <CardContent className="pt-6">
              <SafetyControlsSection />
            </CardContent>
          </Card>

          <Separator />

          {/* Filters */}
          <Card className="shadow-sm border">
            <CardContent className="pt-6">
              <FiltersSection />
            </CardContent>
          </Card>

          <Separator />

          {/* Operational Settings */}
          <Card className="shadow-sm border">
            <CardContent className="pt-6">
              <OperationalSettingsSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 text-base font-semibold"
          onClick={handleSaveDraft}
          disabled={!canDeploy}
        >
          {isSavingDraft ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving Draft...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Save as Draft
            </>
          )}
        </Button>

        <Button
          size="lg"
          className="flex-1 text-base font-semibold"
          onClick={handleDeploy}
          disabled={!canDeploy}
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
    </div>
  );
}
