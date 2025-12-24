import { scanTable, queryTable, putItem, deleteItem, type DynamoDBItem } from "./dynamo-minimal"

// Type definitions for our data
export interface TraderStats {
  caller: string
  n_calls: number
  first_call_date: string
  last_call_date: string
  mean_ath_roi_pct: number
  median_ath_roi_pct: number
  std_ath_roi_pct: number
  mean_atl_roi_pct: number
  best_roi_pct: number
  worst_roi_pct: number
  win_rate_pct: number
  win_threshold_pct: number
  win_rate_mc_p5: number
  win_rate_mc_p50: number
  win_rate_mc_p95: number
  hit_2x_pct: number
  hit_3x_pct: number
  hit_5x_pct: number
  hit_10x_pct: number
  hit_20x_pct: number
  hit_50x_pct: number
  hit_100x_pct: number
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown_pct: number
  ev: number
  ev_weighted: number
  avg_days_to_ath: number
  median_days_to_ath: number
  avg_correlation_with_others: number
  risk_score: number
  consistency_score: number
  computed_at: string
  // Deprecated fields - kept for backwards compatibility
  win_rate?: number
  total_calls?: number
  winning_calls?: number
  average_roi?: number
  micro_cap_roi?: number
  micro_cap_winrate?: number
  small_cap_roi?: number
  small_cap_winrate?: number
  mid_cap_roi?: number
  mid_cap_winrate?: number
  large_cap_roi?: number
  large_cap_winrate?: number
  mega_cap_roi?: number
  mega_cap_winrate?: number
}

export interface Trade {
  ca: string
  caller: string
  date_called: string
  high_time: string
  low_time: string
  entry_price: number
  ath_price: number
  ath_roi: number
  initial_mc: number
  current_mc: number
  high_mc: number
  low_mc: number
  high_price: number
  low_price: number
  price_change_24h: number
  volume_24h: number
  liquidity: number
  holders: number
  market_cap_rank: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  market_cap_dominance: number
  fully_diluted_valuation: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_percentage_24h: number
  price_change_percentage_7d: number
  price_change_percentage_14d: number
  price_change_percentage_30d: number
  price_change_percentage_60d: number
  price_change_percentage_200d: number
  price_change_percentage_1y: number
  market_cap_change_24h_in_currency: number
  market_cap_change_percentage_24h_in_currency: number
  total_supply: number
  max_supply: number
  circulating_supply: number
  last_updated: string
  sparkline_in_7d: {
    price: number[]
  }
  price_change_percentage_1h_in_currency: number
  price_change_percentage_24h_in_currency: number
  price_change_percentage_7d_in_currency: number
  price_change_percentage_14d_in_currency: number
  price_change_percentage_30d_in_currency: number
  price_change_percentage_60d_in_currency: number
  price_change_percentage_200d_in_currency: number
  price_change_percentage_1y_in_currency: number
  // Additional calculated properties
  roi: number
  roi_at_high: number
  roi_at_low: number
  profit_at_high: number
  profit_at_low: number
  profit: number
  is_winner: boolean
}

export interface FilterOptions {
  winRateRange: [number, number]
  totalCallsRange: [number, number]
  roiRange: [number, number]
  searchTerm?: string
}

export interface TradeFilterOptions {
  roiRange: [number, number]
  marketCapRange: [number, number]
  dateRange: [Date, Date]
  searchTerm?: string
  traderSearchTerm?: string
  timeframe?: string
}

// Mock data for fallback
import { mockTraderStats, mockTrades } from "./mock-data"

