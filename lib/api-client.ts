/**
 * Client-side API utility for fetching data from Raspberry Pi backend
 * This replaces Server Actions and is compatible with static export
 */

import type { TraderStats, Trade, FilterOptions, TradeFilterOptions } from "./trader-data"

const API_BASE = process.env.NEXT_PUBLIC_PI_API_BASE || 'http://localhost:8000'

/**
 * Validates that the API base URL is properly configured
 * @throws Error if API_BASE is not set or invalid
 */
function validateApiBase(): void {
  if (!API_BASE) {
    throw new Error(
      'API configuration error: NEXT_PUBLIC_PI_API_BASE is not set. ' +
      'Please set this environment variable in your .env.local file.'
    )
  }

  // Check if we're in the browser and the URL looks valid
  if (typeof window !== 'undefined') {
    try {
      new URL(API_BASE)
    } catch {
      throw new Error(
        `API configuration error: NEXT_PUBLIC_PI_API_BASE "${API_BASE}" is not a valid URL. ` +
        'Please check your .env.local file.'
      )
    }
  }
}

/**
 * Generic fetch wrapper with error handling and API key auth
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Validate API base URL before making requests
  validateApiBase()

  const apiKey = process.env.NEXT_PUBLIC_PI_API_KEY

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(apiKey && { 'X-API-Key': apiKey }),
    ...options.headers,
  }

  const fullUrl = `${API_BASE}${endpoint}`

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    })

    if (!response.ok) {
      let errorMessage = `API Error (${response.status})`
      try {
        const errorText = await response.text()
        const errorData = errorText ? JSON.parse(errorText) : null
        errorMessage = `${errorMessage}: ${errorData?.message || errorText || response.statusText}`
      } catch {
        // If parsing fails, use statusText
        errorMessage = `${errorMessage}: ${response.statusText}`
      }
      throw new Error(errorMessage)
    }

    const text = await response.text()
    return text ? JSON.parse(text) : (undefined as unknown as T)
  } catch (error) {
    // Enhanced error handling for network and other errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      const networkError = new Error(
        `Network error: Unable to reach API at ${fullUrl}. ` +
        'Please check:\n' +
        '1. The backend server is running\n' +
        '2. NEXT_PUBLIC_PI_API_BASE is set correctly\n' +
        '3. CORS is properly configured on the server\n' +
        '4. Your network connection'
      )
      console.error(`API fetch error for ${endpoint}:`, networkError.message)
      throw networkError
    }

    // Re-throw API errors with context
    if (error instanceof Error) {
      console.error(`API fetch error for ${endpoint}:`, error.message)
      throw error
    }

    // Unknown error
    const unknownError = new Error(`Unknown error fetching ${endpoint}: ${error}`)
    console.error(unknownError.message)
    throw unknownError
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
 * Fetch trades for a specific trader with optional pagination
 */
export async function fetchTraderTrades(
  caller: string,
  options?: { limit?: number; offset?: number }
): Promise<Trade[]> {
  try {
    const encodedCaller = encodeURIComponent(caller)
    const queryParams = new URLSearchParams()

    if (options?.limit) {
      queryParams.set('limit', options.limit.toString())
    }
    if (options?.offset) {
      queryParams.set('offset', options.offset.toString())
    }

    const query = queryParams.toString()
    const endpoint = `/api/traders/${encodedCaller}/trades${query ? `?${query}` : ''}`

    return await apiFetch<Trade[]>(endpoint)
  } catch (error) {
    console.error(`Error in fetchTraderTrades for ${caller}:`, error)
    return []
  }
}

/**
 * Get total trade count for a trader
 */
export async function fetchTraderTradeCount(caller: string): Promise<number> {
  try {
    const encodedCaller = encodeURIComponent(caller)
    const trades = await apiFetch<Trade[]>(`/api/traders/${encodedCaller}/trades?count=true`)
    return Array.isArray(trades) ? trades.length : 0
  } catch (error) {
    console.error(`Error in fetchTraderTradeCount for ${caller}:`, error)
    return 0
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
        // Convert to Unix timestamps (seconds since epoch)
        const fromTimestamp = Math.floor(filters.dateRange[0].getTime() / 1000)
        const toTimestamp = Math.floor(filters.dateRange[1].getTime() / 1000)
        queryParams.set('dateFrom', fromTimestamp.toString())
        queryParams.set('dateTo', toTimestamp.toString())
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
