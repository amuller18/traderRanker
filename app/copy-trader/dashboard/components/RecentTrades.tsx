'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { Trade } from '../types';
import { mockTrades } from '../data/mock';
import { Activity } from 'lucide-react';

export function RecentTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    // TODO fetch recent trades later
    setTrades(mockTrades);
  }, []);

  const formatTimestamp = (timestamp: string) => {
    // Simple format: 14:23:12
    return timestamp.split(' ')[1] || timestamp;
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Recent Trades</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Token</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">PnL</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => {
                const isPositive = trade.pnl > 0;
                const isNegative = trade.pnl < 0;

                return (
                  <TableRow key={trade.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimestamp(trade.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{trade.tokenSymbol}</span>
                        <span className="text-xs text-muted-foreground">
                          {truncateAddress(trade.token)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${trade.entry.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.exit ? `$${trade.exit.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-semibold ${
                            isPositive
                              ? 'text-green-500'
                              : isNegative
                              ? 'text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {isPositive ? '+' : ''}${trade.pnl.toFixed(2)}
                        </span>
                        <span
                          className={`text-xs ${
                            isPositive
                              ? 'text-green-500'
                              : isNegative
                              ? 'text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {isPositive ? '+' : ''}{trade.pnlPercent.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={trade.status === 'open' ? 'secondary' : 'outline'}
                        className={trade.status === 'open' ? 'bg-blue-500/10 text-blue-500' : ''}
                      >
                        {trade.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
