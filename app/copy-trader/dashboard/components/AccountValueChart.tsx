'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { AccountDataPoint } from '../types';
import { mockAccountData } from '../data/mock';
import { TrendingUp, TrendingDown } from 'lucide-react';

type TimePeriod = '1W' | '1M' | 'YTD' | 'ALL';

export function AccountValueChart() {
  const [allData, setAllData] = useState<AccountDataPoint[]>([]);
  const [filteredData, setFilteredData] = useState<AccountDataPoint[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1M');

  useEffect(() => {
    // TODO fetch user account data later
    setAllData(mockAccountData);
  }, []);

  useEffect(() => {
    if (allData.length === 0) return;

    const now = new Date('2025-11-23');
    let startDate: Date;

    switch (selectedPeriod) {
      case '1W':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'ALL':
        startDate = new Date(allData[0].timestamp);
        break;
    }

    const filtered = allData.filter(point => {
      const pointDate = new Date(point.timestamp);
      return pointDate >= startDate && pointDate <= now;
    });

    setFilteredData(filtered);
  }, [allData, selectedPeriod]);

  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (selectedPeriod === '1W') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (selectedPeriod === '1M') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  // Calculate total change
  const firstValue = filteredData[0]?.value || 0;
  const lastValue = filteredData[filteredData.length - 1]?.value || 0;
  const changePercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const changeAmount = lastValue - firstValue;
  const isPositive = changePercent >= 0;

  const periodLabels: Record<TimePeriod, string> = {
    '1W': 'past week',
    '1M': 'past month',
    'YTD': 'year to date',
    'ALL': 'all time'
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-medium text-muted-foreground">Account Value</CardTitle>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tracking-tight">
                {formatCurrency(lastValue)}
              </span>
              <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
              </div>
            </div>
            <CardDescription className="text-sm">
              <span className={isPositive ? 'text-success' : 'text-destructive'}>
                {isPositive ? '+' : ''}{formatCurrency(changeAmount)}
              </span>
              <span className="text-muted-foreground ml-1.5">{periodLabels[selectedPeriod]}</span>
            </CardDescription>
          </div>

          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
            {(['1W', '1M', 'YTD', 'ALL'] as TimePeriod[]).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className={`min-w-[48px] h-8 text-xs font-medium ${
                  selectedPeriod === period
                    ? 'shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {period}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValuePositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorValueNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDate}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                dy={8}
              />
              <YAxis
                tickFormatter={formatCurrency}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                domain={['auto', 'auto']}
                width={70}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Value']}
                labelFormatter={formatDate}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px hsl(var(--background) / 0.5)',
                  padding: '8px 12px',
                }}
                labelStyle={{
                  color: 'hsl(var(--foreground))',
                  fontWeight: 500,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "hsl(142, 76%, 46%)" : "hsl(0, 84%, 60%)"}
                strokeWidth={2}
                fill={isPositive ? "url(#colorValuePositive)" : "url(#colorValueNegative)"}
                dot={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: 'hsl(var(--background))',
                  fill: isPositive ? 'hsl(142, 76%, 46%)' : 'hsl(0, 84%, 60%)'
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
