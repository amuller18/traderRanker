// Mock data for Copy Trading Dashboard MVP
// TODO connect backend later

import { AccountDataPoint, Strategy, Trade } from '../types';

// Generate historical account data for all time periods
const generateAccountData = (): AccountDataPoint[] => {
  const data: AccountDataPoint[] = [];
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2025-11-23');
  let currentValue = 5000; // Starting value

  // Generate daily data points
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Simulate realistic market movements
    const dailyChange = (Math.random() - 0.45) * 0.05; // Slight upward bias
    currentValue = currentValue * (1 + dailyChange);

    data.push({
      timestamp: d.toISOString().split('T')[0],
      value: Math.round(currentValue * 100) / 100,
    });
  }

  return data;
};

export const mockAccountData: AccountDataPoint[] = generateAccountData();

export const mockStrategies: Strategy[] = [
  {
    id: '1',
    name: 'Momentum Scalper',
    winRate: 68.5,
    roi: 156.3,
    tradesCount: 234,
  },
  {
    id: '2',
    name: 'Swing Master',
    winRate: 72.1,
    roi: 142.8,
    tradesCount: 189,
  },
  {
    id: '3',
    name: 'Trend Follower',
    winRate: 65.4,
    roi: 138.2,
    tradesCount: 312,
  },
  {
    id: '4',
    name: 'DeFi Hunter',
    winRate: 70.2,
    roi: 124.5,
    tradesCount: 156,
  },
];

export const mockTrades: Trade[] = [
  {
    id: '1',
    timestamp: '2025-11-11 14:23:12',
    token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    entry: 1.0,
    exit: 1.02,
    pnl: 42.5,
    pnlPercent: 2.0,
    status: 'closed',
  },
  {
    id: '2',
    timestamp: '2025-11-11 13:15:08',
    token: 'So11111111111111111111111111111111111111112',
    tokenSymbol: 'SOL',
    entry: 145.23,
    exit: 152.34,
    pnl: 148.2,
    pnlPercent: 4.9,
    status: 'closed',
  },
  {
    id: '3',
    timestamp: '2025-11-11 12:45:33',
    token: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    tokenSymbol: 'mSOL',
    entry: 158.45,
    exit: 155.12,
    pnl: -68.4,
    pnlPercent: -2.1,
    status: 'closed',
  },
  {
    id: '4',
    timestamp: '2025-11-11 11:32:19',
    token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    tokenSymbol: 'USDT',
    entry: 1.0,
    exit: null,
    pnl: 0,
    pnlPercent: 0,
    status: 'open',
  },
  {
    id: '5',
    timestamp: '2025-11-11 10:18:47',
    token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    tokenSymbol: 'BONK',
    entry: 0.000012,
    exit: 0.000015,
    pnl: 256.8,
    pnlPercent: 25.0,
    status: 'closed',
  },
  {
    id: '6',
    timestamp: '2025-11-11 09:42:23',
    token: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    tokenSymbol: 'ORCA',
    entry: 3.45,
    exit: 3.89,
    pnl: 92.3,
    pnlPercent: 12.8,
    status: 'closed',
  },
];

export const mockCallerOptions = [
  { value: '', label: 'Select a trader...' },
  { value: 'trader1', label: 'Momentum Scalper (68.5% WR)' },
  { value: 'trader2', label: 'Swing Master (72.1% WR)' },
  { value: 'trader3', label: 'Trend Follower (65.4% WR)' },
  { value: 'trader4', label: 'DeFi Hunter (70.2% WR)' },
];

// Get recent wins (last 3 profitable trades)
export const getRecentWins = (): Trade[] => {
  return mockTrades
    .filter(trade => trade.pnl > 0 && trade.status === 'closed')
    .slice(0, 3);
};
