// TypeScript types for Copy Trading Dashboard MVP

export interface AccountDataPoint {
  timestamp: string;
  value: number;
}

export interface Strategy {
  id: string;
  name: string;
  winRate: number;
  roi: number;
  tradesCount: number;
}

export interface Trade {
  id: string;
  timestamp: string;
  token: string;
  tokenSymbol: string;
  entry: number;
  exit: number | null;
  pnl: number;
  pnlPercent: number;
  status: 'open' | 'closed';
}

export type ConditionType = 'TP' | 'SL';

export interface TPSLRow {
  id: string;
  conditionType: ConditionType;
  percentageTrigger: number;
  sellPercent: number;
}

export interface DeployStrategyConfig {
  callerInput: string;
  profitStrategy: 'default' | 'custom';
  tpslRows: TPSLRow[];
}

export type TabType = 'dashboard' | 'deploy';
