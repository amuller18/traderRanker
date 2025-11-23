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

// Position sizing types
export type PositionSizingMode = 'fixed' | 'percentage';

export interface PositionSizing {
  mode: PositionSizingMode;
  fixedAmount: number;
  portfolioPercentage: number;
  maxPositionSize: number;
  maxConcurrentPositions: number;
}

// Entry settings types
export type EntryType = 'market' | 'limit';

export interface EntrySettings {
  entryType: EntryType;
  entryDelay: number; // 0-30 seconds
}

// Safety controls types
export type DailyLossLimitMode = 'dollar' | 'percentage';

export interface SafetyControls {
  dailyLossLimitMode: DailyLossLimitMode;
  dailyLossLimitDollar: number;
  dailyLossLimitPercentage: number;
  cooldownPeriod: number; // minutes
  maxTradesPerDay: number;
}

// Token filter types
export type TokenChain = 'ETH' | 'SOL' | 'SUI';
export type FilterMode = 'whitelist' | 'blacklist';

export interface TokenFilters {
  mode: FilterMode;
  selectedChains: TokenChain[];
}

// Active hours types
export interface ActiveHours {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
}

// Operational settings types
export interface OperationalSettings {
  strategyName: string;
  autoStart: boolean;
}

// Complete deployment configuration
export interface DeployStrategyConfig {
  // Basic tab (required)
  callerInput: string;
  profitStrategy: 'default' | 'custom';
  tpslRows: TPSLRow[];
  positionSizing: PositionSizing;

  // Advanced tab (optional)
  entrySettings: EntrySettings;
  safetyControls: SafetyControls;
  tokenFilters: TokenFilters;
  activeHours: ActiveHours;
  operationalSettings: OperationalSettings;

  // Meta
  isDraft: boolean;
}

export type TabType = 'dashboard' | 'deploy';
export type DeployTabType = 'basic' | 'advanced';
