'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { Trade } from '../types';
import { getRecentWins } from '../data/mock';
import { Sparkles } from 'lucide-react';

export function RecentWins() {
  const [wins, setWins] = useState<Trade[]>([]);

  useEffect(() => {
    // TODO fetch recent wins later
    setWins(getRecentWins());
  }, []);

  const formatTimestamp = (timestamp: string) => {
    // Format to readable time
    const parts = timestamp.split(' ');
    return parts[1] || timestamp;
  };

  return (
    <Card className="shadow-sm border border-green-500/20 bg-green-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-green-500" />
          <CardTitle className="text-xl">Recent Wins</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {wins.map((win) => (
            <div
              key={win.id}
              className="flex items-center justify-between p-3 bg-background rounded-lg border"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{win.tokenSymbol}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(win.timestamp)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-green-500 font-bold">
                  +${win.pnl.toFixed(2)}
                </span>
                <span className="text-green-500 text-xs font-semibold">
                  +{win.pnlPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
