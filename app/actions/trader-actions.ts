import {
  getTraderStats,
  getTraderTrades,
  getAllTrades,
  saveTrader,
  saveTrade,
  deleteTrader,
  deleteTrade,
  getAllTradesFiltered,
  type FilterOptions,
  type TraderStats,
  type Trade,
  type TradeFilterOptions,
} from "@/lib/trader-data"

export async function fetchTraderStats(filters?: FilterOptions): Promise<TraderStats[]> {
  try {
    console.log("TRADER-ACTIONS - Fetching trader stats with filters:", filters)
    const traders = await getTraderStats(filters)
    console.log(`TRADER-ACTIONS - Fetched ${traders.length} traders`)
    return traders
  } catch (error) {
    console.error("Error in fetchTraderStats:", error)
    return []
  }
}

export async function fetchTraderTrades(caller: string): Promise<Trade[]> {
  try {
    console.log(`Fetching trades for trader: ${caller}`)
    return await getTraderTrades(caller)
  } catch (error) {
    console.error(`Error in fetchTraderTrades for ${caller}:`, error)
    return []
  }
}

export async function fetchAllTrades(): Promise<Trade[]> {
  try {
    console.log("Fetching all trades")
    return await getAllTrades()
  } catch (error) {
    console.error("Error in fetchAllTrades:", error)
    return []
  }
}

export async function fetchAllTradesFiltered(filters?: TradeFilterOptions): Promise<Trade[]> {
  try {
    console.log("Fetching all trades with filters")
    return await getAllTradesFiltered(filters)
  } catch (error) {
    console.error("Error in fetchAllTradesFiltered:", error)
    return []
  }
}

export async function createOrUpdateTrader(trader: TraderStats): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Creating/updating trader: ${trader.caller}`)
    await saveTrader(trader)
    return { success: true, message: `Trader ${trader.caller} saved successfully` }
  } catch (error) {
    console.error(`Error in createOrUpdateTrader for ${trader.caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

export async function createOrUpdateTrade(trade: Trade): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Creating/updating trade for ${trade.caller}`)
    await saveTrade(trade)
    return { success: true, message: `Trade for ${trade.caller} saved successfully` }
  } catch (error) {
    console.error(`Error in createOrUpdateTrade for ${trade.caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

export async function removeTrader(caller: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Removing trader: ${caller}`)
    await deleteTrader(caller)
    return { success: true, message: `Trader ${caller} removed successfully` }
  } catch (error) {
    console.error(`Error in removeTrader for ${caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

export async function removeTrade(
  caller: string,
  ca: string,
  date_called: string,
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Removing trade for ${caller}`)
    await deleteTrade(caller, ca, date_called)
    return { success: true, message: `Trade for ${caller} removed successfully` }
  } catch (error) {
    console.error(`Error in removeTrade for ${caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