// Mock data for when database connection fails
const MOCK_TRADES: Trade[] = [
  {
    ca: "7nZG8jEaU3HFsRQ2JkUAVPQqzGMpw37V5CYtV9JdDSLf",
    caller: "Mock Trader 1",
    date_called: new Date().toISOString(),
    initial_mc: 1000000,
    current_mc: 1500000,
    high_mc: 2000000,
    low_mc: 900000,
    high_price: 0.002,
    low_price: 0.0009,
    high_time: new Date().toISOString(),
    low_time: new Date().toISOString(),
    total_supply: 1000000000,
    circulating_supply: 500000000,
    price_change_24h: 0,
    volume_24h: 0,
    liquidity: 0,
    holders: 0,
    market_cap_rank: 0,
    market_cap_change_24h: 0,
    market_cap_change_percentage_24h: 0,
    market_cap_dominance: 0,
    fully_diluted_valuation: 0,
    total_volume: 0,
    high_24h: 0,
    low_24h: 0,
    price_change_percentage_24h: 0,
    price_change_percentage_7d: 0,
    price_change_percentage_14d: 0,
    price_change_percentage_30d: 0,
    price_change_percentage_60d: 0,
    price_change_percentage_200d: 0,
    price_change_percentage_1y: 0,
    market_cap_change_24h_in_currency: 0,
    market_cap_change_percentage_24h_in_currency: 0,
    max_supply: 0,
    last_updated: "",
    sparkline_in_7d: { price: [] },
    price_change_percentage_1h_in_currency: 0,
    price_change_percentage_24h_in_currency: 0,
    price_change_percentage_7d_in_currency: 0,
    price_change_percentage_14d_in_currency: 0,
    price_change_percentage_30d_in_currency: 0,
    price_change_percentage_60d_in_currency: 0,
    price_change_percentage_200d_in_currency: 0,
    price_change_percentage_1y_in_currency: 0,
    roi: 50,
    roi_at_high: 100,
    roi_at_low: -10,
    profit_at_high: 1000000,
    profit_at_low: -100000,
    profit: 500000,
    is_winner: true
  },
  {
    ca: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    caller: "Mock Trader 2",
    date_called: new Date().toISOString(),
    initial_mc: 5000000,
    current_mc: 4000000,
    high_mc: 6000000,
    low_mc: 3500000,
    high_price: 0.006,
    low_price: 0.0035,
    high_time: new Date().toISOString(),
    low_time: new Date().toISOString(),
    total_supply: 1000000000,
    circulating_supply: 500000000,
    price_change_24h: 0,
    volume_24h: 0,
    liquidity: 0,
    holders: 0,
    market_cap_rank: 0,
    market_cap_change_24h: 0,
    market_cap_change_percentage_24h: 0,
    market_cap_dominance: 0,
    fully_diluted_valuation: 0,
    total_volume: 0,
    high_24h: 0,
    low_24h: 0,
    price_change_percentage_24h: 0,
    price_change_percentage_7d: 0,
    price_change_percentage_14d: 0,
    price_change_percentage_30d: 0,
    price_change_percentage_60d: 0,
    price_change_percentage_200d: 0,
    price_change_percentage_1y: 0,
    market_cap_change_24h_in_currency: 0,
    market_cap_change_percentage_24h_in_currency: 0,
    max_supply: 0,
    last_updated: "",
    sparkline_in_7d: { price: [] },
    price_change_percentage_1h_in_currency: 0,
    price_change_percentage_24h_in_currency: 0,
    price_change_percentage_7d_in_currency: 0,
    price_change_percentage_14d_in_currency: 0,
    price_change_percentage_30d_in_currency: 0,
    price_change_percentage_60d_in_currency: 0,
    price_change_percentage_200d_in_currency: 0,
    price_change_percentage_1y_in_currency: 0,
    roi: -20,
    roi_at_high: 20,
    roi_at_low: -30,
    profit_at_high: 1000000,
    profit_at_low: -1500000,
    profit: -1000000,
    is_winner: false
  }
]

// Helper function to safely parse numeric values
function safeParseFloat(value: any): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    try {
      return Number.parseFloat(value)
    } catch (e) {
      return 0
    }
  }
  return 0
}

function safeParseInt(value: any): number {
  if (typeof value === "number") return Math.floor(value)
  if (typeof value === "string") {
    try {
      return Number.parseInt(value, 10)
    } catch (e) {
      return 0
    }
  }
  return 0
}

