'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { AccountDataPoint } from '../types';
import { mockAccountData } from '../data/mock';

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

  return (
    <Card className="shadow-lg border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Account Value</CardTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {formatCurrency(lastValue)}
              </span>
            </div>
            <CardDescription>
              <span className={`text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isPositive ? '+' : ''}{formatCurrency(changeAmount)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
              </span>
              <span className="text-muted-foreground ml-1">
                {selectedPeriod === '1W' ? 'past week' : selectedPeriod === '1M' ? 'past month' : selectedPeriod === 'YTD' ? 'year to date' : 'all time'}
              </span>
            </CardDescription>
          </div>

          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {(['1W', '1M', 'YTD', 'ALL'] as TimePeriod[]).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="min-w-[50px] h-8 text-xs font-semibold"
              >
                {period}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatDate}
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Account Value']}
              labelFormatter={formatDate}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{
                color: 'hsl(var(--foreground))',
                fontWeight: 600,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
              strokeWidth={3}
              fill="url(#colorValue)"
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
