// Validation schemas for Deploy Strategy form using Zod
import { z } from 'zod';

// Basic tab validation schema
export const basicStrategySchema = z.object({
  // Trader selection - required
  callerInput: z.array(z.string()).min(1, 'Please select at least one trader'),

  // Exit strategy - required
  profitStrategy: z.enum(['default', 'custom'], {
    required_error: 'Please select an exit strategy',
  }),

  // TP/SL rows - only validate if custom strategy is selected
  tpslRows: z
    .array(
      z.object({
        id: z.string(),
        conditionType: z.enum(['TP', 'SL']),
        percentageTrigger: z
          .number()
          .min(-100, 'Trigger percentage must be at least -100%')
          .max(1000, 'Trigger percentage must not exceed 1000%'),
        sellPercent: z
          .number()
          .min(0, 'Sell percentage must be at least 0%')
          .max(100, 'Sell percentage must not exceed 100%'),
      })
    )
    .min(1, 'At least one TP/SL row is required for custom strategy'),

  // Position sizing - required
  positionSizing: z.object({
    mode: z.enum(['fixed', 'percentage'], {
      required_error: 'Please select a position sizing mode',
    }),
    fixedAmount: z
      .number()
      .min(1, 'Fixed amount must be at least $1')
      .max(1000000, 'Fixed amount must not exceed $1,000,000'),
    portfolioPercentage: z
      .number()
      .min(0.1, 'Portfolio percentage must be at least 0.1%')
      .max(100, 'Portfolio percentage must not exceed 100%'),
    maxPositionSize: z
      .number()
      .min(0, 'Max position size cannot be negative')
      .max(10000000, 'Max position size must not exceed $10,000,000'),
    maxConcurrentPositions: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Cannot be negative')
      .max(100, 'Cannot exceed 100 concurrent positions'),
  }),
});

// Advanced tab validation schema (all optional)
export const advancedStrategySchema = z.object({
  // Entry settings - optional
  entrySettings: z.object({
    entryType: z.enum(['market', 'limit']).optional(),
    entryDelay: z
      .number()
      .min(0, 'Entry delay must be at least 0 seconds')
      .max(30, 'Entry delay must not exceed 30 seconds')
      .optional(),
  }),

  // Safety controls - optional
  safetyControls: z.object({
    dailyLossLimitMode: z.enum(['dollar', 'percentage']).optional(),
    dailyLossLimitDollar: z
      .number()
      .min(0, 'Daily loss limit must be at least $0')
      .max(1000000, 'Daily loss limit must not exceed $1,000,000')
      .optional(),
    dailyLossLimitPercentage: z
      .number()
      .min(0, 'Daily loss limit must be at least 0%')
      .max(100, 'Daily loss limit must not exceed 100%')
      .optional(),
    cooldownPeriod: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Cooldown period must be at least 0 minutes')
      .max(1440, 'Cooldown period must not exceed 24 hours (1440 minutes)')
      .optional(),
    maxTradesPerDay: z
      .number()
      .int('Must be a whole number')
      .min(1, 'Must allow at least 1 trade per day')
      .max(1000, 'Cannot exceed 1000 trades per day')
      .optional(),
  }),

  // Token filters - optional
  tokenFilters: z.object({
    mode: z.enum(['whitelist', 'blacklist']).optional(),
    selectedChains: z.array(z.enum(['ETH', 'SOL', 'SUI'])).optional(),
  }),

  // Active hours - optional
  activeHours: z.object({
    enabled: z.boolean().optional(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)').optional(),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)').optional(),
    timezone: z.string().optional(),
  }),

  // Operational settings - optional
  operationalSettings: z.object({
    strategyName: z
      .string()
      .max(50, 'Strategy name must not exceed 50 characters')
      .optional(),
    autoStart: z.boolean().optional(),
  }),
});

// Full deployment configuration schema (combines both tabs)
export const deployStrategySchema = z
  .object({
    // Basic tab fields
    callerInput: basicStrategySchema.shape.callerInput,
    profitStrategy: basicStrategySchema.shape.profitStrategy,
    tpslRows: basicStrategySchema.shape.tpslRows,
    positionSizing: basicStrategySchema.shape.positionSizing,

    // Advanced tab fields
    entrySettings: advancedStrategySchema.shape.entrySettings,
    safetyControls: advancedStrategySchema.shape.safetyControls,
    tokenFilters: advancedStrategySchema.shape.tokenFilters,
    activeHours: advancedStrategySchema.shape.activeHours,
    operationalSettings: advancedStrategySchema.shape.operationalSettings,

    // Meta
    isDraft: z.boolean(),
  })
  .refine(
    (data) => {
      // If custom strategy is selected, ensure at least one TP/SL row exists
      if (data.profitStrategy === 'custom') {
        return data.tpslRows.length > 0;
      }
      return true;
    },
    {
      message: 'Custom strategy requires at least one TP/SL configuration',
      path: ['tpslRows'],
    }
  )
  .refine(
    (data) => {
      // Validate that position sizing amount is appropriate for selected mode
      if (data.positionSizing.mode === 'fixed') {
        return data.positionSizing.fixedAmount > 0;
      } else {
        return data.positionSizing.portfolioPercentage > 0;
      }
    },
    {
      message: 'Position sizing amount must be greater than 0',
      path: ['positionSizing'],
    }
  )
  .refine(
    (data) => {
      // If active hours are enabled, validate time range
      if (data.activeHours?.enabled) {
        return (
          data.activeHours.startTime !== undefined &&
          data.activeHours.endTime !== undefined &&
          data.activeHours.timezone !== undefined
        );
      }
      return true;
    },
    {
      message: 'Active hours require start time, end time, and timezone when enabled',
      path: ['activeHours'],
    }
  );

// Type inference from schemas
export type BasicStrategyFormData = z.infer<typeof basicStrategySchema>;
export type AdvancedStrategyFormData = z.infer<typeof advancedStrategySchema>;
export type DeployStrategyFormData = z.infer<typeof deployStrategySchema>;
