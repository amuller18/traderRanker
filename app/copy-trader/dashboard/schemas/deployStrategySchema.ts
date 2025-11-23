import { z } from 'zod';

// TP/SL Row Schema
export const tpslRowSchema = z.object({
  id: z.string(),
  conditionType: z.enum(['TP', 'SL']),
  percentageTrigger: z.number()
    .min(-100, 'Trigger must be at least -100%')
    .max(1000, 'Trigger must be at most 1000%'),
  sellPercent: z.number()
    .min(0, 'Sell percentage must be at least 0%')
    .max(100, 'Sell percentage must be at most 100%'),
});

// Position Sizing Schema
export const positionSizingSchema = z.object({
  mode: z.enum(['fixed', 'percentage', 'mirror'], {
    required_error: 'Position size mode is required',
  }),
  amount: z.number()
    .positive('Amount must be positive')
    .refine((val) => val > 0, 'Amount must be greater than 0'),
  maxPositionSize: z.number()
    .positive('Max position size must be positive')
    .min(1, 'Max position size must be at least $1'),
  maxConcurrentPositions: z.number()
    .int('Must be a whole number')
    .positive('Must have at least 1 concurrent position')
    .min(1, 'Must allow at least 1 concurrent position')
    .max(100, 'Cannot exceed 100 concurrent positions'),
});

// Entry Settings Schema
export const entrySettingsSchema = z.object({
  entryType: z.enum(['market', 'limit'], {
    required_error: 'Entry type is required',
  }),
  entryDelay: z.number()
    .min(0, 'Entry delay cannot be negative')
    .max(30, 'Entry delay cannot exceed 30 seconds'),
  minConfidenceScore: z.number()
    .min(0, 'Confidence score must be at least 0')
    .max(100, 'Confidence score cannot exceed 100')
    .optional(),
});

// Safety Controls Schema
export const safetyControlsSchema = z.object({
  dailyLossLimit: z.number()
    .positive('Daily loss limit must be positive')
    .min(0.01, 'Daily loss limit must be at least 0.01'),
  dailyLossLimitType: z.enum(['dollar', 'percentage'], {
    required_error: 'Loss limit type is required',
  }),
  cooldownPeriod: z.number()
    .min(0, 'Cooldown period cannot be negative')
    .max(1440, 'Cooldown period cannot exceed 24 hours (1440 minutes)')
    .int('Cooldown period must be a whole number'),
  maxTradesPerDay: z.number()
    .int('Must be a whole number')
    .positive('Must allow at least 1 trade per day')
    .min(1, 'Must allow at least 1 trade per day')
    .max(1000, 'Cannot exceed 1000 trades per day'),
});

// Time Range Schema
export const timeRangeSchema = z.object({
  start: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:mm)'),
  end: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:mm)'),
});

// Operational Settings Schema
export const operationalSettingsSchema = z.object({
  strategyName: z.string()
    .min(1, 'Strategy name is required')
    .max(100, 'Strategy name cannot exceed 100 characters')
    .trim(),
  activeHours: timeRangeSchema,
  timezone: z.string()
    .min(1, 'Timezone is required'),
  autoStart: z.boolean(),
  leverage: z.number()
    .min(1, 'Leverage must be at least 1x')
    .max(10, 'Leverage cannot exceed 10x')
    .int('Leverage must be a whole number'),
});

// Token Filtering Schema
export const tokenFilteringSchema = z.object({
  mode: z.enum(['whitelist', 'blacklist'], {
    required_error: 'Filter mode is required',
  }),
  chains: z.array(z.enum(['ETH', 'SOL', 'SUI']))
    .min(1, 'Select at least one chain'),
});

// Risk Management Schema
export const riskManagementSchema = z.object({
  slippageTolerance: z.number()
    .min(0, 'Slippage tolerance cannot be negative')
    .max(100, 'Slippage tolerance cannot exceed 100%'),
  maxDrawdown: z.number()
    .min(0, 'Max drawdown cannot be negative')
    .max(100, 'Max drawdown cannot exceed 100%'),
});

