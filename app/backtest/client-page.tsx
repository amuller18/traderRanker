"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Plus, Minus, RefreshCw, Play } from "lucide-react";
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
  entry_price: number;
  final_price: number;
  ath_price: number;
  ath_percentage: number;
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  coins_left: number;
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
  const [selectedCaller, setSelectedCaller] = useState("all");
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

  /* ─────────────────────── memo ──────────────────────── */
  const callers = useMemo(
    () => Array.from(new Set(initialTrades.map((t) => t.caller))).filter(Boolean),
    [initialTrades]
  );

  const filteredTrades = useMemo(
    () => {
      let trades = selectedCaller === "all"
        ? initialTrades
        : initialTrades.filter((t) => t.caller === selectedCaller);
      
      // Limit to max backtests
      if (maxBacktests > 0 && trades.length > maxBacktests) {
        trades = trades.slice(0, maxBacktests);
      }
      
      return trades;
    },
    [initialTrades, selectedCaller, maxBacktests]
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

    const payload = {
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
      // First get the detailed breakdown
      const breakdownRes = await fetch(`${pythonApiUrl}/api/simulate/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!breakdownRes.ok) throw new Error(`Breakdown API ${breakdownRes.status}`);
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

      // Then get the simulation data for charts
      const res = await fetch(`${pythonApiUrl}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const sims: SimulationResult[] = await res.json();

      /* ─ compute charts & stats ─*/
      const rows: any[] = [];
      let totalProfit = 0;
      let winningTrades = 0;

      // Process each simulation result
      console.log(`Processing ${sims.length} simulation results`);
      sims.forEach((sim, simIndex) => {
        console.log(`Processing simulation ${simIndex + 1}/${sims.length}: ${sim.token}`);
        if (!sim.ledger?.length) {
          console.log(`No ledger data for ${sim.token}`);
          return;
        }
        
        console.log(`Token ${sim.token}: ${sim.ledger.length} ledger points`);
        
        // Add each ledger point to the chart data
        sim.ledger.forEach((pt, idx) => {
          if (!rows[idx]) rows[idx] = { ts: pt.ts };
          // Store the total equity (value + realized) for this token at this timestamp
          rows[idx][sim.token] = pt.value + pt.realized;
        });

        // Calculate profit for this token
        const tokenProfit = (sim.realized_profit || 0) + (sim.unrealized_profit || 0);
        totalProfit += tokenProfit;
        if (tokenProfit > 0) winningTrades++;
        console.log(`Token ${sim.token}: Profit = $${tokenProfit.toFixed(2)}`);
      });

      // Add dates to rows
      rows.forEach((r) => (r.date = formatDate(r.ts)));

      // Calculate cumulative portfolio value
      const cumulative: any[] = [];
      let runningPortfolio = initialCapital;
      
      rows.forEach((row) => {
        // Get all token keys (excluding ts and date)
        const tokenKeys = Object.keys(row).filter(
          (k) => k !== 'ts' && k !== 'date' && k.length > 30
        );
        
        // Calculate the total value of all positions at this timestamp
        let totalValue = 0;
        tokenKeys.forEach(tokenKey => {
          totalValue += row[tokenKey] || 0;
        });
        
        // Update running portfolio
        runningPortfolio = totalValue;
        cumulative.push({ ...row, cumulative: runningPortfolio });
      });

      console.log(`Chart data rows: ${rows.length}`);
      console.log(`Sample row keys: ${Object.keys(rows[0] || {}).join(', ')}`);
      console.log(`Token keys in chart data: ${Object.keys(rows[0] || {}).filter(k => k !== 'ts' && k !== 'date' && k.length > 30).join(', ')}`);
      
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
          • {filteredTrades.length} trades selected
        </span>
        <span className="text-muted-foreground">
          • Position size: ${positionSizing.type === "percentage" ? ((initialCapital * positionSizing.value) / 100).toFixed(2) : positionSizing.value.toFixed(2)} per trade
        </span>
        <Button
          className="ml-auto flex items-center gap-2"
          onClick={runBacktest}
          disabled={
            apiStatus !== "connected" || isRunning || filteredTrades.length === 0
          }
        >
          {isRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isRunning ? "Running…" : "Run Backtest"}
        </Button>
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
                      {callers.map((c) => (
                        <SelectItem key={c} value={c}>
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
                  <AccordionTrigger>Take‑profit ladder</AccordionTrigger>
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
                  <AccordionTrigger>Stop‑loss ladder</AccordionTrigger>
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
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis
                      dataKey="date"
                      height={60}
                      angle={-45}
                      dy={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis tickFormatter={(v) => `$${formatLargeNumber(v)}`} />
                    <Tooltip formatter={(v: number) => `$${formatLargeNumber(v)}`} />
                    <Legend height={36} />
                    {Object.keys(chartData[0])
                      .filter((k) => k !== 'ts' && k !== 'date' && k.length > 30)
                      .map((token, idx) => (
                        <Line
                          key={token}
                          type="monotone"
                          dataKey={token}
                          stroke={`hsl(${idx * 57},70%,60%)`}
                          dot={false}
                          strokeWidth={2}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {cumChartData.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Cumulative portfolio</CardTitle>
                <CardDescription>Total account value</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis
                      dataKey="date"
                      height={60}
                      angle={-45}
                      dy={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis tickFormatter={(v) => `$${formatLargeNumber(v)}`} />
                    <Tooltip formatter={(v: number) => `$${formatLargeNumber(v)}`} />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#14b8a6"
                      dot={false}
                      strokeWidth={3}
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
                        <th className="text-right py-2">Entry Price</th>
                        <th className="text-right py-2">Final Price</th>
                        <th className="text-right py-2">ATH Price</th>
                        <th className="text-right py-2">ATH %</th>
                        <th className="text-right py-2">Total PnL</th>
                        <th className="text-right py-2">Realized</th>
                        <th className="text-right py-2">Unrealized</th>
                        <th className="text-right py-2">Coins Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenBreakdown.map((token) => (
                        <tr key={token.token} className="border-b hover:bg-muted/50">
                          <td className="py-2 font-mono text-xs">{token.token.slice(0, 8)}...</td>
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
                          <td className="text-right py-2">{token.coins_left.toFixed(6)}</td>
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