// Function to convert DynamoDB item to TraderStats
function convertToTraderStats(item: DynamoDBItem): TraderStats {
  return {
    caller: String(item.caller || "Unknown"),
    n_calls: safeParseInt(item.n_calls || item.total_calls || 0),
    first_call_date: String(item.first_call_date || ""),
    last_call_date: String(item.last_call_date || ""),
    mean_ath_roi_pct: safeParseFloat(item.mean_ath_roi_pct || 0),
    median_ath_roi_pct: safeParseFloat(item.median_ath_roi_pct || 0),
    std_ath_roi_pct: safeParseFloat(item.std_ath_roi_pct || 0),
    mean_atl_roi_pct: safeParseFloat(item.mean_atl_roi_pct || 0),
    best_roi_pct: safeParseFloat(item.best_roi_pct || 0),
    worst_roi_pct: safeParseFloat(item.worst_roi_pct || 0),
    win_rate_pct: safeParseFloat(item.win_rate_pct || item.win_rate || 0),
    win_threshold_pct: safeParseFloat(item.win_threshold_pct || 25),
    win_rate_mc_p5: safeParseFloat(item.win_rate_mc_p5 || 0),
    win_rate_mc_p50: safeParseFloat(item.win_rate_mc_p50 || 0),
    win_rate_mc_p95: safeParseFloat(item.win_rate_mc_p95 || 0),
    hit_2x_pct: safeParseFloat(item.hit_2x_pct || 0),
    hit_3x_pct: safeParseFloat(item.hit_3x_pct || 0),
    hit_5x_pct: safeParseFloat(item.hit_5x_pct || 0),
    hit_10x_pct: safeParseFloat(item.hit_10x_pct || 0),
    hit_20x_pct: safeParseFloat(item.hit_20x_pct || 0),
    hit_50x_pct: safeParseFloat(item.hit_50x_pct || 0),
    hit_100x_pct: safeParseFloat(item.hit_100x_pct || 0),
    sharpe_ratio: safeParseFloat(item.sharpe_ratio || 0),
    sortino_ratio: safeParseFloat(item.sortino_ratio || 0),
    max_drawdown_pct: safeParseFloat(item.max_drawdown_pct || 0),
    ev: safeParseFloat(item.ev || 0),
    ev_weighted: safeParseFloat(item.ev_weighted || 0),
    avg_days_to_ath: safeParseFloat(item.avg_days_to_ath || 0),
    median_days_to_ath: safeParseFloat(item.median_days_to_ath || 0),
    avg_correlation_with_others: safeParseFloat(item.avg_correlation_with_others || 0),
    risk_score: safeParseFloat(item.risk_score || 0),
    consistency_score: safeParseFloat(item.consistency_score || 0),
    computed_at: String(item.computed_at || ""),
    // Backwards compatibility - populate old fields from new ones
    win_rate: safeParseFloat(item.win_rate_pct || item.win_rate || 0) / 100,
    total_calls: safeParseInt(item.n_calls || item.total_calls || 0),
    winning_calls: Math.round((safeParseFloat(item.win_rate_pct || item.win_rate || 0) / 100) * safeParseInt(item.n_calls || item.total_calls || 0)),
    average_roi: safeParseFloat(item.mean_ath_roi_pct || item.average_roi || 0) / 100,
    micro_cap_roi: safeParseFloat(item.micro_cap_roi || 0),
    micro_cap_winrate: safeParseFloat(item.micro_cap_winrate || 0),
    small_cap_roi: safeParseFloat(item.small_cap_roi || 0),
    small_cap_winrate: safeParseFloat(item.small_cap_winrate || 0),
    mid_cap_roi: safeParseFloat(item.mid_cap_roi || 0),
    mid_cap_winrate: safeParseFloat(item.mid_cap_winrate || 0),
    large_cap_roi: safeParseFloat(item.large_cap_roi || 0),
    large_cap_winrate: safeParseFloat(item.large_cap_winrate || 0),
    mega_cap_roi: safeParseFloat(item.mega_cap_roi || 0),
    mega_cap_winrate: safeParseFloat(item.mega_cap_winrate || 0),
  }
}

function calculateROI(initialMc: number, currentMc: number): number {
  if (initialMc === 0) return 0
  return ((currentMc - initialMc) / initialMc) * 100
}

function calculateROIAtHigh(initialMc: number, highMc: number): number {
  if (initialMc === 0) return 0
  return ((highMc - initialMc) / initialMc) * 100
}

function calculateROIAtLow(initialMc: number, lowMc: number): number {
  if (initialMc === 0) return 0
  return ((lowMc - initialMc) / initialMc) * 100
}

