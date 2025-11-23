// Zustand store for Deploy Strategy state management
import { create } from 'zustand';
import {
  TPSLRow,
  PositionSizing,
  EntrySettings,
  SafetyControls,
  TokenFilters,
  ActiveHours,
  OperationalSettings,
  PositionSizingMode,
  EntryType,
  DailyLossLimitMode,
  FilterMode,
  TokenChain,
} from '../types';

interface DeployStrategyState {
  // Basic tab state
  callerInput: string;
  profitStrategy: 'default' | 'custom';
  tpslRows: TPSLRow[];
  positionSizing: PositionSizing;

  // Advanced tab state
  entrySettings: EntrySettings;
  safetyControls: SafetyControls;
  tokenFilters: TokenFilters;
  activeHours: ActiveHours;
  operationalSettings: OperationalSettings;

  // Meta state
  isDraft: boolean;
  hasCustomizedAdvanced: boolean;

  // Basic tab actions
  setCallerInput: (value: string) => void;
  setProfitStrategy: (value: 'default' | 'custom') => void;
  addTPSLRow: () => void;
  removeTPSLRow: (id: string) => void;
  updateTPSLRow: (id: string, field: keyof TPSLRow, value: any) => void;

  // Position sizing actions
  setPositionSizingMode: (mode: PositionSizingMode) => void;
  setFixedAmount: (amount: number) => void;
  setPortfolioPercentage: (percentage: number) => void;
  setMaxPositionSize: (size: number) => void;
  setMaxConcurrentPositions: (positions: number) => void;

  // Entry settings actions
  setEntryType: (type: EntryType) => void;
  setEntryDelay: (delay: number) => void;

  // Safety controls actions
  setDailyLossLimitMode: (mode: DailyLossLimitMode) => void;
  setDailyLossLimitDollar: (amount: number) => void;
  setDailyLossLimitPercentage: (percentage: number) => void;
  setCooldownPeriod: (minutes: number) => void;
  setMaxTradesPerDay: (trades: number) => void;

  // Token filters actions
  setFilterMode: (mode: FilterMode) => void;
  toggleTokenChain: (chain: TokenChain) => void;

  // Active hours actions
  setActiveHoursEnabled: (enabled: boolean) => void;
  setActiveHoursStartTime: (time: string) => void;
  setActiveHoursEndTime: (time: string) => void;
  setActiveHoursTimezone: (timezone: string) => void;

  // Operational settings actions
  setStrategyName: (name: string) => void;
  setAutoStart: (autoStart: boolean) => void;

  // Meta actions
  setIsDraft: (isDraft: boolean) => void;
  resetToDefault: () => void;
  checkIfAdvancedCustomized: () => void;
}

// Default values
const defaultTPSLRows: TPSLRow[] = [
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
];

const defaultPositionSizing: PositionSizing = {
  mode: 'percentage',
  fixedAmount: 100,
  portfolioPercentage: 5,
  maxPositionSize: 0, // 0 = unlimited
  maxConcurrentPositions: 0, // 0 = unlimited
};

const defaultEntrySettings: EntrySettings = {
  entryType: 'market',
  entryDelay: 0,
};

const defaultSafetyControls: SafetyControls = {
  dailyLossLimitMode: 'dollar',
  dailyLossLimitDollar: 500,
  dailyLossLimitPercentage: 10,
  cooldownPeriod: 30,
  maxTradesPerDay: 10,
};

const defaultTokenFilters: TokenFilters = {
  mode: 'whitelist',
  selectedChains: [],
};

const defaultActiveHours: ActiveHours = {
  enabled: false,
  startTime: '09:00',
  endTime: '17:00',
  timezone: 'America/New_York',
};

const defaultOperationalSettings: OperationalSettings = {
  strategyName: '',
  autoStart: true,
};

