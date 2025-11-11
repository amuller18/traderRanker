// Zustand store for Deploy Strategy state management
import { create } from 'zustand';
import { TPSLRow, ConditionType } from '../types';

interface DeployStrategyState {
  callerInput: string;
  profitStrategy: 'default' | 'custom';
  tpslRows: TPSLRow[];
  setCallerInput: (value: string) => void;
  setProfitStrategy: (value: 'default' | 'custom') => void;
  addTPSLRow: () => void;
  removeTPSLRow: (id: string) => void;
  updateTPSLRow: (id: string, field: keyof TPSLRow, value: any) => void;
  resetToDefault: () => void;
}

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

const generateId = () => `tpsl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useDeployStrategyStore = create<DeployStrategyState>((set) => ({
  callerInput: '',
  profitStrategy: 'default',
  tpslRows: [...defaultTPSLRows],

  setCallerInput: (value: string) =>
    set({ callerInput: value }),

  setProfitStrategy: (value: 'default' | 'custom') =>
    set({ profitStrategy: value }),

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

  resetToDefault: () =>
    set({
      callerInput: '',
      profitStrategy: 'default',
      tpslRows: [...defaultTPSLRows],
    }),
}));