// Function to convert DynamoDB item to Trade
export function convertToTrade(item: DynamoDBItem): Trade {
  const initialMc = safeParseFloat(item.initial_mc)
  const currentMc = safeParseFloat(item.current_mc)
  const highMc = safeParseFloat(item.high_mc)
  const lowMc = safeParseFloat(item.low_mc)

  // Calculate ROIs using the provided values
  const roi = calculateROI(initialMc, currentMc)
  const roiAtHigh = calculateROIAtHigh(initialMc, highMc)
  const roiAtLow = calculateROIAtLow(initialMc, lowMc)

  // Calculate profits
  const profitAtHigh = highMc - initialMc
  const profitAtLow = lowMc - initialMc
  const profit = currentMc - initialMc

  // Determine if winner based on high ROI
  const isWinner = roiAtHigh > 0

  return {
    ca: item.ca,
    caller: item.caller,
    date_called: item.date_called,
    high_time: item.high_time,
    low_time: item.low_time,
    entry_price: safeParseFloat(item.entry_price || 0),
    ath_price: safeParseFloat(item.ath_price || item.high_price || 0),
    ath_roi: safeParseFloat(item.ath_roi || roiAtHigh || 0),
    initial_mc: initialMc,
    current_mc: currentMc,
    high_mc: highMc,
    low_mc: lowMc,
    high_price: safeParseFloat(item.high_price || 0),
    low_price: safeParseFloat(item.low_price || 0),
    price_change_24h: safeParseFloat(item.price_change_24h || 0),
    volume_24h: safeParseFloat(item.volume_24h || 0),
    liquidity: safeParseFloat(item.liquidity || 0),
    holders: safeParseInt(item.holders || 0),
    market_cap_rank: safeParseInt(item.market_cap_rank || 0),
    market_cap_change_24h: safeParseFloat(item.market_cap_change_24h || 0),
    market_cap_change_percentage_24h: safeParseFloat(item.market_cap_change_percentage_24h || 0),
    market_cap_dominance: safeParseFloat(item.market_cap_dominance || 0),
    fully_diluted_valuation: safeParseFloat(item.fully_diluted_valuation || 0),
    total_volume: safeParseFloat(item.total_volume || 0),
    high_24h: safeParseFloat(item.high_24h || 0),
    low_24h: safeParseFloat(item.low_24h || 0),
    price_change_percentage_24h: safeParseFloat(item.price_change_percentage_24h || 0),
    price_change_percentage_7d: safeParseFloat(item.price_change_percentage_7d || 0),
    price_change_percentage_14d: safeParseFloat(item.price_change_percentage_14d || 0),
    price_change_percentage_30d: safeParseFloat(item.price_change_percentage_30d || 0),
    price_change_percentage_60d: safeParseFloat(item.price_change_percentage_60d || 0),
    price_change_percentage_200d: safeParseFloat(item.price_change_percentage_200d || 0),
    price_change_percentage_1y: safeParseFloat(item.price_change_percentage_1y || 0),
    market_cap_change_24h_in_currency: safeParseFloat(item.market_cap_change_24h_in_currency || 0),
    market_cap_change_percentage_24h_in_currency: safeParseFloat(item.market_cap_change_percentage_24h_in_currency || 0),
    total_supply: safeParseFloat(item.total_supply || 0),
    max_supply: safeParseFloat(item.max_supply || 0),
    circulating_supply: safeParseFloat(item.circulating_supply || 0),
    last_updated: String(item.last_updated || ""),
    sparkline_in_7d: {
      price: Array.isArray(item.sparkline_in_7d) ? item.sparkline_in_7d.map(Number) : typeof item.sparkline_in_7d === 'string' ? JSON.parse(item.sparkline_in_7d).map(Number) : [],
    },
    price_change_percentage_1h_in_currency: safeParseFloat(item.price_change_percentage_1h_in_currency || 0),
    price_change_percentage_24h_in_currency: safeParseFloat(item.price_change_percentage_24h_in_currency || 0),
    price_change_percentage_7d_in_currency: safeParseFloat(item.price_change_percentage_7d_in_currency || 0),
    price_change_percentage_14d_in_currency: safeParseFloat(item.price_change_percentage_14d_in_currency || 0),
    price_change_percentage_30d_in_currency: safeParseFloat(item.price_change_percentage_30d_in_currency || 0),
    price_change_percentage_60d_in_currency: safeParseFloat(item.price_change_percentage_60d_in_currency || 0),
    price_change_percentage_200d_in_currency: safeParseFloat(item.price_change_percentage_200d_in_currency || 0),
    price_change_percentage_1y_in_currency: safeParseFloat(item.price_change_percentage_1y_in_currency || 0),
    roi,
    roi_at_high: roiAtHigh,
    roi_at_low: roiAtLow,
    profit_at_high: profitAtHigh,
    profit_at_low: profitAtLow,
    profit,
    is_winner: isWinner,
  }
}

