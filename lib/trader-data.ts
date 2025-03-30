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
  caller: string
  ca: string
  initial_mc: number
  current_mc: number
  date_called: string
  low_price: number
  low_time: string
  roi_at_low: number
  high_price: number
  high_time: string
  roi_at_high: number
  multiples_hit: string
  profit_at_low: number
  profit_at_high: number
  roi: number
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

// Function to convert DynamoDB item to Trade
function convertToTrade(item: DynamoDBItem): Trade {
  return {
    caller: String(item.caller || ""),
    ca: String(item.ca || ""),
    initial_mc: safeParseFloat(item.initial_mc || 0),
    current_mc: safeParseFloat(item.current_mc || 0),
    date_called: String(item.date_called || ""),
    low_price: safeParseFloat(item.low_price || 0),
    low_time: String(item.low_time || ""),
    roi_at_low: safeParseFloat(item.roi_at_low || 0),
    high_price: safeParseFloat(item.high_price || 0),
    high_time: String(item.high_time || ""),
    roi_at_high: safeParseFloat(item.roi_at_high || 0),
    multiples_hit: String(item.multiples_hit || "[]"),
    profit_at_low: safeParseFloat(item.profit_at_low || 0),
    profit_at_high: safeParseFloat(item.profit_at_high || 0),
    roi: safeParseFloat(item.roi || 0),
  }
}

// Function to get trader statistics with filtering
export async function getTraderStats(filters?: FilterOptions): Promise<TraderStats[]> {
  try {
    console.log("TRADER-DATA - Getting trader statistics with filters:", filters)

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "CallerStatistics"

    // Scan the table
    const items = await scanTable(tableName, {
      limit: 100,
      consistentRead: true,
    })

    // If no items found, return mock data
    if (items.length === 0) {
      console.log("TRADER-DATA - No items found in DynamoDB, using mock data")
      const filteredMockData = filterTraderStats(mockTraderStats, filters)
      console.log(`TRADER-DATA - Returning ${filteredMockData.length} filtered mock traders`)
      return filteredMockData
    }

    // Convert items to TraderStats
    const traders = items.map(convertToTraderStats)
    console.log(`TRADER-DATA - Retrieved ${traders.length} traders from DynamoDB`)

    // Apply filters if provided
    const filteredTraders = filterTraderStats(traders, filters)
    console.log(`TRADER-DATA - After filtering, returning ${filteredTraders.length} traders`)
    return filteredTraders
  } catch (error) {
    console.error("Error fetching trader statistics from DynamoDB:", error)
    console.log("TRADER-DATA - Falling back to mock data due to error")
    const filteredMockData = filterTraderStats(mockTraderStats, filters)
    console.log(`TRADER-DATA - Returning ${filteredMockData.length} filtered mock traders`)
    return filteredMockData
  }
}

// Function to get trades for a specific trader
export async function getTraderTrades(caller: string): Promise<Trade[]> {
  try {
    console.log(`Getting trades for trader: ${caller}`)

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADES_TABLE || "Trades"

    // Query the table
    const items = await queryTable(tableName, {
      keyConditionExpression: "caller = :caller",
      expressionAttributeValues: {
        ":caller": caller,
      },
      consistentRead: true,
    })

    // If no items found, return mock data
    if (items.length === 0) {
      console.log(`No trades found for ${caller} in DynamoDB, using mock data`)
      return mockTrades.filter((trade) => trade.caller === caller)
    }

    // Convert items to Trades
    return items.map(convertToTrade)
  } catch (error) {
    console.error(`Error fetching trades for ${caller} from DynamoDB:`, error)
    console.log(`Falling back to mock data for ${caller} due to error`)
    return mockTrades.filter((trade) => trade.caller === caller)
  }
}

// Function to get all trades
export async function getAllTrades(): Promise<Trade[]> {
  try {
    console.log("Getting all trades")

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADES_TABLE || "Trades"

    // Scan the table
    const items = await scanTable(tableName, {
      limit: 100,
      consistentRead: true,
    })

    // If no items found, return mock data
    if (items.length === 0) {
      console.log("No trades found in DynamoDB, using mock data")
      return mockTrades
    }

    // Convert items to Trades
    return items.map(convertToTrade)
  } catch (error) {
    console.error("Error fetching all trades from DynamoDB:", error)
    console.log("Falling back to mock data due to error")
    return mockTrades
  }
}

// Function to get all trades with filtering
export async function getAllTradesFiltered(filters?: TradeFilterOptions): Promise<Trade[]> {
  try {
    console.log("Getting all trades with filters:", filters)

    // Get all trades first
    const allTrades = await getAllTrades()

    // If no filters, return all trades
    if (!filters) return allTrades

    // Apply filters
    return allTrades.filter((trade) => {
      // ROI filter
      const roiMatch = trade.roi >= filters.roiRange[0] && trade.roi <= filters.roiRange[1]

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

// Helper function to filter trader stats
function filterTraderStats(traders: TraderStats[], filters?: FilterOptions): TraderStats[] {
  if (!filters) {
    console.log("TRADER-DATA - No filters provided, returning all traders")
    return traders
  }

  console.log("TRADER-DATA - Filtering traders with filters:", filters)
  console.log("TRADER-DATA - Before filtering, trader count:", traders.length)

  const filteredTraders = traders.filter((trader) => {
    const winRateMatch = trader.win_rate >= filters.winRateRange[0] && trader.win_rate <= filters.winRateRange[1]
    const totalCallsMatch =
      trader.total_calls >= filters.totalCallsRange[0] && trader.total_calls <= filters.totalCallsRange[1]
    const roiMatch = trader.average_roi >= filters.roiRange[0] && trader.average_roi <= filters.roiRange[1]
    const searchMatch = !filters.searchTerm || trader.caller.toLowerCase().includes(filters.searchTerm.toLowerCase())

    // Log detailed filter matching for debugging
    if (!winRateMatch) {
      console.log(
        `TRADER-DATA - Trader ${trader.caller} failed win rate filter: ${trader.win_rate} not in range [${filters.winRateRange[0]}, ${filters.winRateRange[1]}]`,
      )
    }
    if (!totalCallsMatch) {
      console.log(
        `TRADER-DATA - Trader ${trader.caller} failed total calls filter: ${trader.total_calls} not in range [${filters.totalCallsRange[0]}, ${filters.totalCallsRange[1]}]`,
      )
    }
    if (!roiMatch) {
      console.log(
        `TRADER-DATA - Trader ${trader.caller} failed ROI filter: ${trader.average_roi} not in range [${filters.roiRange[0]}, ${filters.roiRange[1]}]`,
      )
    }
    if (!searchMatch && filters.searchTerm) {
      console.log(
        `TRADER-DATA - Trader ${trader.caller} failed search filter: "${trader.caller}" does not include "${filters.searchTerm}"`,
      )
    }

    return winRateMatch && totalCallsMatch && roiMatch && searchMatch
  })

  console.log("TRADER-DATA - After filtering, trader count:", filteredTraders.length)
  return filteredTraders
}

// Function to create or update a trader
export async function saveTrader(trader: TraderStats): Promise<void> {
  try {
    console.log(`Saving trader: ${trader.caller}`)

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "CallerStatistics"

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
    const tableName = process.env.DYNAMODB_TRADES_TABLE || "Trades"

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
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "CallerStatistics"

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
    const tableName = process.env.DYNAMODB_TRADES_TABLE || "Trades"

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
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "CallerStatistics"

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