// Main Deploy Strategy Schema
export const deployStrategySchema = z.object({
  // Trader Selection
  callerInput: z.string()
    .min(1, 'Please select a trader'),

  // Strategy Name
  strategyName: z.string()
    .min(1, 'Strategy name is required')
    .max(100, 'Strategy name cannot exceed 100 characters')
    .trim(),

  // Exit Strategy
  profitStrategy: z.enum(['default', 'custom'], {
    required_error: 'Profit strategy is required',
  }),
  tpslRows: z.array(tpslRowSchema)
    .min(1, 'At least one TP/SL row is required'),

  // Position Sizing
  positionSizing: positionSizingSchema,

  // Entry Settings
  entrySettings: entrySettingsSchema,

  // Safety Controls
  safetyControls: safetyControlsSchema,

  // Operational Settings
  operationalSettings: operationalSettingsSchema,

  // Token Filtering
  tokenFiltering: tokenFilteringSchema,

  // Risk Management
  riskManagement: riskManagementSchema,
}).refine((data) => {
  // Validate that position amount makes sense based on mode
  if (data.positionSizing.mode === 'fixed') {
    return data.positionSizing.amount <= data.positionSizing.maxPositionSize;
  }
  if (data.positionSizing.mode === 'percentage' || data.positionSizing.mode === 'mirror') {
    return data.positionSizing.amount <= 100;
  }
  return true;
}, {
  message: 'Position amount exceeds maximum allowed',
  path: ['positionSizing', 'amount'],
}).refine((data) => {
  // Validate that daily loss limit percentage is reasonable
  if (data.safetyControls.dailyLossLimitType === 'percentage') {
    return data.safetyControls.dailyLossLimit <= 100;
  }
  return true;
}, {
  message: 'Daily loss limit percentage cannot exceed 100%',
  path: ['safetyControls', 'dailyLossLimit'],
}).refine((data) => {
  // Validate that active hours end is after start
  const [startHour, startMin] = data.operationalSettings.activeHours.start.split(':').map(Number);
  const [endHour, endMin] = data.operationalSettings.activeHours.end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['operationalSettings', 'activeHours', 'end'],
});

// Type inference from schema
export type DeployStrategyFormData = z.infer<typeof deployStrategySchema>;

// Default values for the form
export const deployStrategyDefaults: DeployStrategyFormData = {
  callerInput: '',
  strategyName: '',
  profitStrategy: 'default',
  tpslRows: [
    {
      id: 'default-tp',
      conditionType: 'TP',
      percentageTrigger: 100,
      sellPercent: 100,
    },
    {
      id: 'default-sl',
      conditionType: 'SL',
      percentageTrigger: -90,
      sellPercent: 100,
    },
  ],
  positionSizing: {
    mode: 'percentage',
    amount: 10, // 10% of portfolio
    maxPositionSize: 10000, // $10,000 max
    maxConcurrentPositions: 5,
  },
  entrySettings: {
    entryType: 'market',
    entryDelay: 2, // 2 seconds default
    minConfidenceScore: 70,
  },
  safetyControls: {
    dailyLossLimit: 5, // 5% of portfolio
    dailyLossLimitType: 'percentage',
    cooldownPeriod: 30, // 30 minutes
    maxTradesPerDay: 20,
  },
  operationalSettings: {
    strategyName: '',
    activeHours: {
      start: '09:00',
      end: '17:00',
    },
    timezone: 'America/New_York',
    autoStart: false,
    leverage: 1,
  },
  tokenFiltering: {
    mode: 'whitelist',
    chains: ['ETH', 'SOL'],
  },
  riskManagement: {
    slippageTolerance: 1, // 1%
    maxDrawdown: 20, // 20%
  },
};