// Function to calculate trader statistics from trades
function calculateTraderStats(trades: Trade[]): TraderStats {
  if (trades.length === 0) {
    return {
      caller: "",
      n_calls: 0,
      first_call_date: "",
      last_call_date: "",
      mean_ath_roi_pct: 0,
      median_ath_roi_pct: 0,
      std_ath_roi_pct: 0,
      mean_atl_roi_pct: 0,
      best_roi_pct: 0,
      worst_roi_pct: 0,
      win_rate_pct: 0,
      win_threshold_pct: 25,
      win_rate_mc_p5: 0,
      win_rate_mc_p50: 0,
      win_rate_mc_p95: 0,
      hit_2x_pct: 0,
      hit_3x_pct: 0,
      hit_5x_pct: 0,
      hit_10x_pct: 0,
      hit_20x_pct: 0,
      hit_50x_pct: 0,
      hit_100x_pct: 0,
      sharpe_ratio: 0,
      sortino_ratio: 0,
      max_drawdown_pct: 0,
      ev: 0,
      ev_weighted: 0,
      avg_days_to_ath: 0,
      median_days_to_ath: 0,
      avg_correlation_with_others: 0,
      risk_score: 0,
      consistency_score: 0,
      computed_at: new Date().toISOString(),
      // Backwards compatibility
      win_rate: 0,
      total_calls: 0,
      winning_calls: 0,
      average_roi: 0,
      micro_cap_roi: 0,
      micro_cap_winrate: 0,
      small_cap_roi: 0,
      small_cap_winrate: 0,
      mid_cap_roi: 0,
      mid_cap_winrate: 0,
      large_cap_roi: 0,
      large_cap_winrate: 0,
      mega_cap_roi: 0,
      mega_cap_winrate: 0,
    }
  }

  const caller = trades[0].caller
  const n_calls = trades.length
  const rois = trades.map(t => t.roi_at_high)
  const winning_calls = trades.filter(trade => trade.is_winner).length
  const win_rate_pct = n_calls > 0 ? (winning_calls / n_calls) * 100 : 0

  // Calculate ROI statistics
  const mean_ath_roi_pct = rois.reduce((sum, roi) => sum + roi, 0) / n_calls
  const sortedRois = [...rois].sort((a, b) => a - b)
  const median_ath_roi_pct = sortedRois[Math.floor(sortedRois.length / 2)]
  const variance = rois.reduce((sum, roi) => sum + Math.pow(roi - mean_ath_roi_pct, 2), 0) / n_calls
  const std_ath_roi_pct = Math.sqrt(variance)
  const mean_atl_roi_pct = trades.reduce((sum, t) => sum + t.roi_at_low, 0) / n_calls
  const best_roi_pct = Math.max(...rois)
  const worst_roi_pct = Math.min(...rois)

  // Calculate hit rates
  const hit_2x_pct = (trades.filter(t => t.roi_at_high >= 100).length / n_calls) * 100
  const hit_3x_pct = (trades.filter(t => t.roi_at_high >= 200).length / n_calls) * 100
  const hit_5x_pct = (trades.filter(t => t.roi_at_high >= 400).length / n_calls) * 100
  const hit_10x_pct = (trades.filter(t => t.roi_at_high >= 900).length / n_calls) * 100
  const hit_20x_pct = (trades.filter(t => t.roi_at_high >= 1900).length / n_calls) * 100
  const hit_50x_pct = (trades.filter(t => t.roi_at_high >= 4900).length / n_calls) * 100
  const hit_100x_pct = (trades.filter(t => t.roi_at_high >= 9900).length / n_calls) * 100

  // Date range
  const dates = trades.map(t => new Date(t.date_called)).sort((a, b) => a.getTime() - b.getTime())
  const first_call_date = dates[0]?.toISOString() || ""
  const last_call_date = dates[dates.length - 1]?.toISOString() || ""

  // Calculate market cap performance
  const microCapTrades = trades.filter(trade => trade.initial_mc < 1_000_000)
  const smallCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000 && trade.initial_mc < 10_000_000)
  const midCapTrades = trades.filter(trade => trade.initial_mc >= 10_000_000 && trade.initial_mc < 100_000_000)
  const largeCapTrades = trades.filter(trade => trade.initial_mc >= 100_000_000 && trade.initial_mc < 1_000_000_000)
  const megaCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000_000)

  const calculateCapStats = (capTrades: Trade[]) => {
    if (capTrades.length === 0) return { roi: 0, winrate: 0 }
    const roi = capTrades.reduce((sum, trade) => sum + trade.roi_at_high, 0) / capTrades.length
    const winrate = capTrades.filter(trade => trade.is_winner).length / capTrades.length
    return { roi, winrate }
  }

  const microCapStats = calculateCapStats(microCapTrades)
  const smallCapStats = calculateCapStats(smallCapTrades)
  const midCapStats = calculateCapStats(midCapTrades)
  const largeCapStats = calculateCapStats(largeCapTrades)
  const megaCapStats = calculateCapStats(megaCapTrades)

  return {
    caller,
    n_calls,
    first_call_date,
    last_call_date,
    mean_ath_roi_pct,
    median_ath_roi_pct,
    std_ath_roi_pct,
    mean_atl_roi_pct,
    best_roi_pct,
    worst_roi_pct,
    win_rate_pct,
    win_threshold_pct: 25,
    win_rate_mc_p5: 0, // Not calculated from trades
    win_rate_mc_p50: 0, // Not calculated from trades
    win_rate_mc_p95: 0, // Not calculated from trades
    hit_2x_pct,
    hit_3x_pct,
    hit_5x_pct,
    hit_10x_pct,
    hit_20x_pct,
    hit_50x_pct,
    hit_100x_pct,
    sharpe_ratio: 0, // Not calculated from trades
    sortino_ratio: 0, // Not calculated from trades
    max_drawdown_pct: 0, // Not calculated from trades
    ev: mean_ath_roi_pct, // Approximation
    ev_weighted: mean_ath_roi_pct, // Approximation
    avg_days_to_ath: 0, // Not calculated from trades
    median_days_to_ath: 0, // Not calculated from trades
    avg_correlation_with_others: 0, // Not calculated from trades
    risk_score: 0, // Not calculated from trades
    consistency_score: 0, // Not calculated from trades
    computed_at: new Date().toISOString(),
    // Backwards compatibility
    win_rate: win_rate_pct / 100,
    total_calls: n_calls,
    winning_calls,
    average_roi: mean_ath_roi_pct / 100,
    micro_cap_roi: microCapStats.roi,
    micro_cap_winrate: microCapStats.winrate,
    small_cap_roi: smallCapStats.roi,
    small_cap_winrate: smallCapStats.winrate,
    mid_cap_roi: midCapStats.roi,
    mid_cap_winrate: midCapStats.winrate,
    large_cap_roi: largeCapStats.roi,
    large_cap_winrate: largeCapStats.winrate,
    mega_cap_roi: megaCapStats.roi,
    mega_cap_winrate: megaCapStats.winrate,
  }
}

