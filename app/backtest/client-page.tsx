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
const DEFAULT_TIMEFRAME = 15; // sends `timeframe_minutes: 15`

// Timeframe options for manual selection
const TIMEFRAME_OPTIONS = [
  { value: "auto", label: "Auto (Recommended)" },
  { value: "1", label: "1 Minute" },
  { value: "3", label: "3 Minutes" },
  { value: "5", label: "5 Minutes" },
  { value: "15", label: "15 Minutes" },
  { value: "30", label: "30 Minutes" },
  { value: "60", label: "1 Hour" },
  { value: "240", label: "4 Hours" },
  { value: "480", label: "8 Hours" },
  { value: "1440", label: "1 Day" },
];

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
  final_price: number;
  ath_price: number;
  ath_percentage: number;
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  coins_left: number;
  max_drawdown: number;
  roi_to_date: number;
  tps_hit: number[];
  sls_hit: number[];
  error?: string;
}
interface SummaryStats {
  totalProfit: number;
  winRate: number;
  avgProfit: number;
  finalPortfolioValue: number;
  isBankrupt: boolean;
  totalTrades: number;
}
interface BacktestModernPageProps {
  initialTrades: Trade[];
}

/* ---------------------------------------------------------------------
 * HELPERS
 * -------------------------------------------------------------------*/
const fmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2
});
const formatLargeNumber = (n: number) => fmt.format(n);

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
  const [timeframe, setTimeframe] = useState<string>("auto");
  const [useAutoTimeframe, setUseAutoTimeframe] = useState<boolean>(true);
  const [selectedCaller, setSelectedCaller] = useState("all");
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
  const [legendSearch, setLegendSearch] = useState<string>("");
  const [legendPage, setLegendPage] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [cumChartData, setCumChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [tokenBreakdown, setTokenBreakdown] = useState<TokenBreakdown[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("settings"); // Track active tab
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

    const uniqueTokens = Array.from(new Set(filteredTrades.map((t) => t.ca)));
    console.log(`Unique tokens to simulate: ${uniqueTokens.length}`);
    console.log(`Tokens: ${uniqueTokens.slice(0, 5).join(', ')}${uniqueTokens.length > 5 ? '...' : ''}`);

    // Calculate position size per trade (1% of capital per trade)
    const positionSizePerTrade = positionSizing.type === "percentage"
      ? (initialCapital * positionSizing.value) / 100
      : positionSizing.value;

    // Create trade-based payload with individual dates
    const tradesPayload = {
      trades: filteredTrades.map(trade => ({
        token: trade.ca,
        date_called: trade.date_called
      })),
      amount_usd: positionSizePerTrade, // Use position size per trade, not total capital
      timeframe_minutes: timeframe === "auto" ? DEFAULT_TIMEFRAME : parseInt(timeframe),
      use_auto_timeframe: timeframe === "auto",
      tp: ladderToString(takeProfits),
      sl: ladderToString(stopLosses)
    } as const;

    // Keep the old payload for the chart simulation
    const chartPayload = {
      tokens: uniqueTokens,
      amount_usd: positionSizePerTrade, // Use position size per trade, not total capital
      start_unix: 0,
      end_unix: 0,
      days_back: DEFAULT_DAYS_BACK,
      timeframe_minutes: DEFAULT_TIMEFRAME,
      tp: ladderToString(takeProfits),
      sl: ladderToString(stopLosses)
    } as const;

    try {
      // Debug: Log the payload being sent
      console.log("Sending trades payload:", JSON.stringify(tradesPayload, null, 2));

      // First get the detailed breakdown using trade-based endpoint
      const breakdownRes = await fetch(`${pythonApiUrl}/api/simulate/breakdown/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradesPayload)
      });
      if (!breakdownRes.ok) {
        const errorText = await breakdownRes.text();
        console.error("Breakdown API error:", errorText);
        throw new Error(`Breakdown API ${breakdownRes.status}: ${errorText}`);
      }
      const breakdowns: TokenBreakdown[] = await breakdownRes.json();
      
      // Debug: Log the breakdown data
      console.log("Token breakdown data received:", breakdowns);
      breakdowns.forEach((breakdown, index) => {
        if (!breakdown.error) {
          console.log(`Token ${index + 1}: ${breakdown.token.slice(0, 8)}...`);
          console.log(`  Entry: $${breakdown.entry_price}, Final: $${breakdown.final_price}, ATH: $${breakdown.ath_price}`);
          console.log(`  Total PnL: $${breakdown.total_pnl}, Realized: $${breakdown.realized_pnl}, Unrealized: $${breakdown.unrealized_pnl}`);
          console.log(`  Coins left: ${breakdown.coins_left}`);
        } else {
          console.log(`Token ${index + 1}: ${breakdown.token.slice(0, 8)}... - ERROR: ${breakdown.error}`);
        }
      });
      
      setTokenBreakdown(breakdowns);

      // Calculate summary stats from breakdown data (more accurate)
      let totalProfit = 0;
      let winningTrades = 0;
      
      breakdowns.forEach((breakdown) => {
        if (!breakdown.error) {
          const tokenProfit = breakdown.total_pnl;
          totalProfit += tokenProfit;
          if (tokenProfit > 0) winningTrades++;
          console.log(`Token ${breakdown.token}: Profit = $${tokenProfit.toFixed(2)}`);
        }
      });

      // Then get the simulation data for charts using trade-based endpoint
      const res = await fetch(`${pythonApiUrl}/api/simulate/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradesPayload)
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const sims: SimulationResult[] = await res.json();

      /* ─ compute charts & stats ─*/
      const rows: any[] = [];

      // Process each simulation result and create individual token charts
      console.log(`Processing ${sims.length} simulation results`);
      const allTimestamps = new Set<number>();
      
      // Create a mapping of unique identifiers for each trade
      const tradeIdentifiers: string[] = [];
      
      sims.forEach((sim, simIndex) => {
        console.log(`Processing simulation ${simIndex + 1}/${sims.length}: ${sim.token}`);
        if (!sim.ledger?.length) {
          console.log(`No ledger data for ${sim.token}`);
          return;
        }
        
        console.log(`Token ${sim.token}: ${sim.ledger.length} ledger points`);
        
        // Create unique identifier for this trade
        const tradeId = `${sim.token}_${simIndex}`;
        tradeIdentifiers.push(tradeId);
        
        // Collect all timestamps from all trades
        sim.ledger.forEach((pt) => {
          allTimestamps.add(pt.ts);
        });
      });

      // Sort timestamps and create chart rows
      const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
      
      sortedTimestamps.forEach((ts) => {
        const row: any = { ts, date: formatDate(ts) };
        
        // Add each token's value at this timestamp using unique identifiers
        sims.forEach((sim, simIndex) => {
          if (sim.ledger) {
            // Find the closest ledger point to this timestamp
            const closestPoint = sim.ledger.reduce((closest, current) => {
              return Math.abs(current.ts - ts) < Math.abs(closest.ts - ts) ? current : closest;
            });
            
            // Only add if the point is within a reasonable time range (e.g., 1 hour)
            if (Math.abs(closestPoint.ts - ts) <= 3600) {
              const tradeId = tradeIdentifiers[simIndex];
              row[tradeId] = closestPoint.value + closestPoint.realized;
            }
          }
        });
        
        rows.push(row);
      });

      // Calculate cumulative portfolio value (including cash not in positions)
      const cumulative: any[] = [];
      let runningPortfolio = initialCapital;
      
      rows.forEach((row) => {
        // Get all trade keys (excluding ts and date)
        const tradeKeys = Object.keys(row).filter(
          (k) => k !== 'ts' && k !== 'date' && k.includes('_')
        );
        
        // Calculate the total value of all positions at this timestamp
        let totalValue = 0;
        tradeKeys.forEach(tradeKey => {
          totalValue += row[tradeKey] || 0;
        });
        
        // Calculate cash not in positions (initial capital minus what's invested)
        const cashNotInPositions = initialCapital - (positionSizing.type === "percentage" ? 
          (initialCapital * positionSizing.value / 100) * filteredTrades.length : 
          positionSizing.value * filteredTrades.length);
        
        // The running portfolio should be the current total value of all positions
        // plus any cash that hasn't been invested yet
        runningPortfolio = totalValue + cashNotInPositions;
        cumulative.push({ ...row, cumulative: runningPortfolio });
      });

      console.log(`Chart data rows: ${rows.length}`);
      console.log(`Sample row keys: ${Object.keys(rows[0] || {}).join(', ')}`);
      console.log(`Trade keys in chart data: ${Object.keys(rows[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.includes('_')).join(', ')}`);
      
      setChartData(rows);
      setCumChartData(cumulative);

      const finalPortfolioValue = runningPortfolio;
      const winRate = filteredTrades.length > 0 ? winningTrades / filteredTrades.length : 0;
      
      setSummary({
        totalProfit,
        avgProfit: filteredTrades.length > 0 ? totalProfit / filteredTrades.length : 0,
        winRate,
        finalPortfolioValue,
        isBankrupt: finalPortfolioValue <= 0,
        totalTrades: filteredTrades.length
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
          • Timeframe: {timeframe === "auto" ? "Auto" : TIMEFRAME_OPTIONS.find(opt => opt.value === timeframe)?.label || timeframe}
        </span>
        {summary && (
          <span className="text-muted-foreground">
            • ROI: {((summary.totalProfit / initialCapital) * 100).toFixed(1)}%
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
                  >
                    <SelectTrigger id="caller">
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
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit number of trades to backtest (0 = no limit)
                  </p>
                </div>

                {/* Timeframe */}
                <div className="space-y-2">
                  <Label htmlFor="timeframe">Timeframe</Label>
                  <Select
                    value={timeframe}
                    onValueChange={setTimeframe}
                  >
                    <SelectTrigger id="timeframe">
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAME_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {timeframe === "auto" 
                      ? "Auto-selects optimal timeframe based on trade duration" 
                      : "Manual timeframe selection"}
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
                    >
                      <SelectTrigger className="w-28">
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

                    {Object.keys(chartData[0] || {})
                      .filter((k) => k !== 'ts' && k !== 'date' && k.includes('_'))
                      .map((tradeId, idx) => {
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
                      {Math.min(legendPage * 5 + 1, Object.keys(chartData[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.includes('_')).length)} - {Math.min((legendPage + 1) * 5, Object.keys(chartData[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.includes('_')).length)} of {Object.keys(chartData[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.includes('_')).length}
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
                      disabled={(legendPage + 1) * 5 >= Object.keys(chartData[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.includes('_')).length}
                    >
                      →
                    </Button>
                  </div>
                </div>

                {/* Legend Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {Object.keys(chartData[0] || {})
                    .filter((k) => k !== 'ts' && k !== 'date' && k.includes('_'))
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
                    onClick={() => setVisibleTokens(new Set(Object.keys(chartData[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.includes('_'))))}
                  >
                    Hide All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allTokens = Object.keys(chartData[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.includes('_'));
                      setVisibleTokens(new Set(allTokens.slice(0, 5)));
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
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Profit</p>
                  <p className="text-xl font-semibold">
                    ${formatLargeNumber(summary.totalProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Profit / Trade</p>
                  <p className="text-xl font-semibold">
                    ${formatLargeNumber(summary.avgProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Final Equity</p>
                  <p className="text-xl font-semibold">
                    ${formatLargeNumber(summary.finalPortfolioValue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trades</p>
                  <p className="text-xl font-semibold">{summary.totalTrades}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Win‑rate</p>
                  <p className="text-xl font-semibold">
                    {(summary.winRate * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bankrupt?</p>
                  <p className="text-xl font-semibold">
                    {summary.isBankrupt ? "Yes" : "No"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {tokenBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Token-by-Token Breakdown</CardTitle>
                <CardDescription>Detailed analysis of each token's performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Token</th>
                        <th className="text-right py-2">Time Called</th>
                        <th className="text-right py-2">Entry Price</th>
                        <th className="text-right py-2">Final Price</th>
                        <th className="text-right py-2">ATH Price</th>
                        <th className="text-right py-2">ATH %</th>
                        <th className="text-right py-2">Total PnL</th>
                        <th className="text-right py-2">Realized</th>
                        <th className="text-right py-2">Unrealized</th>
                        <th className="text-right py-2">Remaining USD</th>
                        <th className="text-right py-2">Max Drawdown</th>
                        <th className="text-right py-2">ROI to Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenBreakdown.map((token) => (
                        <tr key={token.trade_id} className="border-b hover:bg-muted/50">
                          <td className="py-2">
                            <a
                              href={`/token-analysis?token=${encodeURIComponent(token.token)}`}
                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {token.token.slice(0, 8)}...
                            </a>
                          </td>
                          <td className="text-right py-2 text-xs">
                            {new Date(token.time_called).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false
                            })}
                          </td>
                          <td className="text-right py-2">${token.entry_price.toFixed(6)}</td>
                          <td className="text-right py-2">${token.final_price.toFixed(6)}</td>
                          <td className="text-right py-2">${token.ath_price.toFixed(6)}</td>
                          <td className={`text-right py-2 ${token.ath_percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {token.ath_percentage > 0 ? '+' : ''}{token.ath_percentage.toFixed(2)}%
                          </td>
                          <td className={`text-right py-2 font-semibold ${token.total_pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${token.total_pnl.toFixed(2)}
                          </td>
                          <td className={`text-right py-2 ${token.realized_pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${token.realized_pnl.toFixed(2)}
                          </td>
                          <td className={`text-right py-2 ${token.unrealized_pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${token.unrealized_pnl.toFixed(2)}
                          </td>
                          <td className="text-right py-2 font-mono text-xs">${(token.coins_left * token.final_price).toFixed(2)}</td>
                          <td className={`text-right py-2 ${token.max_drawdown > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {token.max_drawdown.toFixed(2)}%
                          </td>
                          <td className={`text-right py-2 font-semibold ${token.roi_to_date > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {token.roi_to_date > 0 ? '+' : ''}{token.roi_to_date.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
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
