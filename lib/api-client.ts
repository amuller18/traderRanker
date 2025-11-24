/**
 * Client-side API utility for fetching data from Raspberry Pi backend
 * This replaces Server Actions and is compatible with static export
 */

import type { TraderStats, Trade, FilterOptions, TradeFilterOptions } from "./trader-data"

const API_BASE = process.env.NEXT_PUBLIC_PI_API_BASE || 'http://localhost:8000'

/**
 * Generic fetch wrapper with error handling and API key auth
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.NEXT_PUBLIC_PI_API_KEY

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(apiKey && { 'X-API-Key': apiKey }),
    ...options.headers,
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`API fetch error for ${endpoint}:`, error)
    throw error
  }
}

/**
 * Fetch trader statistics with optional filters
 */
export async function fetchTraderStats(filters?: FilterOptions): Promise<TraderStats[]> {
  try {
    const queryParams = new URLSearchParams()

    if (filters) {
      if (filters.winRateRange) {
        queryParams.set('winRateMin', filters.winRateRange[0].toString())
        queryParams.set('winRateMax', filters.winRateRange[1].toString())
      }
      if (filters.totalCallsRange) {
        queryParams.set('totalCallsMin', filters.totalCallsRange[0].toString())
        queryParams.set('totalCallsMax', filters.totalCallsRange[1].toString())
      }
      if (filters.roiRange) {
        queryParams.set('roiMin', filters.roiRange[0].toString())
        queryParams.set('roiMax', filters.roiRange[1].toString())
      }
      if (filters.searchTerm) {
        queryParams.set('search', filters.searchTerm)
      }
    }

    const query = queryParams.toString()
    const endpoint = `/api/traders/stats${query ? `?${query}` : ''}`

    return await apiFetch<TraderStats[]>(endpoint)
  } catch (error) {
    console.error("Error in fetchTraderStats:", error)
    return []
  }
}

/**
 * Fetch trades for a specific trader
 */
export async function fetchTraderTrades(caller: string): Promise<Trade[]> {
  try {
    const encodedCaller = encodeURIComponent(caller)
    return await apiFetch<Trade[]>(`/api/traders/${encodedCaller}/trades`)
  } catch (error) {
    console.error(`Error in fetchTraderTrades for ${caller}:`, error)
    return []
  }
}

/**
 * Fetch all trades (unfiltered)
 */
export async function fetchAllTrades(): Promise<Trade[]> {
  try {
    return await apiFetch<Trade[]>('/api/trades')
  } catch (error) {
    console.error("Error in fetchAllTrades:", error)
    return []
  }
}

/**
 * Fetch all trades with filters
 */
export async function fetchAllTradesFiltered(filters?: TradeFilterOptions): Promise<Trade[]> {
  try {
    const queryParams = new URLSearchParams()

    if (filters) {
      if (filters.roiRange) {
        queryParams.set('roiMin', filters.roiRange[0].toString())
        queryParams.set('roiMax', filters.roiRange[1].toString())
      }
      if (filters.marketCapRange) {
        queryParams.set('mcMin', filters.marketCapRange[0].toString())
        queryParams.set('mcMax', filters.marketCapRange[1].toString())
      }
      if (filters.dateRange) {
        queryParams.set('dateFrom', filters.dateRange[0].toISOString())
        queryParams.set('dateTo', filters.dateRange[1].toISOString())
      }
      if (filters.searchTerm) {
        queryParams.set('search', filters.searchTerm)
      }
      if (filters.traderSearchTerm) {
        queryParams.set('trader', filters.traderSearchTerm)
      }
      if (filters.timeframe) {
        queryParams.set('timeframe', filters.timeframe)
      }
    }

    const query = queryParams.toString()
    const endpoint = `/api/trades/filtered${query ? `?${query}` : ''}`

    return await apiFetch<Trade[]>(endpoint)
  } catch (error) {
    console.error("Error in fetchAllTradesFiltered:", error)
    return []
  }
}

/**
 * Create or update a trader
 */
export async function createOrUpdateTrader(trader: TraderStats): Promise<{ success: boolean; message: string }> {
  try {
    const result = await apiFetch<{ success: boolean; message: string }>(
      '/api/traders',
      {
        method: 'POST',
        body: JSON.stringify(trader),
      }
    )
    return result
  } catch (error) {
    console.error(`Error in createOrUpdateTrader for ${trader.caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

/**
 * Create or update a trade
 */
export async function createOrUpdateTrade(trade: Trade): Promise<{ success: boolean; message: string }> {
  try {
    const result = await apiFetch<{ success: boolean; message: string }>(
      '/api/trades',
      {
        method: 'POST',
        body: JSON.stringify(trade),
      }
    )
    return result
  } catch (error) {
    console.error(`Error in createOrUpdateTrade for ${trade.caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

/**
 * Delete a trader
 */
export async function removeTrader(caller: string): Promise<{ success: boolean; message: string }> {
  try {
    const encodedCaller = encodeURIComponent(caller)
    const result = await apiFetch<{ success: boolean; message: string }>(
      `/api/traders/${encodedCaller}`,
      {
        method: 'DELETE',
      }
    )
    return result
  } catch (error) {
    console.error(`Error in removeTrader for ${caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

/**
 * Delete a trade
 */
export async function removeTrade(
  caller: string,
  ca: string,
  date_called: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await apiFetch<{ success: boolean; message: string }>(
      '/api/trades',
      {
        method: 'DELETE',
        body: JSON.stringify({ caller, ca, date_called }),
      }
    )
    return result
  } catch (error) {
    console.error(`Error in removeTrade for ${caller}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}
