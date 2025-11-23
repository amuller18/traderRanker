'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeployStrategyStore } from '../store/deployStrategyStore';
import { mockCallerOptions } from '../data/mock';
import { Plus, Trash2, Rocket, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export function DeployStrategyForm() {
  const [isDeploying, setIsDeploying] = useState(false);
  const {
    callerInput,
    profitStrategy,
    tpslRows,
    setCallerInput,
    setProfitStrategy,
    addTPSLRow,
    removeTPSLRow,
    updateTPSLRow,
    resetToDefault,
  } = useDeployStrategyStore();

  const handleDeploy = async () => {
    if (!callerInput) {
      toast.error('Please select a trader', {
        description: 'You must select a trader before deploying a strategy',
      });
      return;
    }

    setIsDeploying(true);

    // TODO connect backend later
    const config = {
      callerInput,
      profitStrategy,
      tpslRows: profitStrategy === 'custom' ? tpslRows : tpslRows.slice(0, 2), // Only default rows for default strategy
    };

    console.log('Deploy Strategy Config:', config);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Show success toast
    const selectedTrader = mockCallerOptions.find(opt => opt.value === callerInput);
    toast.success('Strategy Deployed Successfully!', {
      description: `${profitStrategy === 'default' ? 'Default' : 'Custom'} strategy deployed for ${selectedTrader?.label || 'selected trader'}`,
      duration: 5000,
    });

    // Reset form after successful deployment
    setTimeout(() => {
      resetToDefault();
      setIsDeploying(false);
    }, 500);
  };

  const isDefaultStrategy = profitStrategy === 'default';
  const canDeploy = callerInput !== '' && !isDeploying;

  return (
    <div className="space-y-6">
      {/* Caller Input Section */}
      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle>Select Trader</CardTitle>
          <CardDescription>Choose a trader to copy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="caller-input">Trader</Label>
            <Select value={callerInput} onValueChange={setCallerInput}>
              <SelectTrigger id="caller-input">
                <SelectValue placeholder="Select a trader..." />
              </SelectTrigger>
              <SelectContent>
                {mockCallerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={!option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Profit Strategy Section */}
      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle>Profit Strategy</CardTitle>
          <CardDescription>Configure your take profit and stop loss settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profit-strategy">Strategy Type</Label>
            <Select value={profitStrategy} onValueChange={(value) => setProfitStrategy(value as 'default' | 'custom')}>
              <SelectTrigger id="profit-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Strategy</SelectItem>
                <SelectItem value="custom">Custom Strategy</SelectItem>
              </SelectContent>
            </Select>
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

      {/* Deploy Button */}
      <Button
        size="lg"
        className="w-full text-base font-semibold"
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
  );
}
