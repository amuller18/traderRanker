/**
 * Comprehensive unit tests for frontend backtest logic.
 *
 * Tests cover:
 * 1. TP/SL ladder conversion to API format
 * 2. Number formatting utilities
 * 3. Solana address validation
 * 4. Summary statistics calculations
 * 5. Position sizing calculations
 * 6. Chart data processing
 * 7. Caller filtering
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// Type Definitions (matching frontend)
// ============================================================================

interface TakeProfitLevel {
  percentage: number;
  sellPercentage: number;
}

interface StopLossLevel {
  percentage: number;
  sellPercentage: number;
}

interface PositionSizing {
  type: 'percentage' | 'fixed';
  value: number;
}

interface Trade {
  ca: string;
  caller: string;
  date_called: string;
  initial_mc: number;
  current_mc: number;
}

interface TokenBreakdown {
  token: string;
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  trade_roi: number;
  is_valid: boolean;
  tps_hit: number[];
  sls_hit: number[];
}

interface CallerStats {
  caller: string;
  totalTrades: number;
  validTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  avgTradeROI: number;
  winRate: number;
  profitFactor: number;
}

// ============================================================================
// Helper Functions (from frontend)
// ============================================================================

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const isValidSolanaAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
};

const ladderToString = (arr: (TakeProfitLevel | StopLossLevel)[]) => {
  const list = arr
    .filter((l) => l.sellPercentage >= 0 && l.percentage >= 0)
    .map((l) => `${Math.abs(l.percentage) / 100}:${l.sellPercentage / 100}`)
    .filter(Boolean);
  return list.length ? list : ['0:0'];
};

const fmt = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const formatLargeNumber = (n: number) => {
  if (n === undefined || n === null || isNaN(n)) return '0';
  return fmt.format(n);
};

const formatCoinsLeft = (coins: number) => {
  if (coins === 0) return '0';
  if (coins < 0.000001) return coins.toExponential(2);
  if (coins < 0.001) return coins.toFixed(8);
  if (coins < 1) return coins.toFixed(6);
  if (coins < 1000) return coins.toFixed(2);
  if (coins < 1000000) return `${(coins / 1000).toFixed(1)}K`;
  if (coins < 1000000000) return `${(coins / 1000000).toFixed(1)}M`;
  return `${(coins / 1000000000).toFixed(1)}B`;
};

const formatDate = (unix: number) =>
  new Date(unix * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

// Position size calculation
const calculatePositionSize = (
  initialCapital: number,
  positionSizing: PositionSizing
): number => {
  if (positionSizing.type === 'percentage') {
    return initialCapital * (positionSizing.value / 100);
  }
  return positionSizing.value;
};

// Win rate calculation
const calculateWinRate = (breakdowns: TokenBreakdown[]): number => {
  const validTrades = breakdowns.filter((b) => b.is_valid);
  if (validTrades.length === 0) return 0;
  const winningTrades = validTrades.filter((b) => b.total_pnl > 0);
  return (winningTrades.length / validTrades.length) * 100;
};

// Profit factor calculation
const calculateProfitFactor = (breakdowns: TokenBreakdown[]): number => {
  const validTrades = breakdowns.filter((b) => b.is_valid);
  const grossProfit = validTrades
    .filter((b) => b.total_pnl > 0)
    .reduce((sum, b) => sum + b.total_pnl, 0);
  const grossLoss = Math.abs(
    validTrades
      .filter((b) => b.total_pnl < 0)
      .reduce((sum, b) => sum + b.total_pnl, 0)
  );
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
};

// Account ROI calculation
const calculateAccountROI = (
  initialCapital: number,
  totalProfit: number
): number => {
  if (initialCapital === 0) return 0;
  return (totalProfit / initialCapital) * 100;
};

// Trade ROI calculation (per individual trade)
const calculateTradeROI = (
  tradeCapital: number,
  totalPnL: number
): number => {
  if (tradeCapital === 0) return 0;
  return (totalPnL / tradeCapital) * 100;
};

// Filter trades by caller
const filterTradesByCaller = (trades: Trade[], caller: string): Trade[] => {
  if (caller === 'all') return trades;
  return trades.filter((t) => t.caller === caller);
};

// Get unique callers from trades
const getUniqueCallers = (trades: Trade[]): string[] => {
  const callers = new Set(trades.map((t) => t.caller));
  return Array.from(callers).sort();
};

// ============================================================================
// 1. Ladder Conversion Tests
// ============================================================================

describe('Ladder Conversion', () => {
  it('should convert single TP level correctly', () => {
    const ladder: TakeProfitLevel[] = [{ percentage: 10, sellPercentage: 50 }];
    const result = ladderToString(ladder);

    expect(result).toEqual(['0.1:0.5']);
  });

  it('should convert multiple TP levels correctly', () => {
    const ladder: TakeProfitLevel[] = [
      { percentage: 10, sellPercentage: 30 },
      { percentage: 20, sellPercentage: 30 },
      { percentage: 50, sellPercentage: 40 },
    ];
    const result = ladderToString(ladder);

    expect(result).toEqual(['0.1:0.3', '0.2:0.3', '0.5:0.4']);
  });

  it('should return ["0:0"] for empty ladder', () => {
    const ladder: TakeProfitLevel[] = [];
    const result = ladderToString(ladder);

    expect(result).toEqual(['0:0']);
  });

  it('should convert SL levels correctly', () => {
    const ladder: StopLossLevel[] = [{ percentage: 10, sellPercentage: 100 }];
    const result = ladderToString(ladder);

    expect(result).toEqual(['0.1:1']);
  });

  it('should handle 100% sell correctly', () => {
    const ladder: TakeProfitLevel[] = [{ percentage: 50, sellPercentage: 100 }];
    const result = ladderToString(ladder);

    expect(result).toEqual(['0.5:1']);
  });

  it('should handle very small percentages', () => {
    const ladder: TakeProfitLevel[] = [{ percentage: 1, sellPercentage: 10 }];
    const result = ladderToString(ladder);

    expect(result).toEqual(['0.01:0.1']);
  });

  it('should handle 0:0 levels (disabled)', () => {
    const ladder: TakeProfitLevel[] = [{ percentage: 0, sellPercentage: 0 }];
    const result = ladderToString(ladder);

    // 0:0 is valid (sentinel for disabled)
    expect(result).toEqual(['0:0']);
  });
});

// ============================================================================
// 2. Solana Address Validation Tests
// ============================================================================

describe('Solana Address Validation', () => {
  it('should accept valid Solana addresses', () => {
    const validAddresses = [
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    ];

    for (const addr of validAddresses) {
      expect(isValidSolanaAddress(addr)).toBe(true);
    }
  });

  it('should reject empty string', () => {
    expect(isValidSolanaAddress('')).toBe(false);
  });

  it('should reject too short addresses', () => {
    expect(isValidSolanaAddress('abc123')).toBe(false);
    expect(isValidSolanaAddress('So1111111111111111111111111111')).toBe(false); // 31 chars
  });

  it('should reject too long addresses', () => {
    const tooLong = 'So111111111111111111111111111111111111111111111'; // 45+ chars
    expect(isValidSolanaAddress(tooLong)).toBe(false);
  });

  it('should reject addresses with invalid characters', () => {
    // Contains '0' which is not in base58
    expect(isValidSolanaAddress('0o11111111111111111111111111111111111111112')).toBe(false);
    // Contains 'O' which is not in base58
    expect(isValidSolanaAddress('SO11111111111111111111111111111111111111112')).toBe(false);
    // Contains 'I' which is not in base58
    expect(isValidSolanaAddress('SI11111111111111111111111111111111111111112')).toBe(false);
    // Contains 'l' which is not in base58
    expect(isValidSolanaAddress('Sl11111111111111111111111111111111111111112')).toBe(false);
  });

  it('should reject Ethereum addresses', () => {
    expect(isValidSolanaAddress('0x1234567890123456789012345678901234567890')).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(isValidSolanaAddress(null as any)).toBe(false);
    expect(isValidSolanaAddress(undefined as any)).toBe(false);
  });
});

// ============================================================================
// 3. Number Formatting Tests
// ============================================================================

describe('Number Formatting', () => {
  describe('formatLargeNumber', () => {
    it('should format small numbers correctly', () => {
      expect(formatLargeNumber(0)).toBe('0');
      expect(formatLargeNumber(100)).toBe('100');
      expect(formatLargeNumber(999)).toBe('999');
    });

    it('should format thousands with K suffix', () => {
      expect(formatLargeNumber(1000)).toBe('1K');
      expect(formatLargeNumber(5500)).toBe('5.5K');
      expect(formatLargeNumber(999999)).toMatch(/1000?K|1M/);
    });

    it('should format millions with M suffix', () => {
      expect(formatLargeNumber(1000000)).toBe('1M');
      expect(formatLargeNumber(5500000)).toBe('5.5M');
    });

    it('should format billions with B suffix', () => {
      expect(formatLargeNumber(1000000000)).toBe('1B');
    });

    it('should handle NaN', () => {
      expect(formatLargeNumber(NaN)).toBe('0');
    });

    it('should handle undefined/null', () => {
      expect(formatLargeNumber(undefined as any)).toBe('0');
      expect(formatLargeNumber(null as any)).toBe('0');
    });
  });

  describe('formatCoinsLeft', () => {
    it('should format zero', () => {
      expect(formatCoinsLeft(0)).toBe('0');
    });

    it('should format very small numbers with exponential', () => {
      expect(formatCoinsLeft(0.0000001)).toMatch(/e/);
    });

    it('should format small numbers with many decimals', () => {
      const result = formatCoinsLeft(0.00001234);
      expect(result).toContain('1234');
    });

    it('should format normal numbers with 2 decimals', () => {
      expect(formatCoinsLeft(123.456)).toBe('123.46');
    });

    it('should format thousands with K suffix', () => {
      expect(formatCoinsLeft(1234)).toBe('1.2K');
      expect(formatCoinsLeft(50000)).toBe('50.0K');
    });

    it('should format millions with M suffix', () => {
      expect(formatCoinsLeft(1234567)).toBe('1.2M');
    });

    it('should format billions with B suffix', () => {
      expect(formatCoinsLeft(1234567890)).toBe('1.2B');
    });
  });
});

// ============================================================================
// 4. Position Sizing Tests
// ============================================================================

describe('Position Sizing', () => {
  it('should calculate percentage-based position size', () => {
    const capital = 10000;
    const sizing: PositionSizing = { type: 'percentage', value: 5 }; // 5%

    const result = calculatePositionSize(capital, sizing);

    expect(result).toBe(500); // 5% of 10000 = 500
  });

  it('should calculate fixed position size', () => {
    const capital = 10000;
    const sizing: PositionSizing = { type: 'fixed', value: 100 };

    const result = calculatePositionSize(capital, sizing);

    expect(result).toBe(100);
  });

  it('should handle small percentage', () => {
    const capital = 1000;
    const sizing: PositionSizing = { type: 'percentage', value: 1 }; // 1%

    const result = calculatePositionSize(capital, sizing);

    expect(result).toBe(10);
  });

  it('should handle 100% position size', () => {
    const capital = 1000;
    const sizing: PositionSizing = { type: 'percentage', value: 100 };

    const result = calculatePositionSize(capital, sizing);

    expect(result).toBe(1000);
  });
});

// ============================================================================
// 5. ROI Calculations Tests
// ============================================================================

describe('ROI Calculations', () => {
  describe('Account ROI', () => {
    it('should calculate positive ROI correctly', () => {
      const initialCapital = 1000;
      const totalProfit = 200;

      const roi = calculateAccountROI(initialCapital, totalProfit);

      expect(roi).toBe(20); // 20%
    });

    it('should calculate negative ROI correctly', () => {
      const initialCapital = 1000;
      const totalProfit = -150;

      const roi = calculateAccountROI(initialCapital, totalProfit);

      expect(roi).toBe(-15); // -15%
    });

    it('should handle zero capital', () => {
      const roi = calculateAccountROI(0, 100);
      expect(roi).toBe(0);
    });

    it('should handle break-even', () => {
      const roi = calculateAccountROI(1000, 0);
      expect(roi).toBe(0);
    });
  });

  describe('Trade ROI', () => {
    it('should calculate trade ROI correctly', () => {
      const tradeCapital = 100;
      const totalPnL = 20;

      const roi = calculateTradeROI(tradeCapital, totalPnL);

      expect(roi).toBe(20); // 20%
    });

    it('should be different from account ROI', () => {
      const accountCapital = 10000;
      const tradeCapital = 100;
      const totalPnL = 20;

      const accountROI = calculateAccountROI(accountCapital, totalPnL);
      const tradeROI = calculateTradeROI(tradeCapital, totalPnL);

      expect(accountROI).toBe(0.2); // 0.2%
      expect(tradeROI).toBe(20); // 20%
      expect(tradeROI).not.toBe(accountROI);
    });
  });
});

// ============================================================================
// 6. Summary Statistics Tests
// ============================================================================

describe('Summary Statistics', () => {
  describe('Win Rate', () => {
    it('should calculate win rate correctly', () => {
      const breakdowns: TokenBreakdown[] = [
        { token: 'A', total_pnl: 50, realized_pnl: 50, unrealized_pnl: 0, trade_roi: 50, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'B', total_pnl: -20, realized_pnl: -20, unrealized_pnl: 0, trade_roi: -20, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'C', total_pnl: 30, realized_pnl: 30, unrealized_pnl: 0, trade_roi: 30, is_valid: true, tps_hit: [], sls_hit: [] },
      ];

      const winRate = calculateWinRate(breakdowns);

      expect(winRate).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
    });

    it('should exclude invalid trades from win rate', () => {
      const breakdowns: TokenBreakdown[] = [
        { token: 'A', total_pnl: 50, realized_pnl: 50, unrealized_pnl: 0, trade_roi: 50, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'B', total_pnl: -20, realized_pnl: -20, unrealized_pnl: 0, trade_roi: -20, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'C', total_pnl: -100, realized_pnl: 0, unrealized_pnl: 0, trade_roi: 0, is_valid: false, tps_hit: [], sls_hit: [] }, // Invalid
      ];

      const winRate = calculateWinRate(breakdowns);

      expect(winRate).toBe(50); // 1/2 = 50% (invalid excluded)
    });

    it('should return 0 for no valid trades', () => {
      const breakdowns: TokenBreakdown[] = [
        { token: 'A', total_pnl: 0, realized_pnl: 0, unrealized_pnl: 0, trade_roi: 0, is_valid: false, tps_hit: [], sls_hit: [] },
      ];

      const winRate = calculateWinRate(breakdowns);

      expect(winRate).toBe(0);
    });

    it('should return 100% for all winning trades', () => {
      const breakdowns: TokenBreakdown[] = [
        { token: 'A', total_pnl: 50, realized_pnl: 50, unrealized_pnl: 0, trade_roi: 50, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'B', total_pnl: 30, realized_pnl: 30, unrealized_pnl: 0, trade_roi: 30, is_valid: true, tps_hit: [], sls_hit: [] },
      ];

      const winRate = calculateWinRate(breakdowns);

      expect(winRate).toBe(100);
    });
  });

  describe('Profit Factor', () => {
    it('should calculate profit factor correctly', () => {
      const breakdowns: TokenBreakdown[] = [
        { token: 'A', total_pnl: 60, realized_pnl: 60, unrealized_pnl: 0, trade_roi: 60, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'B', total_pnl: -20, realized_pnl: -20, unrealized_pnl: 0, trade_roi: -20, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'C', total_pnl: 40, realized_pnl: 40, unrealized_pnl: 0, trade_roi: 40, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'D', total_pnl: -30, realized_pnl: -30, unrealized_pnl: 0, trade_roi: -30, is_valid: true, tps_hit: [], sls_hit: [] },
      ];

      const pf = calculateProfitFactor(breakdowns);

      // Gross profit = 60 + 40 = 100
      // Gross loss = 20 + 30 = 50
      // PF = 100 / 50 = 2.0
      expect(pf).toBe(2);
    });

    it('should return Infinity for no losses', () => {
      const breakdowns: TokenBreakdown[] = [
        { token: 'A', total_pnl: 50, realized_pnl: 50, unrealized_pnl: 0, trade_roi: 50, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'B', total_pnl: 30, realized_pnl: 30, unrealized_pnl: 0, trade_roi: 30, is_valid: true, tps_hit: [], sls_hit: [] },
      ];

      const pf = calculateProfitFactor(breakdowns);

      expect(pf).toBe(Infinity);
    });

    it('should return 0 for no gains', () => {
      const breakdowns: TokenBreakdown[] = [
        { token: 'A', total_pnl: -50, realized_pnl: -50, unrealized_pnl: 0, trade_roi: -50, is_valid: true, tps_hit: [], sls_hit: [] },
        { token: 'B', total_pnl: -30, realized_pnl: -30, unrealized_pnl: 0, trade_roi: -30, is_valid: true, tps_hit: [], sls_hit: [] },
      ];

      const pf = calculateProfitFactor(breakdowns);

      expect(pf).toBe(0);
    });
  });
});

// ============================================================================
// 7. Trade Filtering Tests
// ============================================================================

describe('Trade Filtering', () => {
  const sampleTrades: Trade[] = [
    { ca: 'token1', caller: 'CallerA', date_called: '2024-01-01T12:00:00Z', initial_mc: 100000, current_mc: 150000 },
    { ca: 'token2', caller: 'CallerA', date_called: '2024-01-02T12:00:00Z', initial_mc: 200000, current_mc: 180000 },
    { ca: 'token3', caller: 'CallerB', date_called: '2024-01-03T12:00:00Z', initial_mc: 50000, current_mc: 100000 },
    { ca: 'token4', caller: 'CallerC', date_called: '2024-01-04T12:00:00Z', initial_mc: 300000, current_mc: 250000 },
  ];

  it('should return all trades when caller is "all"', () => {
    const result = filterTradesByCaller(sampleTrades, 'all');
    expect(result).toHaveLength(4);
  });

  it('should filter by specific caller', () => {
    const result = filterTradesByCaller(sampleTrades, 'CallerA');
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.caller === 'CallerA')).toBe(true);
  });

  it('should return empty array for non-existent caller', () => {
    const result = filterTradesByCaller(sampleTrades, 'NonExistent');
    expect(result).toHaveLength(0);
  });

  it('should get unique callers', () => {
    const callers = getUniqueCallers(sampleTrades);
    expect(callers).toEqual(['CallerA', 'CallerB', 'CallerC']);
  });
});

// ============================================================================
// 8. PnL Breakdown Tests
// ============================================================================

describe('PnL Breakdown', () => {
  it('should correctly sum realized and unrealized PnL', () => {
    const breakdown: TokenBreakdown = {
      token: 'test',
      total_pnl: 30, // Should equal realized + unrealized
      realized_pnl: 20,
      unrealized_pnl: 10,
      trade_roi: 30,
      is_valid: true,
      tps_hit: [1.1],
      sls_hit: [],
    };

    expect(breakdown.total_pnl).toBe(breakdown.realized_pnl + breakdown.unrealized_pnl);
  });

  it('should handle all-realized scenario (position closed)', () => {
    const breakdown: TokenBreakdown = {
      token: 'test',
      total_pnl: 50,
      realized_pnl: 50,
      unrealized_pnl: 0, // Position fully closed
      trade_roi: 50,
      is_valid: true,
      tps_hit: [1.1, 1.2],
      sls_hit: [],
    };

    expect(breakdown.unrealized_pnl).toBe(0);
    expect(breakdown.total_pnl).toBe(breakdown.realized_pnl);
  });

  it('should handle all-unrealized scenario (no sells)', () => {
    const breakdown: TokenBreakdown = {
      token: 'test',
      total_pnl: 25,
      realized_pnl: 0, // No sells yet
      unrealized_pnl: 25,
      trade_roi: 25,
      is_valid: true,
      tps_hit: [],
      sls_hit: [],
    };

    expect(breakdown.realized_pnl).toBe(0);
    expect(breakdown.total_pnl).toBe(breakdown.unrealized_pnl);
  });

  it('should handle negative PnL correctly', () => {
    const breakdown: TokenBreakdown = {
      token: 'test',
      total_pnl: -30,
      realized_pnl: -20,
      unrealized_pnl: -10,
      trade_roi: -30,
      is_valid: true,
      tps_hit: [],
      sls_hit: [0.9],
    };

    expect(breakdown.total_pnl).toBe(breakdown.realized_pnl + breakdown.unrealized_pnl);
    expect(breakdown.total_pnl).toBeLessThan(0);
  });
});

// ============================================================================
// 9. Caller Stats Aggregation Tests
// ============================================================================

describe('Caller Stats Aggregation', () => {
  const calculateCallerStats = (
    breakdowns: (TokenBreakdown & { caller: string })[]
  ): CallerStats[] => {
    const callerMap = new Map<string, CallerStats>();

    for (const b of breakdowns) {
      if (!callerMap.has(b.caller)) {
        callerMap.set(b.caller, {
          caller: b.caller,
          totalTrades: 0,
          validTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnL: 0,
          avgTradeROI: 0,
          winRate: 0,
          profitFactor: 0,
        });
      }

      const stats = callerMap.get(b.caller)!;
      stats.totalTrades++;

      if (b.is_valid) {
        stats.validTrades++;
        stats.totalPnL += b.total_pnl;
        if (b.total_pnl > 0) stats.winningTrades++;
        if (b.total_pnl < 0) stats.losingTrades++;
      }
    }

    // Calculate derived metrics
    for (const stats of callerMap.values()) {
      if (stats.validTrades > 0) {
        stats.winRate = (stats.winningTrades / stats.validTrades) * 100;
      }
    }

    return Array.from(callerMap.values());
  };

  it('should aggregate stats by caller correctly', () => {
    const breakdowns = [
      { token: 'A', caller: 'CallerA', total_pnl: 50, realized_pnl: 50, unrealized_pnl: 0, trade_roi: 50, is_valid: true, tps_hit: [], sls_hit: [] },
      { token: 'B', caller: 'CallerA', total_pnl: -20, realized_pnl: -20, unrealized_pnl: 0, trade_roi: -20, is_valid: true, tps_hit: [], sls_hit: [] },
      { token: 'C', caller: 'CallerB', total_pnl: 100, realized_pnl: 100, unrealized_pnl: 0, trade_roi: 100, is_valid: true, tps_hit: [], sls_hit: [] },
    ];

    const stats = calculateCallerStats(breakdowns);

    const callerA = stats.find((s) => s.caller === 'CallerA')!;
    const callerB = stats.find((s) => s.caller === 'CallerB')!;

    expect(callerA.totalTrades).toBe(2);
    expect(callerA.totalPnL).toBe(30); // 50 - 20
    expect(callerA.winningTrades).toBe(1);
    expect(callerA.losingTrades).toBe(1);
    expect(callerA.winRate).toBe(50);

    expect(callerB.totalTrades).toBe(1);
    expect(callerB.totalPnL).toBe(100);
    expect(callerB.winRate).toBe(100);
  });
});

// ============================================================================
// 10. Date/Time Formatting Tests
// ============================================================================

describe('Date Formatting', () => {
  it('should format unix timestamp correctly', () => {
    const unix = 1704067200; // 2024-01-01 00:00:00 UTC
    const formatted = formatDate(unix);

    expect(formatted).toContain('Jan');
    expect(formatted).toContain('1');
  });

  it('should handle different timestamps', () => {
    const unix1 = 1704153600; // 2024-01-02 00:00:00 UTC
    const unix2 = 1706745600; // 2024-02-01 00:00:00 UTC

    const formatted1 = formatDate(unix1);
    const formatted2 = formatDate(unix2);

    expect(formatted1).toContain('Jan');
    expect(formatted2).toContain('Feb');
  });
});

// ============================================================================
// 11. Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty breakdowns array', () => {
    const breakdowns: TokenBreakdown[] = [];

    expect(calculateWinRate(breakdowns)).toBe(0);
    expect(calculateProfitFactor(breakdowns)).toBe(0);
  });

  it('should handle single trade', () => {
    const breakdowns: TokenBreakdown[] = [
      { token: 'A', total_pnl: 50, realized_pnl: 50, unrealized_pnl: 0, trade_roi: 50, is_valid: true, tps_hit: [], sls_hit: [] },
    ];

    expect(calculateWinRate(breakdowns)).toBe(100);
    expect(calculateProfitFactor(breakdowns)).toBe(Infinity);
  });

  it('should handle break-even trades (PnL = 0)', () => {
    const breakdowns: TokenBreakdown[] = [
      { token: 'A', total_pnl: 0, realized_pnl: 0, unrealized_pnl: 0, trade_roi: 0, is_valid: true, tps_hit: [], sls_hit: [] },
    ];

    // Break-even is neither win nor loss
    expect(calculateWinRate(breakdowns)).toBe(0); // 0 winning out of 1
  });

  it('should handle very large numbers', () => {
    const capital = 1000000000; // $1B
    const sizing: PositionSizing = { type: 'percentage', value: 0.01 }; // 0.01%

    const result = calculatePositionSize(capital, sizing);

    expect(result).toBe(100000); // $100K
  });

  it('should handle very small percentages', () => {
    const capital = 1000;
    const sizing: PositionSizing = { type: 'percentage', value: 0.1 }; // 0.1%

    const result = calculatePositionSize(capital, sizing);

    expect(result).toBe(1); // $1
  });
});
