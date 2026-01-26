"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Minus, RefreshCw, Play, Loader2 } from "lucide-react";
import { fetchAllTrades } from "@/lib/api-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

/* ---------------------------------------------------------------------
 * CONSTANTS (frontend defaults aligned with working cURL example)
 * -------------------------------------------------------------------*/
const DEFAULT_DAYS_BACK = 30; // Increased to 30 days to show more price action

/* ---------------------------------------------------------------------
 * TYPES
 * -------------------------------------------------------------------*/
interface TakeProfitLevel {
  percentage: number;
  sellPercentage: number;
}
interface StopLossLevel {
  percentage: number;
  sellPercentage: number;
}
interface PositionSizing {
  type: "percentage" | "fixed";
  value: number;
}
export interface Trade {
  ca: string;
  caller: string;
  date_called: string;
  initial_mc: number;
  current_mc: number;
}
interface PositionPoint {
  ts: number;
  value: number;
  coins_held: number;
  unrealized: number;
  realized: number;
}
interface SimulationResult {
  token: string;
  ledger: PositionPoint[] | null;
  realized_profit: number | null;
  unrealized_profit: number | null;
  coins_left: number | null;
  tps_hit: number[] | null;
  sls_hit: number[] | null;
  error?: string;
}

interface TokenBreakdown {
  token: string;
  trade_id: string;
  time_called: string;
  entry_price: number;
  final_price: number;  // Current market price (mark-to-market)
  ath_price: number;    // For display only, NOT used in calculations
  ath_percentage: number;  // For display only
  total_pnl: number;    // realized_pnl + unrealized_pnl
  realized_pnl: number; // From actual sells
  unrealized_pnl: number;  // Mark-to-market from remaining tokens
  coins_left: number;
  coins_initial: number;
  trade_capital: number;  // USD spent on entries for this trade
  final_value: number;    // Cash from sells + remaining tokens * current price
  max_drawdown: number;
  trade_roi: number;      // Trade ROI = total_pnl / trade_capital (NOT dependent on account balance)
  roi_to_date: number;    // Same as trade_roi (backwards compatibility)
  is_valid: boolean;      // Whether this trade has valid data
  validation_errors: string[];  // List of validation issues if any
  tps_hit: number[];
  sls_hit: number[];
  error?: string;
}

/**
 * Summary statistics for the backtest.
 *
 * ROI Definitions (STRICTLY SEPARATED):
 * - accountROI: (final_account_equity - starting_account_equity) / starting_account_equity
 *   This is for summary/account-level display ONLY.
 * - avgTradeROI: Average of individual trade ROIs (for reference, different from accountROI)
 */
interface SummaryStats {
  totalProfit: number;         // Sum of all valid trade PnLs
  realizedProfit: number;      // Sum of realized PnLs only
  unrealizedProfit: number;    // Sum of unrealized PnLs only
  winRate: number;             // Percentage of winning trades (valid trades only)
  avgProfit: number;           // Average profit per valid trade
  avgTradeROI: number;         // Average trade ROI (NOT account ROI)
  accountROI: number;          // Account ROI = (final - starting) / starting
  finalPortfolioValue: number; // Final account equity
  startingCapital: number;     // Starting capital
  isBankrupt: boolean;
  totalTrades: number;         // Total trades processed
  validTrades: number;         // Number of valid trades
  invalidTrades: number;       // Number of invalid trades (excluded from metrics)
  durationMs: number;          // Time it took to complete the backtest in milliseconds
  // Additional metrics
  maxDrawdown: number;         // Maximum drawdown percentage
  profitFactor: number;        // Gross profit / Gross loss
  winningTrades: number;       // Number of winning trades
  losingTrades: number;        // Number of losing trades
  avgWin: number;              // Average profit of winning trades
  avgLoss: number;             // Average loss of losing trades (negative)
  largestWin: number;          // Largest single winning trade
  largestLoss: number;         // Largest single losing trade (negative)
  expectancy: number;          // Expected value per trade
  riskRewardRatio: number;     // Average win / Average loss (absolute)
}
interface BacktestModernPageProps {
  initialTrades: Trade[];
}

/**
 * Per-caller performance statistics
 */
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
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
}

/* ---------------------------------------------------------------------
 * HELPERS
 * -------------------------------------------------------------------*/
const fmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2
});
const formatLargeNumber = (n: number) => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return fmt.format(n);
};

// Format large numbers for coins left (human readable)
const formatCoinsLeft = (coins: number) => {
  if (coins === 0) return "0";
  if (coins < 0.000001) return coins.toExponential(2);
  if (coins < 0.001) return coins.toFixed(8);
  if (coins < 1) return coins.toFixed(6);
  if (coins < 1000) return coins.toFixed(2);
  if (coins < 1000000) return `${(coins / 1000).toFixed(1)}K`;
  if (coins < 1000000000) return `${(coins / 1000000).toFixed(1)}M`;
  return `${(coins / 1000000000).toFixed(1)}B`;
};