// Cache for trades data
let tradesCache: {
  data: Trade[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Function to check if cache is valid
function isCacheValid(): boolean {
  return tradesCache.data !== null && (Date.now() - tradesCache.timestamp) < CACHE_EXPIRATION;
}

// Function to clear cache
function clearCache(): void {
  tradesCache = {
    data: null,
    timestamp: 0
  };
}

// Function to get all trades with caching
export async function getAllTrades(): Promise<Trade[]> {
  try {
    console.log("Getting all trades")

    // Check cache first
    if (isCacheValid()) {
      console.log("Using cached trades data")
      return tradesCache.data!;
    }

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "Trades"

    // Scan the table without limit
    const items = await scanTable(tableName, {
      consistentRead: true,
    })

    // If no items found, return mock data
    if (items.length === 0) {
      console.log("No trades found in DynamoDB, using mock data")
      clearCache(); // Clear cache to ensure fresh mock data
      tradesCache = {
        data: mockTrades,
        timestamp: Date.now()
      };
      return mockTrades
    }

    // Convert items to Trades and update cache
    const trades = items.map(convertToTrade);
    tradesCache = {
      data: trades,
      timestamp: Date.now()
    };
    return trades;
  } catch (error) {
    console.error("Error fetching all trades from DynamoDB:", error)
    console.log("Falling back to mock data due to error")
    clearCache(); // Clear cache to ensure fresh mock data
    tradesCache = {
      data: mockTrades,
      timestamp: Date.now()
    };
    return mockTrades
  }
}

// Function to get all trades with filtering
export async function getAllTradesFiltered(filters?: TradeFilterOptions): Promise<Trade[]> {
  try {
    console.log("Getting all trades with filters:", filters)

    // Get trades from cache or fetch if needed
    const allTrades = await getAllTrades();

    // If no filters, return all trades
    if (!filters) return allTrades

    // Apply filters
    return allTrades.filter((trade) => {
      // ROI filter
      const roiMatch = trade.roi_at_high >= filters.roiRange[0] && trade.roi_at_high <= filters.roiRange[1]

      // Market cap filter
      const marketCapMatch =
        trade.initial_mc >= filters.marketCapRange[0] && trade.initial_mc <= filters.marketCapRange[1]

      // Date filter
      let dateMatch = true
      if (filters.dateRange && filters.dateRange.length === 2) {
        const tradeDate = new Date(trade.date_called)
        dateMatch = tradeDate >= filters.dateRange[0] && tradeDate <= filters.dateRange[1]
      }

      // Token search filter
      const searchMatch = !filters.searchTerm || trade.ca.toLowerCase().includes(filters.searchTerm.toLowerCase())

      // Trader search filter
      const traderMatch =
        !filters.traderSearchTerm || trade.caller.toLowerCase().includes(filters.traderSearchTerm.toLowerCase())

      return roiMatch && marketCapMatch && dateMatch && searchMatch && traderMatch
    })
  } catch (error) {
    console.error("Error filtering trades:", error)
    return []
  }
}

// Function to get trades for a specific trader
export async function getTraderTrades(caller: string): Promise<Trade[]> {
  try {
    console.log(`Getting trades for trader: ${caller}`)

    // Get trades from cache or fetch if needed
    const allTrades = await getAllTrades();

    // Filter trades for the specific trader
    return allTrades.filter((trade) => trade.caller === caller);
  } catch (error) {
    console.error(`Error fetching trades for ${caller}:`, error)
    console.log(`Falling back to mock data for ${caller} due to error`)
    return mockTrades.filter((trade) => trade.caller === caller)
  }
}

// Function to get trader stats with caching
export async function getTraderStats(filters?: FilterOptions): Promise<TraderStats[]> {
  try {
    console.log("Getting trader stats with filters:", filters)

    // Always calculate stats from actual trades for accuracy
    const allTrades = await getAllTrades();

    // Fetch current market cap data for all unique tokens
    const uniqueTokens = [...new Set(allTrades.map(trade => trade.ca))]
    const tokenMarketCaps: Record<string, number> = {}
    
    try {
      // Use bulk token prices API to get current market caps
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/bulk-token-prices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({ tokens: uniqueTokens })
        }
      )

      if (response.ok) {
        const results = await response.json()
        results.forEach((result: any) => {
          if (!result.error && result.market_cap) {
            tokenMarketCaps[result.token] = result.market_cap
          }
        })
      }
    } catch (error) {
      console.error("Error fetching current market caps:", error)
    }

    // Calculate ROI function (same logic as token-analysis page)
    const calculateRoi = (initialMc: number, currentMc: number) => {
      if (!initialMc || !currentMc) return 0
      if (currentMc < 10000) {
        const rawRoi = ((currentMc - initialMc) / initialMc) * 100
        return Math.min(rawRoi, 1000)
      }
      return ((currentMc - initialMc) / initialMc) * 100
    }

    // Group trades by trader
    const tradesByTrader = allTrades.reduce((acc, trade) => {
      if (!acc[trade.caller]) {
        acc[trade.caller] = []
      }
      acc[trade.caller].push(trade)
      return acc
    }, {} as Record<string, Trade[]>)

    // Calculate stats for each trader
    const stats = Object.entries(tradesByTrader).map(([caller, trades]) => {
      const n_calls = trades.length

      // Calculate ROI for each trade using current market cap
      const tradeRois = trades.map(trade => {
        const currentMc = tokenMarketCaps[trade.ca] || trade.current_mc
        return calculateRoi(trade.initial_mc, currentMc)
      })

      const winning_calls = tradeRois.filter(roi => roi > 0).length
      const win_rate_pct = n_calls > 0 ? (winning_calls / n_calls) * 100 : 0
      const mean_ath_roi_pct = n_calls > 0 ? tradeRois.reduce((sum, roi) => sum + roi, 0) / n_calls : 0

      // Calculate ROI statistics
      const sortedRois = [...tradeRois].sort((a, b) => a - b)
      const median_ath_roi_pct = sortedRois.length > 0 ? sortedRois[Math.floor(sortedRois.length / 2)] : 0
      const variance = n_calls > 0 ? tradeRois.reduce((sum, roi) => sum + Math.pow(roi - mean_ath_roi_pct, 2), 0) / n_calls : 0
      const std_ath_roi_pct = Math.sqrt(variance)
      const best_roi_pct = tradeRois.length > 0 ? Math.max(...tradeRois) : 0
      const worst_roi_pct = tradeRois.length > 0 ? Math.min(...tradeRois) : 0

      // Calculate hit rates
      const hit_2x_pct = (trades.filter(t => t.roi_at_high >= 100).length / n_calls) * 100
      const hit_3x_pct = (trades.filter(t => t.roi_at_high >= 200).length / n_calls) * 100
      const hit_5x_pct = (trades.filter(t => t.roi_at_high >= 400).length / n_calls) * 100
      const hit_10x_pct = (trades.filter(t => t.roi_at_high >= 900).length / n_calls) * 100
      const hit_20x_pct = (trades.filter(t => t.roi_at_high >= 1900).length / n_calls) * 100
      const hit_50x_pct = (trades.filter(t => t.roi_at_high >= 4900).length / n_calls) * 100
      const hit_100x_pct = (trades.filter(t => t.roi_at_high >= 9900).length / n_calls) * 100

      // Date range
      const dates = trades.map(t => new Date(t.date_called)).sort((a, b) => a.getTime() - b.getTime())
      const first_call_date = dates[0]?.toISOString() || ""
      const last_call_date = dates[dates.length - 1]?.toISOString() || ""

      // Calculate market cap performance
      const microCapTrades = trades.filter(trade => trade.initial_mc < 1_000_000)
      const smallCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000 && trade.initial_mc < 10_000_000)
      const midCapTrades = trades.filter(trade => trade.initial_mc >= 10_000_000 && trade.initial_mc < 100_000_000)
      const largeCapTrades = trades.filter(trade => trade.initial_mc >= 100_000_000 && trade.initial_mc < 1_000_000_000)
      const megaCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000_000)

      const calculateCapStats = (capTrades: Trade[]) => {
        if (capTrades.length === 0) return { roi: 0, winrate: 0 }

        const capRois = capTrades.map(trade => {
          const currentMc = tokenMarketCaps[trade.ca] || trade.current_mc
          return calculateRoi(trade.initial_mc, currentMc)
        })

        const roi = capRois.reduce((sum, roi) => sum + roi, 0) / capTrades.length
        const winrate = capRois.filter(roi => roi > 0).length / capTrades.length
        return { roi, winrate }
      }

      const microCapStats = calculateCapStats(microCapTrades)
      const smallCapStats = calculateCapStats(smallCapTrades)
      const midCapStats = calculateCapStats(midCapTrades)
      const largeCapStats = calculateCapStats(largeCapTrades)
      const megaCapStats = calculateCapStats(megaCapTrades)

      return {
        caller,
        n_calls,
        first_call_date,
        last_call_date,
        mean_ath_roi_pct,
        median_ath_roi_pct,
        std_ath_roi_pct,
        mean_atl_roi_pct: 0, // Not calculated from current data
        best_roi_pct,
        worst_roi_pct,
        win_rate_pct,
        win_threshold_pct: 25,
        win_rate_mc_p5: 0, // Not calculated
        win_rate_mc_p50: 0, // Not calculated
        win_rate_mc_p95: 0, // Not calculated
        hit_2x_pct,
        hit_3x_pct,
        hit_5x_pct,
        hit_10x_pct,
        hit_20x_pct,
        hit_50x_pct,
        hit_100x_pct,
        sharpe_ratio: 0, // Not calculated
        sortino_ratio: 0, // Not calculated
        max_drawdown_pct: 0, // Not calculated
        ev: mean_ath_roi_pct,
        ev_weighted: mean_ath_roi_pct,
        avg_days_to_ath: 0, // Not calculated
        median_days_to_ath: 0, // Not calculated
        avg_correlation_with_others: 0, // Not calculated
        risk_score: 0, // Not calculated
        consistency_score: 0, // Not calculated
        computed_at: new Date().toISOString(),
        // Backwards compatibility
        total_calls: n_calls,
        winning_calls,
        win_rate: win_rate_pct / 100,
        average_roi: mean_ath_roi_pct / 100,
        micro_cap_roi: microCapStats.roi,
        micro_cap_winrate: microCapStats.winrate,
        small_cap_roi: smallCapStats.roi,
        small_cap_winrate: smallCapStats.winrate,
        mid_cap_roi: midCapStats.roi,
        mid_cap_winrate: midCapStats.winrate,
        large_cap_roi: largeCapStats.roi,
        large_cap_winrate: largeCapStats.winrate,
        mega_cap_roi: megaCapStats.roi,
        mega_cap_winrate: megaCapStats.winrate,
      }
    })

    // Apply filters if provided
    if (filters) {
      return stats.filter((stat) => {
        const winRateMatch = stat.win_rate >= filters.winRateRange[0] && stat.win_rate <= filters.winRateRange[1]
        const totalCallsMatch = stat.total_calls >= filters.totalCallsRange[0] && stat.total_calls <= filters.totalCallsRange[1]
        const roiMatch = stat.average_roi >= filters.roiRange[0] && stat.average_roi <= filters.roiRange[1]
        const searchMatch = !filters.searchTerm || stat.caller.toLowerCase().includes(filters.searchTerm.toLowerCase())

        return winRateMatch && totalCallsMatch && roiMatch && searchMatch
      })
    }

    return stats
  } catch (error) {
    console.error("Error getting trader stats:", error)
    return []
  }
}

