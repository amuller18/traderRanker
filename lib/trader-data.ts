import { scanTable, queryTable, putItem, deleteItem, type DynamoDBItem } from "./dynamo-minimal"

// Type definitions for our data
export interface TraderStats {
  caller: string
  win_rate: number
  total_calls: number
  winning_calls: number
  average_roi: number
  micro_cap_roi: number
  micro_cap_winrate: number
  small_cap_roi: number
  small_cap_winrate: number
  mid_cap_roi: number
  mid_cap_winrate: number
  large_cap_roi: number
  large_cap_winrate: number
  mega_cap_roi: number
  mega_cap_winrate: number
}

export interface Trade {
  ca: string
  caller: string
  date_called: string
  high_time: string
  low_time: string
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
    win_rate: safeParseFloat(item.win_rate || 0),
    total_calls: safeParseInt(item.total_calls || 0),
    winning_calls: safeParseInt(item.winning_calls || 0),
    average_roi: safeParseFloat(item.average_roi || 0),
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
    initial_mc: initialMc,
    current_mc: currentMc,
    high_mc: highMc,
    low_mc: lowMc,
    high_price: item.high_price,
    low_price: item.low_price,
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
  const total_calls = trades.length
  const winning_calls = trades.filter(trade => trade.is_winner).length
  const win_rate = total_calls > 0 ? winning_calls / total_calls : 0
  const average_roi = trades.reduce((sum, trade) => sum + trade.roi_at_high, 0) / total_calls

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
    win_rate,
    total_calls,
    winning_calls,
    average_roi,
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
      const total_calls = trades.length
      
      // Calculate ROI for each trade using current market cap
      const tradeRois = trades.map(trade => {
        const currentMc = tokenMarketCaps[trade.ca] || trade.current_mc
        return calculateRoi(trade.initial_mc, currentMc)
      })
      
      const winning_calls = tradeRois.filter(roi => roi > 0).length
      const win_rate = total_calls > 0 ? winning_calls / total_calls : 0
      const average_roi = total_calls > 0 ? tradeRois.reduce((sum, roi) => sum + roi, 0) / total_calls : 0

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
        total_calls,
        winning_calls,
        win_rate,
        average_roi,
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