const formatDate = (unix: number) =>
  new Date(unix * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

/**
 * Convert TP/SL ladders to API string format.
 * If the ladder is empty (or every level is 0 %), the backend expects
 * an explicit ["0:0"] so we fall back to that sentinel.
 */
const ladderToString = (arr: (TakeProfitLevel | StopLossLevel)[]) => {
  const list = arr
    .filter((l) => l.sellPercentage >= 0 && l.percentage >= 0) // allow 0:0
    .map((l) => `${Math.abs(l.percentage) / 100}:${l.sellPercentage / 100}`)
    .filter(Boolean);
  return list.length ? list : ["0:0"]; // backend‑safe default
};

/**
 * Validate Solana address format.
 * Solana addresses are 32-44 character base58 strings.
 */
const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const isValidSolanaAddress = (address: string): boolean => {
  if (!address || typeof address !== "string") return false;
  // Solana addresses are typically 32-44 characters
  if (address.length < 32 || address.length > 44) return false;
  // Must only contain valid base58 characters
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
};

/* ---------------------------------------------------------------------
 * COMPONENT
 * -------------------------------------------------------------------*/
export default function ModernBacktestPage({ initialTrades }: BacktestModernPageProps) {
  /* ─────────────────────── state ─────────────────────── */
  // Trades loaded from DynamoDB
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState<string | null>(null);

  const [takeProfits, setTakeProfits] = useState<TakeProfitLevel[]>([
    { percentage: 20, sellPercentage: 50 },  // 20% gain, sell 50% of position
    { percentage: 50, sellPercentage: 30 },  // 50% gain, sell 30% of position
    { percentage: 100, sellPercentage: 20 }  // 100% gain, sell remaining 20%
  ]);
  const [stopLosses, setStopLosses] = useState<StopLossLevel[]>([
    { percentage: 10, sellPercentage: 100 }  // 10% loss, sell entire position
  ]);
  const [initialCapital, setInitialCapital] = useState(1000);
  const [positionSizing, setPositionSizing] = useState<PositionSizing>({
    type: "percentage",
    value: 1  // Changed default to 1% per trade
  });
  const [maxBacktests, setMaxBacktests] = useState(100); // New parameter for max backtests
  const [timeframe] = useState<string>("240"); // Fixed to 4 hours
  const [selectedCaller, setSelectedCaller] = useState("all");
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
  const [legendSearch, setLegendSearch] = useState<string>("");
  const [legendPage, setLegendPage] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [cumChartData, setCumChartData] = useState<any[]>([]);

  // Compute all unique trade keys across ALL chart data rows (not just the first row)
  // This is needed because trades start at different times
  const allTradeKeys = useMemo(() => {
    if (chartData.length === 0) return [];
    const keys = new Set<string>();
    chartData.forEach(row => {
      Object.keys(row).forEach(k => {
        if (k !== 'ts' && k !== 'date' && k.includes('_')) {
          keys.add(k);
        }
      });
    });
    return Array.from(keys);
  }, [chartData]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [tokenBreakdown, setTokenBreakdown] = useState<TokenBreakdown[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("settings"); // Track active tab
  const [backtestDuration, setBacktestDuration] = useState<number | null>(null); // Duration in ms
  const [showInvalidTrades, setShowInvalidTrades] = useState(false); // Toggle for showing invalid trades
  const [callerStats, setCallerStats] = useState<CallerStats[]>([]); // Per-caller performance stats
  const [apiStatus, setApiStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");
  const pythonApiUrl =
    process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:8000";

  /* ─────────────────────── load trades from DynamoDB ─────────────────────── */
  const loadTrades = useCallback(async () => {
    setTradesLoading(true);
    setTradesError(null);
    try {
      console.log("Fetching trades from DynamoDB for backtesting...");
      const fetchedTrades = await fetchAllTrades();
      console.log(`Loaded ${fetchedTrades.length} trades from API`);

      // Convert to the simple Trade format expected by backtest
      // Filter out trades with missing/invalid data
      const backtestTrades: Trade[] = fetchedTrades
        .filter(t => {
          // Validate: must have valid token address (44 chars for Solana), caller, and date
          const hasValidCa = typeof t.ca === 'string' && t.ca.length >= 32 && t.ca.length <= 44;
          const hasCaller = typeof t.caller === 'string' && t.caller.trim().length > 0;
          const hasDate = typeof t.date_called === 'string' && t.date_called.length > 0;

          if (!hasValidCa) console.log(`Skipping trade with invalid ca: ${t.ca}`);
          if (!hasCaller) console.log(`Skipping trade with missing caller`);
          if (!hasDate) console.log(`Skipping trade with missing date_called`);

          return hasValidCa && hasCaller && hasDate;
        })
        .map(t => ({
          ca: t.ca,
          caller: t.caller,
          date_called: t.date_called,
          initial_mc: t.initial_mc,
          current_mc: t.current_mc,
        }));

      console.log(`${backtestTrades.length} valid trades for backtesting`);
      setTrades(backtestTrades);
    } catch (error) {
      console.error("Error loading trades for backtesting:", error);
      setTradesError(error instanceof Error ? error.message : "Failed to load trades");
    } finally {
      setTradesLoading(false);
    }
  }, []);

  // Load trades on mount
  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  /* ─────────────────────── memo ──────────────────────── */
  const callers = useMemo(
    () => Array.from(new Set(trades.map((t) => t.caller)))
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0),
    [trades]
  );

  const filteredTrades = useMemo(
    () => {
      let filtered = selectedCaller === "all"
        ? trades
        : trades.filter((t) => t.caller === selectedCaller);

      // Limit to max backtests
      if (maxBacktests > 0 && filtered.length > maxBacktests) {
        filtered = filtered.slice(0, maxBacktests);
      }

      return filtered;
    },
    [trades, selectedCaller, maxBacktests]
  );

  /* ─────────────────────── effects ───────────────────── */
  useEffect(() => {
    const ping = async () => {
      try {
        setApiStatus((await fetch(`${pythonApiUrl}/docs`)).ok ? "connected" : "disconnected");
      } catch {
        setApiStatus("disconnected");
      }
    };
    ping();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, [pythonApiUrl]);

  /* ─────────────────────── helpers ───────────────────── */
  const handleTPChange = (idx: number, field: keyof TakeProfitLevel, value: number) => {
    setTakeProfits((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value } as TakeProfitLevel;
      return next;
    });
  };

  const handleSLChange = (idx: number, field: keyof StopLossLevel, value: number) => {
    setStopLosses((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value } as StopLossLevel;
      return next;
    });
  };

  const handleLegendClick = (entry: any) => {
    setVisibleTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entry.dataKey)) {
        newSet.delete(entry.dataKey);
      } else {
        newSet.add(entry.dataKey);
      }
      return newSet;
    });
  };

  const formatChartDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /* ─────────────────────── actions ───────────────────── */
  const runBacktest = async () => {
    if (apiStatus !== "connected" || filteredTrades.length === 0) return;
    setIsRunning(true);
    setBacktestDuration(null); // Reset duration

    // Start timing
    const startTime = performance.now();

    // Sanitize: Filter out trades with invalid Solana addresses
    const validTrades = filteredTrades.filter((t) => isValidSolanaAddress(t.ca));
    const invalidCount = filteredTrades.length - validTrades.length;
    if (invalidCount > 0) {
      console.warn(`Filtered out ${invalidCount} trades with invalid Solana addresses`);
    }

    if (validTrades.length === 0) {
      console.error("No valid trades to simulate after filtering");
      setIsRunning(false);
      return;
    }

    // ------------------------------------------------------------------
    // REPLACEMENT LOGIC: Overfetch to collect N valid trades
    // If user requests N trades, send N + buffer to account for potential failures
    // This ensures we get enough valid trades even if some fail price data fetch
    // ------------------------------------------------------------------
    const targetValidTrades = maxBacktests > 0 ? maxBacktests : validTrades.length;
    const overfetchBuffer = Math.ceil(targetValidTrades * 0.5); // 50% buffer
    const tradesToSend = Math.min(
      targetValidTrades + overfetchBuffer,
      validTrades.length
    );
    const tradesToProcess = validTrades.slice(0, tradesToSend);

    console.log(`Target valid trades: ${targetValidTrades}, Overfetch buffer: ${overfetchBuffer}`);
    console.log(`Sending ${tradesToProcess.length} trades to API (may return fewer valid ones)`);

    const uniqueTokens = Array.from(new Set(tradesToProcess.map((t) => t.ca)));
    console.log(`Unique tokens to simulate: ${uniqueTokens.length}`);
    console.log(`Tokens: ${uniqueTokens.slice(0, 5).join(', ')}${uniqueTokens.length > 5 ? '...' : ''}`);

    // Calculate position size per trade (1% of capital per trade)
    const positionSizePerTrade = positionSizing.type === "percentage"
      ? (initialCapital * positionSizing.value) / 100
      : positionSizing.value;

    // Create trade-based payload with individual dates (using sanitized trades)
    const tradesPayload = {
      trades: tradesToProcess.map(trade => ({
        token: trade.ca,
        date_called: trade.date_called,
        caller: trade.caller || 'Unknown'
      })),
      amount_usd: positionSizePerTrade, // Position size per trade
      initial_capital: initialCapital,   // Total account capital for ROI calculations
      timeframe_minutes: parseInt(timeframe),
      use_auto_timeframe: false,
      tp: ladderToString(takeProfits),
      sl: ladderToString(stopLosses)
    } as const;

    try {
      // Debug: Log the payload being sent
      console.log("Sending backtest request:", JSON.stringify(tradesPayload, null, 2));

      // Call the unified backtest endpoint that returns everything
      const response = await fetch(`${pythonApiUrl}/api/backtest/dynamodb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradesPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backtest API error:", errorText);
        throw new Error(`Backtest API ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const {
        summary: apiSummary,
        breakdowns,
        simulations,
        chart_data: apiChartData,
        cumulative_chart_data: apiCumChartData,
        caller_stats: apiCallerStats
      } = data;

      // Separate valid and invalid breakdowns for display
      const validBreakdowns = breakdowns.filter((b: TokenBreakdown) => b.is_valid !== false && !b.error);
      const invalidBreakdowns = breakdowns.filter((b: TokenBreakdown) => b.is_valid === false || b.error);

      // Set token breakdown for display
      setTokenBreakdown([...validBreakdowns, ...invalidBreakdowns]);

      // Use pre-computed chart data from backend (no expensive client-side processing!)
      console.log(`Received ${apiChartData?.length || 0} chart data points from backend`);
      setChartData(apiChartData || []);
      setCumChartData(apiCumChartData || []);

      // Calculate duration
      const endTime = performance.now();
      const durationMs = endTime - startTime;
      setBacktestDuration(durationMs);

      // Use pre-computed caller stats from backend
      const calculatedCallerStats: CallerStats[] = (apiCallerStats || []).map((cs: any) => ({
        caller: cs.caller,
        totalTrades: cs.total_trades,
        validTrades: cs.valid_trades,
        winningTrades: cs.winning_trades,
        losingTrades: cs.losing_trades,
        totalPnL: cs.total_pnl,
        avgTradeROI: cs.avg_trade_roi,
        winRate: cs.win_rate,
        profitFactor: cs.profit_factor,
        avgWin: cs.avg_win,
        avgLoss: cs.avg_loss,
        largestWin: cs.largest_win,
        largestLoss: cs.largest_loss,
      }));
      setCallerStats(calculatedCallerStats);

      console.log(`\n=== PER-CALLER BREAKDOWN (from backend) ===`);
      calculatedCallerStats.forEach(cs => {
        console.log(`${cs.caller}: ${cs.validTrades} trades, ${(cs.winRate * 100).toFixed(0)}% win rate, $${cs.totalPnL.toFixed(2)} PnL`);
      });

      console.log(`\n=== BACKTEST COMPLETE ===`);
      console.log(`Duration: ${(durationMs / 1000).toFixed(2)}s`);
      console.log(`Account ROI: ${apiSummary.account_roi}%`);
      console.log(`Total PnL: $${apiSummary.total_profit}`);

      // Use the backend-calculated summary directly
      setSummary({
        totalProfit: apiSummary.total_profit,
        realizedProfit: apiSummary.realized_profit,
        unrealizedProfit: apiSummary.unrealized_profit,
        avgProfit: apiSummary.avg_profit,
        avgTradeROI: apiSummary.avg_trade_roi,
        accountROI: apiSummary.account_roi,
        winRate: apiSummary.win_rate,
        finalPortfolioValue: apiSummary.final_portfolio_value,
        startingCapital: apiSummary.starting_capital,
        isBankrupt: apiSummary.is_bankrupt,
        totalTrades: apiSummary.total_trades,
        validTrades: apiSummary.valid_trades,
        invalidTrades: apiSummary.invalid_trades,
        durationMs,
        maxDrawdown: apiSummary.max_drawdown,
        profitFactor: apiSummary.profit_factor,
        winningTrades: apiSummary.winning_trades,
        losingTrades: apiSummary.losing_trades,
        avgWin: apiSummary.avg_win,
        avgLoss: apiSummary.avg_loss,
        largestWin: apiSummary.largest_win,
        largestLoss: apiSummary.largest_loss,
        expectancy: apiSummary.expectancy,
        riskRewardRatio: apiSummary.risk_reward_ratio,
      });

      // Auto-switch to results tab after backtest completes
      setActiveTab("results");
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  /* ─────────────────────── UI render ────────────────── */
  return (
    <div className="container mx-auto py-10 space-y-10">
      {/* Loading/Error state */}
      {tradesLoading && (
        <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-muted-foreground">Loading trades from database...</span>
        </div>
      )}

      {tradesError && (
        <div className="flex items-center justify-between p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <span className="text-destructive">{tradesError}</span>
          <Button variant="outline" size="sm" onClick={loadTrades}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            apiStatus === "connected"
              ? "bg-green-500"
              : apiStatus === "checking"
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
        />
        <span className="text-muted-foreground">
          {apiStatus === "connected"
            ? "API connected"
            : apiStatus === "checking"
            ? "Checking API…"
            : "API offline"}
        </span>
        <span className="text-muted-foreground">
          • {tradesLoading ? "Loading..." : `${trades.length} trades loaded`}
        </span>
        <span className="text-muted-foreground">
          • {filteredTrades.length} trades selected
        </span>
        <span className="text-muted-foreground">
          • {callers.length} callers available
        </span>
        <span className="text-muted-foreground">
          • Position size: ${positionSizing.type === "percentage" ? ((initialCapital * positionSizing.value) / 100).toFixed(2) : positionSizing.value.toFixed(2)} per trade
        </span>
        <span className="text-muted-foreground">
          • Timeframe: 4h
        </span>
        {summary && (
          <>
            <span className="text-muted-foreground">
              • Account ROI: {summary.accountROI.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">
              • {summary.durationMs < 1000
                  ? `${summary.durationMs.toFixed(0)}ms`
                  : `${(summary.durationMs / 1000).toFixed(1)}s`}
            </span>
          </>
        )}
        {summary && summary.invalidTrades > 0 && (
          <span className="text-yellow-500">
            • {summary.invalidTrades} invalid trade{summary.invalidTrades > 1 ? 's' : ''} excluded
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTrades}
            disabled={tradesLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${tradesLoading ? 'animate-spin' : ''}`} />
            Refresh Trades
          </Button>
          <Button
            onClick={runBacktest}
            disabled={
              apiStatus !== "connected" || isRunning || filteredTrades.length === 0 || tradesLoading
            }
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isRunning ? "Running…" : "Run Backtest"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full sm:w-80 mx-auto mb-6">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="results" disabled={!chartData.length}>
            Results
          </TabsTrigger>
        </TabsList>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Backtest parameters</CardTitle>
              <CardDescription>
                Configure filters, capital and TP / SL ladders before running a
                simulation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* BASIC FILTERS */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* Caller filter */}
                <div className="space-y-2">
                  <Label htmlFor="caller">Caller</Label>
                  <Select
                    value={selectedCaller}
                    onValueChange={setSelectedCaller}
                    disabled={isRunning}
                  >
                    <SelectTrigger id="caller" disabled={isRunning}>
                      <SelectValue placeholder="All callers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {callers.map((c, idx) => (
                        <SelectItem key={`caller-${idx}-${c}`} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Initial capital */}
                <div className="space-y-2">
                  <Label htmlFor="capital">Initial capital ($)</Label>
                  <Input
                    id="capital"
                    type="number"
                    min={100}
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </div>

                {/* Max backtests */}
                <div className="space-y-2">
                  <Label htmlFor="maxBacktests">Max backtests</Label>
                  <Input
                    id="maxBacktests"
                    type="number"
                    min={1}
                    max={1000}
                    value={maxBacktests}
                    onChange={(e) => setMaxBacktests(Number(e.target.value))}
                    placeholder="100"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit number of trades to backtest
                  </p>
                </div>

                {/* Position sizing */}
                <div className="space-y-2">
                  <Label>Position sizing per trade</Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={positionSizing.type}
                      onValueChange={(val) =>
                        setPositionSizing((p) => ({ ...p, type: val as any }))
                      }
                      disabled={isRunning}
                    >
                      <SelectTrigger className="w-28" disabled={isRunning}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">$ (fixed)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-24"
                      min={1}
                      max={positionSizing.type === "percentage" ? 100 : undefined}
                      value={positionSizing.value}
                      onChange={(e) =>
                        setPositionSizing((p) => ({
                          ...p,
                          value: Number(e.target.value)
                        }))
                      }
                      disabled={isRunning}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Amount to invest per trade (1% = $10 per trade with $1000 capital)
                  </p>
                </div>
              </div>

              {/* LADDERS */}
              <Accordion type="multiple" className="w-full">
                {/* TP accordion */}
                <AccordionItem value="tp">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <AccordionTrigger className="flex-1 text-left">
                      Take‑profit ladder
                    </AccordionTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTakeProfits([])}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      disabled={isRunning}
                    >
                      Clear all
                    </Button>
                  </div>
                  <AccordionContent className="space-y-4">
                    {takeProfits.map((lvl, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Input
                          type="number"
                          step={1}
                          value={lvl.percentage}
                          onChange={(e) =>
                            handleTPChange(idx, "percentage", Number(e.target.value))
                          }
                          className="w-24"
                          disabled={isRunning}
                        />
                        <span>% gain → sell</span>
                        <Input
                          type="number"
                          step={1}
                          value={lvl.sellPercentage}
                          onChange={(e) =>
                            handleTPChange(idx, "sellPercentage", Number(e.target.value))
                          }
                          className="w-24"
                          disabled={isRunning}
                        />
                        <span>% tokens</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setTakeProfits((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          disabled={isRunning}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTakeProfits((prev) => [
                          ...prev,
                          { percentage: 0, sellPercentage: 0 }
                        ])
                      }
                      disabled={isRunning}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add level
                    </Button>
                  </AccordionContent>
                </AccordionItem>

                {/* SL accordion */}
                <AccordionItem value="sl">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <AccordionTrigger className="flex-1 text-left">
                      Stop‑loss ladder
                    </AccordionTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStopLosses([])}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      disabled={isRunning}
                    >
                      Clear all
                    </Button>
                  </div>
                  <AccordionContent className="space-y-4">
                    {stopLosses.map((lvl, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Input
                          type="number"
                          step={1}
                          value={lvl.percentage}
                          onChange={(e) =>
                            handleSLChange(idx, "percentage", Number(e.target.value))
                          }
                          className="w-24"
                          disabled={isRunning}
                        />
                        <span>% drop → sell</span>
                        <Input
                          type="number"
                          step={1}
                          value={lvl.sellPercentage}
                          onChange={(e) =>
                            handleSLChange(idx, "sellPercentage", Number(e.target.value))
                          }
                          className="w-24"
                          disabled={isRunning}
                        />
                        <span>% tokens</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setStopLosses((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          disabled={isRunning}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStopLosses((prev) => [
                          ...prev,
                          { percentage: 0, sellPercentage: 0 }
                        ])
                      }
                      disabled={isRunning}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add level
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESULTS TAB */}
        <TabsContent value="results">
          {chartData.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Individual positions</CardTitle>
                <CardDescription>Equity curve per token</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      opacity={0.15} 
                      stroke="#374151"
                    />
                    <XAxis
                      dataKey="date"
                      height={80}
                      angle={-45}
                      dy={15}
                      interval="preserveStartEnd"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={{ stroke: '#374151' }}
                    />
                    <YAxis 
                      tickFormatter={(v) => `$${formatLargeNumber(v)}`}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={{ stroke: '#374151' }}
                    />
                    <Tooltip 
                      formatter={(v: number) => [`$${formatLargeNumber(v)}`, 'Value']}
                      labelFormatter={(label) => formatChartDate(label)}
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                    />

                    {/* Use allTradeKeys which collects keys from ALL rows */}
                    {allTradeKeys.map((tradeId, idx) => {
                        // Extract token address and trade number for display
                        const [token, tradeNum] = tradeId.split('_');
                        const displayName = `${token.slice(0, 8)}... (Trade ${parseInt(tradeNum) + 1})`;
                        const isVisible = visibleTokens.size === 0 || visibleTokens.has(tradeId);
                        
                        return (
                          <Line
                            key={tradeId}
                            type="monotone"
                            dataKey={tradeId}
                            name={displayName}
                            stroke={`hsl(${idx * 57},70%,60%)`}
                            strokeOpacity={isVisible ? 1 : 0.3}
                            dot={false}
                            strokeWidth={isVisible ? 2 : 1}
                            activeDot={{ r: 4, strokeWidth: 2 }}
                          />
                        );
                      })}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Advanced Legend */}
          {chartData.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Token Legend</CardTitle>
                <CardDescription>Click to show/hide tokens on the chart</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Pagination Controls */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search tokens..."
                      value={legendSearch}
                      onChange={(e) => {
                        setLegendSearch(e.target.value);
                        setLegendPage(0);
                      }}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {Math.min(legendPage * 5 + 1, allTradeKeys.length)} - {Math.min((legendPage + 1) * 5, allTradeKeys.length)} of {allTradeKeys.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLegendPage(Math.max(0, legendPage - 1))}
                      disabled={legendPage === 0}
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLegendPage(legendPage + 1)}
                      disabled={(legendPage + 1) * 5 >= allTradeKeys.length}
                    >
                      →
                    </Button>
                  </div>
                </div>

                {/* Legend Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {allTradeKeys
                    .filter((tradeId) => {
                      if (!legendSearch) return true;
                      const [token] = tradeId.split('_');
                      return token.toLowerCase().includes(legendSearch.toLowerCase());
                    })
                    .slice(legendPage * 5, (legendPage + 1) * 5)
                    .map((tradeId, idx) => {
                      const [token, tradeNum] = tradeId.split('_');
                      const displayName = `${token.slice(0, 8)}... (Trade ${parseInt(tradeNum) + 1})`;
                      const isVisible = visibleTokens.size === 0 || visibleTokens.has(tradeId);
                      const color = `hsl(${(legendPage * 5 + idx) * 57},70%,60%)`;
                      
                      return (
                        <div
                          key={tradeId}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800 ${
                            isVisible ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700 opacity-50'
                          }`}
                          onClick={() => handleLegendClick({ dataKey: tradeId })}
                        >
                          <div
                            className="w-4 h-4 rounded-full border-2"
                            style={{
                              backgroundColor: isVisible ? color : 'transparent',
                              borderColor: color
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{token}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isVisible ? '✓' : '○'}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleTokens(new Set())}
                  >
                    Show All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleTokens(new Set(allTradeKeys))}
                  >
                    Hide All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVisibleTokens(new Set(allTradeKeys.slice(0, 5)));
                    }}
                  >
                    Show Top 5
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {cumChartData.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Cumulative portfolio</CardTitle>
                <CardDescription>Total account value</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumChartData}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      opacity={0.15} 
                      stroke="#374151"
                    />
                    <XAxis
                      dataKey="date"
                      height={80}
                      angle={-45}
                      dy={15}
                      interval="preserveStartEnd"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={{ stroke: '#374151' }}
                    />
                    <YAxis 
                      tickFormatter={(v) => `$${formatLargeNumber(v)}`}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={{ stroke: '#374151' }}
                    />
                    <Tooltip 
                      formatter={(v: number) => [`$${formatLargeNumber(v)}`, 'Portfolio Value']}
                      labelFormatter={(label) => formatChartDate(label)}
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#14b8a6"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#14b8a6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {summary && (
            <Card>
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
                <CardDescription>
                  Account-level metrics (includes realized + unrealized PnL)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Main Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Account ROI</p>
                    <p className={`text-2xl font-bold ${summary.accountROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.accountROI >= 0 ? '+' : ''}{summary.accountROI.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      (Final - Start) / Start
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Final Equity</p>
                    <p className="text-xl font-semibold">
                      ${formatLargeNumber(summary.finalPortfolioValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Start: ${formatLargeNumber(summary.startingCapital)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total PnL</p>
                    <p className={`text-xl font-semibold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${formatLargeNumber(summary.totalProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-xl font-semibold">
                      {(summary.winRate * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      (valid trades only)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Trade ROI</p>
                    <p className={`text-xl font-semibold ${summary.avgTradeROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.avgTradeROI >= 0 ? '+' : ''}{summary.avgTradeROI.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      (per trade, not account)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valid Trades</p>
                    <p className="text-xl font-semibold">
                      {summary.validTrades}
                      <span className="text-sm font-normal text-muted-foreground"> / {summary.totalTrades}</span>
                    </p>
                    {summary.invalidTrades > 0 && (
                      <p className="text-xs text-yellow-500">
                        {summary.invalidTrades} excluded
                      </p>
                    )}
                  </div>
                </div>

                {/* PnL Breakdown Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Realized PnL</p>
                    <p className={`text-lg font-semibold ${summary.realizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${formatLargeNumber(summary.realizedProfit)}
                    </p>
                    <p className="text-xs text-muted-foreground">from sells</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unrealized PnL</p>
                    <p className={`text-lg font-semibold ${summary.unrealizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${formatLargeNumber(summary.unrealizedProfit)}
                    </p>
                    <p className="text-xs text-muted-foreground">mark-to-market</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Profit/Trade</p>
                    <p className={`text-lg font-semibold ${summary.avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${formatLargeNumber(summary.avgProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className={`text-lg font-semibold ${summary.isBankrupt ? 'text-red-600' : 'text-green-600'}`}>
                      {summary.isBankrupt ? "Bankrupt" : "Solvent"}
                    </p>
                  </div>
                </div>

                {/* Advanced Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-center pt-4 mt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Max Drawdown</p>
                    <p className={`text-lg font-semibold ${summary.maxDrawdown > 20 ? 'text-red-600' : summary.maxDrawdown > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                      -{summary.maxDrawdown.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">peak to trough</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Profit Factor</p>
                    <p className={`text-lg font-semibold ${summary.profitFactor >= 1.5 ? 'text-green-600' : summary.profitFactor >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">gross P / gross L</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win/Loss</p>
                    <p className="text-lg font-semibold">
                      <span className="text-green-600">{summary.winningTrades}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-red-600">{summary.losingTrades}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">trades</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Win / Loss</p>
                    <p className="text-lg font-semibold">
                      <span className="text-green-600">${formatLargeNumber(summary.avgWin)}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-red-600">${formatLargeNumber(Math.abs(summary.avgLoss))}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Risk/Reward</p>
                    <p className={`text-lg font-semibold ${summary.riskRewardRatio >= 2 ? 'text-green-600' : summary.riskRewardRatio >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {summary.riskRewardRatio === Infinity ? '∞' : summary.riskRewardRatio.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">avg win / avg loss</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expectancy</p>
                    <p className={`text-lg font-semibold ${summary.expectancy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${formatLargeNumber(summary.expectancy)}
                    </p>
                    <p className="text-xs text-muted-foreground">per trade</p>
                  </div>
                </div>

                {/* Best/Worst Trades Row */}
                <div className="grid grid-cols-2 gap-4 text-center pt-4 mt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Largest Win</p>
                    <p className="text-lg font-semibold text-green-600">
                      +${formatLargeNumber(summary.largestWin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Largest Loss</p>
                    <p className="text-lg font-semibold text-red-600">
                      -${formatLargeNumber(Math.abs(summary.largestLoss))}
                    </p>
                  </div>
                </div>

                {/* Timing and Controls Row */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Backtest completed in </span>
                      <span className="font-semibold">
                        {summary.durationMs < 1000
                          ? `${summary.durationMs.toFixed(0)}ms`
                          : summary.durationMs < 60000
                          ? `${(summary.durationMs / 1000).toFixed(2)}s`
                          : `${Math.floor(summary.durationMs / 60000)}m ${((summary.durationMs % 60000) / 1000).toFixed(0)}s`
                        }
                      </span>
                    </div>
                  </div>
                  {summary.invalidTrades > 0 && (
                    <div className="flex items-center gap-2">
                      <label htmlFor="show-invalid" className="text-sm text-muted-foreground cursor-pointer">
                        Show failed trades ({summary.invalidTrades})
                      </label>
                      <input
                        type="checkbox"
                        id="show-invalid"
                        checked={showInvalidTrades}
                        onChange={(e) => setShowInvalidTrades(e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-Caller Performance Breakdown - only show if multiple callers */}
          {callerStats.length > 1 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Per-Caller Performance</CardTitle>
                <CardDescription>
                  Performance breakdown by caller. Sorted by total PnL.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Caller</th>
                        <th className="text-right py-2">Trades</th>
                        <th className="text-right py-2">Win Rate</th>
                        <th className="text-right py-2">Total PnL</th>
                        <th className="text-right py-2">Avg ROI</th>
                        <th className="text-right py-2">Profit Factor</th>
                        <th className="text-right py-2">Avg Win</th>
                        <th className="text-right py-2">Avg Loss</th>
                        <th className="text-right py-2">Best Trade</th>
                        <th className="text-right py-2">Worst Trade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callerStats.map((cs, index) => (
                        <tr key={cs.caller} className="border-b hover:bg-muted/50">
                          <td className="py-2 font-medium">{cs.caller}</td>
                          <td className="text-right py-2">
                            <span className="text-green-600">{cs.winningTrades}</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-red-600">{cs.losingTrades}</span>
                            <span className="text-muted-foreground ml-1">({cs.validTrades})</span>
                          </td>
                          <td className={`text-right py-2 font-semibold ${cs.winRate >= 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                            {(cs.winRate * 100).toFixed(0)}%
                          </td>
                          <td className={`text-right py-2 font-semibold ${cs.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${formatLargeNumber(cs.totalPnL)}
                          </td>
                          <td className={`text-right py-2 ${cs.avgTradeROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {cs.avgTradeROI >= 0 ? '+' : ''}{cs.avgTradeROI.toFixed(1)}%
                          </td>
                          <td className={`text-right py-2 ${cs.profitFactor >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                            {cs.profitFactor === Infinity ? '∞' : cs.profitFactor.toFixed(2)}
                          </td>
                          <td className="text-right py-2 text-green-600">
                            ${formatLargeNumber(cs.avgWin)}
                          </td>
                          <td className="text-right py-2 text-red-600">
                            ${formatLargeNumber(Math.abs(cs.avgLoss))}
                          </td>
                          <td className="text-right py-2 text-green-600">
                            +${formatLargeNumber(cs.largestWin)}
                          </td>
                          <td className="text-right py-2 text-red-600">
                            -${formatLargeNumber(Math.abs(cs.largestLoss))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {tokenBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trade-by-Trade Breakdown</CardTitle>
                <CardDescription>
                  Individual trade performance. Trade ROI = PnL / Capital per trade.
                  {!showInvalidTrades && tokenBreakdown.filter(t => t.is_valid === false || t.error).length > 0 && (
                    <span className="text-muted-foreground ml-2">
                      ({tokenBreakdown.filter(t => t.is_valid === false || t.error).length} failed trades hidden)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Token</th>
                        <th className="text-right py-2">Time Called</th>
                        <th className="text-right py-2">Entry</th>
                        <th className="text-right py-2">Current</th>
                        <th className="text-right py-2">ATH</th>
                        <th className="text-right py-2">Total PnL</th>
                        <th className="text-right py-2">Realized</th>
                        <th className="text-right py-2">Unrealized</th>
                        <th className="text-right py-2">Position Value</th>
                        <th className="text-right py-2">Trade ROI</th>
                        {showInvalidTrades && <th className="text-right py-2">Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {tokenBreakdown
                        .filter(token => {
                          // Filter based on toggle: if showInvalidTrades is false, hide invalid trades
                          const isInvalid = token.is_valid === false || !!token.error;
                          return showInvalidTrades || !isInvalid;
                        })
                        .map((token, index) => {
                          const isInvalid = token.is_valid === false || !!token.error;
                          const tradeROI = token.trade_roi || token.roi_to_date || 0;

                          return (
                            <tr
                              key={token.trade_id || `${token.token}-${index}`}
                              className={`border-b hover:bg-muted/50 ${isInvalid ? 'bg-yellow-50 dark:bg-yellow-900/20 opacity-60' : ''}`}
                            >
                              <td className="py-2">
                                <a
                                  href={`/token-analysis?token=${encodeURIComponent(token.token)}`}
                                  className={`font-mono text-xs ${isInvalid ? 'text-yellow-600' : 'text-blue-600'} hover:underline cursor-pointer`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {token.token.slice(0, 8)}...
                                </a>
                              </td>
                              <td className="text-right py-2 text-xs">
                                {token.time_called ? new Date(token.time_called).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false
                                }) : 'N/A'}
                              </td>
                              <td className="text-right py-2">{isInvalid ? 'N/A' : `$${token.entry_price.toFixed(6)}`}</td>
                              <td className="text-right py-2">{isInvalid ? 'N/A' : `$${token.final_price.toFixed(6)}`}</td>
                              <td className="text-right py-2 text-muted-foreground text-xs">
                                {isInvalid ? 'N/A' : `$${token.ath_price.toFixed(6)}`}
                              </td>
                              <td className={`text-right py-2 font-semibold ${isInvalid ? 'text-muted-foreground' : token.total_pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {isInvalid ? 'N/A' : `$${token.total_pnl.toFixed(2)}`}
                              </td>
                              <td className={`text-right py-2 ${isInvalid ? 'text-muted-foreground' : token.realized_pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {isInvalid ? 'N/A' : `$${token.realized_pnl.toFixed(2)}`}
                              </td>
                              <td className={`text-right py-2 ${isInvalid ? 'text-muted-foreground' : token.unrealized_pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {isInvalid ? 'N/A' : `$${token.unrealized_pnl.toFixed(2)}`}
                              </td>
                              <td className="text-right py-2 font-mono text-xs">
                                {isInvalid ? 'N/A' : `$${(token.final_value || (token.coins_left * token.final_price)).toFixed(2)}`}
                              </td>
                              <td className={`text-right py-2 font-semibold ${isInvalid ? 'text-muted-foreground' : tradeROI > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {isInvalid ? 'N/A' : `${tradeROI > 0 ? '+' : ''}${tradeROI.toFixed(2)}%`}
                              </td>
                              {showInvalidTrades && (
                                <td className="text-right py-2">
                                  {isInvalid ? (
                                    <span className="text-xs text-yellow-600" title={token.error || token.validation_errors?.join(', ')}>
                                      ⚠️ {token.error?.slice(0, 20) || 'Invalid'}...
                                    </span>
                                  ) : (
                                    <span className="text-xs text-green-600">✓ Valid</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