// Function to create or update a trader
export async function saveTrader(trader: TraderStats): Promise<void> {
  try {
    console.log(`Saving trader: ${trader.caller}`)

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADER_STATISTICS || "CallerStatistics"

    // Put the item
    await putItem(tableName, trader)

    console.log(`Trader ${trader.caller} saved successfully`)
  } catch (error) {
    console.error(`Error saving trader ${trader.caller}:`, error)
    throw error
  }
}

// Function to create or update a trade
export async function saveTrade(trade: Trade): Promise<void> {
  try {
    console.log(`Saving trade for ${trade.caller}`)

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "Trades"

    // Put the item
    await putItem(tableName, trade)

    console.log(`Trade for ${trade.caller} saved successfully`)
  } catch (error) {
    console.error(`Error saving trade for ${trade.caller}:`, error)
    throw error
  }
}

// Function to delete a trader
export async function deleteTrader(caller: string): Promise<void> {
  try {
    console.log(`Deleting trader: ${caller}`)

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADER_STATISTICS || "CallerStatistics"

    // Delete the item
    await deleteItem(tableName, { caller })

    console.log(`Trader ${caller} deleted successfully`)
  } catch (error) {
    console.error(`Error deleting trader ${caller}:`, error)
    throw error
  }
}

// Function to delete a trade
export async function deleteTrade(caller: string, ca: string, date_called: string): Promise<void> {
  try {
    console.log(`Deleting trade for ${caller}`)

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "Trades"

    // Delete the item
    await deleteItem(tableName, { caller, ca, date_called })

    console.log(`Trade for ${caller} deleted successfully`)
  } catch (error) {
    console.error(`Error deleting trade for ${caller}:`, error)
    throw error
  }
}

// Cache for mock data status
let mockDataCache: { result: boolean; timestamp: number } | null = null
const MOCK_DATA_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Function to check if we're using mock data
export async function isUsingMockData(): Promise<boolean> {
  // Check cache first
  if (mockDataCache && (Date.now() - mockDataCache.timestamp) < MOCK_DATA_CACHE_DURATION) {
    return mockDataCache.result
  }

  try {
    // Try to get a small sample from DynamoDB to see if it's available
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "Trades"
    const items = await scanTable(tableName, {
      limit: 1,
      consistentRead: false, // Use eventually consistent reads for faster response
    })
    
    // If we can get data from DynamoDB, we're not using mock data
    const result = items.length === 0
    
    // Cache the result
    mockDataCache = {
      result,
      timestamp: Date.now()
    }
    
    return result
  } catch (error) {
    console.log("DynamoDB not available, using mock data")
    
    // Cache the result
    mockDataCache = {
      result: true,
      timestamp: Date.now()
    }
    
    return true
  }
}

export async function fetchAllTrades(): Promise<Trade[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/trades`)
    if (!response.ok) {
      throw new Error('Failed to fetch trades')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching trades:', error)
    return MOCK_TRADES
  }
}