const generateId = () => `tpsl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to check if advanced settings have been customized
const isAdvancedCustomized = (state: DeployStrategyState): boolean => {
  return (
    state.entrySettings.entryType !== defaultEntrySettings.entryType ||
    state.entrySettings.entryDelay !== defaultEntrySettings.entryDelay ||
    state.safetyControls.dailyLossLimitDollar !== defaultSafetyControls.dailyLossLimitDollar ||
    state.safetyControls.dailyLossLimitPercentage !== defaultSafetyControls.dailyLossLimitPercentage ||
    state.safetyControls.cooldownPeriod !== defaultSafetyControls.cooldownPeriod ||
    state.safetyControls.maxTradesPerDay !== defaultSafetyControls.maxTradesPerDay ||
    state.tokenFilters.selectedChains.length > 0 ||
    state.activeHours.enabled ||
    state.operationalSettings.strategyName !== ''
  );
};

export const useDeployStrategyStore = create<DeployStrategyState>((set, get) => ({
  // Initial state - Basic tab
  callerInput: '',
  profitStrategy: 'default',
  tpslRows: [...defaultTPSLRows],
  positionSizing: { ...defaultPositionSizing },

  // Initial state - Advanced tab
  entrySettings: { ...defaultEntrySettings },
  safetyControls: { ...defaultSafetyControls },
  tokenFilters: { ...defaultTokenFilters },
  activeHours: { ...defaultActiveHours },
  operationalSettings: { ...defaultOperationalSettings },

  // Meta state
  isDraft: false,
  hasCustomizedAdvanced: false,

  // Basic tab actions
  setCallerInput: (value: string) => set({ callerInput: value }),

  setProfitStrategy: (value: 'default' | 'custom') => set({ profitStrategy: value }),

  addTPSLRow: () =>
    set((state) => ({
      tpslRows: [
        ...state.tpslRows,
        {
          id: generateId(),
          conditionType: 'TP',
          percentageTrigger: 0,
          sellPercent: 0,
        },
      ],
    })),

  removeTPSLRow: (id: string) =>
    set((state) => ({
      tpslRows: state.tpslRows.filter((row) => row.id !== id),
    })),

  updateTPSLRow: (id: string, field: keyof TPSLRow, value: any) =>
    set((state) => ({
      tpslRows: state.tpslRows.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    })),

  // Position sizing actions
  setPositionSizingMode: (mode: PositionSizingMode) =>
    set((state) => ({
      positionSizing: { ...state.positionSizing, mode },
    })),

  setFixedAmount: (amount: number) =>
    set((state) => ({
      positionSizing: { ...state.positionSizing, fixedAmount: amount },
    })),

  setPortfolioPercentage: (percentage: number) =>
    set((state) => ({
      positionSizing: { ...state.positionSizing, portfolioPercentage: percentage },
    })),

  setMaxPositionSize: (size: number) =>
    set((state) => ({
      positionSizing: { ...state.positionSizing, maxPositionSize: size },
    })),

  setMaxConcurrentPositions: (positions: number) =>
    set((state) => ({
      positionSizing: { ...state.positionSizing, maxConcurrentPositions: positions },
    })),

  // Entry settings actions
  setEntryType: (type: EntryType) => {
    set((state) => ({
      entrySettings: { ...state.entrySettings, entryType: type },
    }));
    get().checkIfAdvancedCustomized();
  },

  setEntryDelay: (delay: number) => {
    set((state) => ({
      entrySettings: { ...state.entrySettings, entryDelay: delay },
    }));
    get().checkIfAdvancedCustomized();
  },

  // Safety controls actions
  setDailyLossLimitMode: (mode: DailyLossLimitMode) =>
    set((state) => ({
      safetyControls: { ...state.safetyControls, dailyLossLimitMode: mode },
    })),

  setDailyLossLimitDollar: (amount: number) => {
    set((state) => ({
      safetyControls: { ...state.safetyControls, dailyLossLimitDollar: amount },
    }));
    get().checkIfAdvancedCustomized();
  },

  setDailyLossLimitPercentage: (percentage: number) => {
    set((state) => ({
      safetyControls: { ...state.safetyControls, dailyLossLimitPercentage: percentage },
    }));
    get().checkIfAdvancedCustomized();
  },

  setCooldownPeriod: (minutes: number) => {
    set((state) => ({
      safetyControls: { ...state.safetyControls, cooldownPeriod: minutes },
    }));
    get().checkIfAdvancedCustomized();
  },

  setMaxTradesPerDay: (trades: number) => {
    set((state) => ({
      safetyControls: { ...state.safetyControls, maxTradesPerDay: trades },
    }));
    get().checkIfAdvancedCustomized();
  },

  // Token filters actions
  setFilterMode: (mode: FilterMode) =>
    set((state) => ({
      tokenFilters: { ...state.tokenFilters, mode },
    })),

  toggleTokenChain: (chain: TokenChain) => {
    set((state) => {
      const isSelected = state.tokenFilters.selectedChains.includes(chain);
      return {
        tokenFilters: {
          ...state.tokenFilters,
          selectedChains: isSelected
            ? state.tokenFilters.selectedChains.filter((c) => c !== chain)
            : [...state.tokenFilters.selectedChains, chain],
        },
      };
    });
    get().checkIfAdvancedCustomized();
  },

  // Active hours actions
  setActiveHoursEnabled: (enabled: boolean) => {
    set((state) => ({
      activeHours: { ...state.activeHours, enabled },
    }));
    get().checkIfAdvancedCustomized();
  },

  setActiveHoursStartTime: (time: string) =>
    set((state) => ({
      activeHours: { ...state.activeHours, startTime: time },
    })),

  setActiveHoursEndTime: (time: string) =>
    set((state) => ({
      activeHours: { ...state.activeHours, endTime: time },
    })),

  setActiveHoursTimezone: (timezone: string) =>
    set((state) => ({
      activeHours: { ...state.activeHours, timezone },
    })),

  // Operational settings actions
  setStrategyName: (name: string) => {
    set((state) => ({
      operationalSettings: { ...state.operationalSettings, strategyName: name },
    }));
    get().checkIfAdvancedCustomized();
  },

  setAutoStart: (autoStart: boolean) =>
    set((state) => ({
      operationalSettings: { ...state.operationalSettings, autoStart },
    })),

  // Meta actions
  setIsDraft: (isDraft: boolean) => set({ isDraft }),

  checkIfAdvancedCustomized: () => {
    const state = get();
    set({ hasCustomizedAdvanced: isAdvancedCustomized(state) });
  },

  resetToDefault: () =>
    set({
      callerInput: '',
      profitStrategy: 'default',
      tpslRows: [...defaultTPSLRows],
      positionSizing: { ...defaultPositionSizing },
      entrySettings: { ...defaultEntrySettings },
      safetyControls: { ...defaultSafetyControls },
      tokenFilters: { ...defaultTokenFilters },
      activeHours: { ...defaultActiveHours },
      operationalSettings: { ...defaultOperationalSettings },
      isDraft: false,
      hasCustomizedAdvanced: false,
    }),
}));
