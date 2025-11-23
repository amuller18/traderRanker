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

// Position Sizing Types
export type PositionSizeMode = 'fixed' | 'percentage' | 'mirror';

export interface PositionSizing {
  mode: PositionSizeMode;
  amount: number; // Dollar amount for 'fixed', percentage for 'percentage' and 'mirror'
  maxPositionSize: number; // Maximum position size in dollars
  maxConcurrentPositions: number; // Integer, max number of open positions
}

// Entry Settings Types
export type EntryType = 'market' | 'limit';

export interface EntrySettings {
  entryType: EntryType;
  entryDelay: number; // Delay in seconds (0-30)
  minConfidenceScore?: number; // Optional, 0-100
}

// Safety Controls Types
export type LossLimitType = 'dollar' | 'percentage';

export interface SafetyControls {
  dailyLossLimit: number;
  dailyLossLimitType: LossLimitType;
  cooldownPeriod: number; // Minutes after stop loss
  maxTradesPerDay: number; // Maximum number of trades per day
}

// Operational Settings Types
export interface TimeRange {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface OperationalSettings {
  strategyName: string; // Required
  activeHours: TimeRange;
  timezone: string; // Timezone identifier (e.g., 'America/New_York')
  autoStart: boolean;
  leverage: number; // 1-10
}

// Token Filtering Types
export type TokenChain = 'ETH' | 'SOL' | 'SUI';
export type FilterMode = 'whitelist' | 'blacklist';

export interface TokenFiltering {
  mode: FilterMode;
  chains: TokenChain[];
}

// Risk Management Types
export interface RiskManagement {
  slippageTolerance: number; // Percentage (0-100)
  maxDrawdown: number; // Percentage (0-100)
}

// Complete Deployment Configuration
export interface DeployStrategyConfig {
  // Trader Selection
  callerInput: string;

  // Strategy Name (moved to top level for better accessibility)
  strategyName: string;

  // Exit Strategy
  profitStrategy: 'default' | 'custom';
  tpslRows: TPSLRow[];

  // Position Sizing
  positionSizing: PositionSizing;

  // Entry Settings
  entrySettings: EntrySettings;

  // Safety Controls
  safetyControls: SafetyControls;

  // Operational Settings
  operationalSettings: OperationalSettings;

  // Token Filtering
  tokenFiltering: TokenFiltering;

  // Risk Management
  riskManagement: RiskManagement;
}

// Draft Configuration (for save as draft functionality)
export interface DraftStrategyConfig extends Partial<DeployStrategyConfig> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type TabType = 'dashboard' | 'deploy';
