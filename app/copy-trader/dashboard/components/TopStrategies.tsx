'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { Strategy } from '../types';
import { mockStrategies } from '../data/mock';
import { TrendingUp } from 'lucide-react';

export function TopStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    // TODO fetch top performing strategies later
    setStrategies(mockStrategies);
  }, []);

  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Top Performing Strategies</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Strategy Name</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead className="text-right">Trades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {strategies.map((strategy) => (
              <TableRow key={strategy.id}>
                <TableCell className="font-medium">{strategy.name}</TableCell>
                <TableCell className="text-right">
                  <span className="text-green-500 font-semibold">
                    {strategy.winRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-primary font-semibold">
                    +{strategy.roi.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {strategy.tradesCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
