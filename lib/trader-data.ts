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
  partition_key: string
  ca: string
  caller: string
  date_called: string
  high_time: string
  low_time: string
  initial_mc: number
  current_mc: number
  high_price: number
  low_price: number
  roi: number
  roi_at_high: number
  roi_at_low: number
  profit_at_high: number
  profit_at_low: number
  profit: number
  is_winner: boolean
  multiples_hit: number[]
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
    partition_key: item.partition_key,
    ca: item.ca,
    caller: item.caller,
    date_called: item.date_called,
    high_time: item.high_time,
    low_time: item.low_time,
    initial_mc: initialMc,
    current_mc: currentMc,
    high_price: item.high_price,
    low_price: item.low_price,
    roi,
    roi_at_high: roiAtHigh,
    roi_at_low: roiAtLow,
    profit_at_high: profitAtHigh,
    profit_at_low: profitAtLow,
    profit,
    is_winner: isWinner,
    multiples_hit: Array.isArray(item.multiples_hit) 
      ? item.multiples_hit.map(Number)
      : typeof item.multiples_hit === 'string'
        ? JSON.parse(item.multiples_hit).map(Number)
        : []
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

    // If no filters, use direct DynamoDB query
    if (!filters) {
      const tableName = process.env.DYNAMODB_TRADER_STATISTICS || "CallerStatistics"
      const items = await scanTable(tableName, {
        consistentRead: true,
      })
      
      if (items.length === 0) {
        console.log("No trader stats found in DynamoDB, using mock data")
        return mockTraderStats
      }

      return items.map(convertToTraderStats)
    }

    // If filters are provided, calculate stats from trades
    const allTrades = await getAllTrades();

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
      const winning_calls = trades.filter((trade) => trade.roi_at_high > 0).length
      const win_rate = total_calls > 0 ? winning_calls / total_calls : 0
      const average_roi = total_calls > 0 ? trades.reduce((sum, trade) => sum + trade.roi_at_high, 0) / total_calls : 0

      // Calculate market cap performance
      const microCapTrades = trades.filter(trade => trade.initial_mc < 1_000_000)
      const smallCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000 && trade.initial_mc < 10_000_000)
      const midCapTrades = trades.filter(trade => trade.initial_mc >= 10_000_000 && trade.initial_mc < 100_000_000)
      const largeCapTrades = trades.filter(trade => trade.initial_mc >= 100_000_000 && trade.initial_mc < 1_000_000_000)
      const megaCapTrades = trades.filter(trade => trade.initial_mc >= 1_000_000_000)

      const calculateCapStats = (capTrades: Trade[]) => {
        if (capTrades.length === 0) return { roi: 0, winrate: 0 }
        const roi = capTrades.reduce((sum, trade) => sum + trade.roi_at_high, 0) / capTrades.length
        const winrate = capTrades.filter(trade => trade.roi_at_high > 0).length / capTrades.length
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

    // Apply filters
    return stats.filter((stat) => {
      const winRateMatch = stat.win_rate >= filters.winRateRange[0] && stat.win_rate <= filters.winRateRange[1]
      const totalCallsMatch = stat.total_calls >= filters.totalCallsRange[0] && stat.total_calls <= filters.totalCallsRange[1]
      const roiMatch = stat.average_roi >= filters.roiRange[0] && stat.average_roi <= filters.roiRange[1]
      const searchMatch = !filters.searchTerm || stat.caller.toLowerCase().includes(filters.searchTerm.toLowerCase())

      return winRateMatch && totalCallsMatch && roiMatch && searchMatch
    })
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

// Function to check if we're using mock data
export async function isUsingMockData(): Promise<boolean> {
  try {
    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADER_STATISTICS || "CallerStatistics"

    // Try to scan the table with a small limit
    const items = await scanTable(tableName, {
      limit: 1,
    })

    // If we got items and they don't match our mock data, we're using real data
    if (items.length > 0) {
      const firstTrader = convertToTraderStats(items[0])
      // Check if this matches our first mock trader
      return firstTrader.caller === mockTraderStats[0].caller
    }

    // No items or error means we're using mock data
    return true
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    return true // Assume mock data on error
  }
}

