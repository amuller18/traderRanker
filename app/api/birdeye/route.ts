import { NextResponse } from "next/server"

// Rate limiting
let lastRequestTime = 0
const RATE_LIMIT_DELAY = 1000 // 1 second delay between requests

// Helper function to enforce rate limit
async function enforceRateLimit() {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest))
  }
  lastRequestTime = Date.now()
}

// Get API keys from environment
function getApiKeys() {
  const apiKeys = process.env.BIRDEYE_API_KEYS
  if (!apiKeys) {
    throw new Error("BIRDEYE_API_KEYS is not configured")
  }
  return apiKeys.split(',').map(key => key.trim())
}

// Keep track of which key was last used
let currentKeyIndex = 0

// Type definitions for Birdeye API response
interface BirdeyeHistoricalItem {
  address: string
  unixTime: number
  value: number
}

interface BirdeyeResponse {
  success: boolean
  data: {
    items: BirdeyeHistoricalItem[]
  }
}

// Helper function to make Birdeye API request
async function makeBirdeyeRequest(endpoint: string, params: Record<string, string> = {}) {
  const apiKeys = getApiKeys()
  if (apiKeys.length === 0) {
    throw new Error("No Birdeye API keys configured")
  }

  let lastError = null
  const maxRetries = apiKeys.length // Try each key once

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Rotate through API keys
      const apiKey = apiKeys[currentKeyIndex]
      currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length

      // Build query string
      const queryParams = new URLSearchParams({
        address: endpoint,
        address_type: 'token',
        type: '1m',
        ...params
      })

      const response = await fetch(
        `https://public-api.birdeye.so/defi/history_price?${queryParams}`,
        {
          headers: {
            'X-API-KEY': apiKey,
            'Accept': 'application/json',
            'x-chain': 'solana'
          },
        }
      )

      if (response.status === 401) {
        console.warn(`API key ${currentKeyIndex} returned 401, trying next key...`)
        lastError = new Error(`Birdeye API error (401): API key ${currentKeyIndex} is invalid or suspended`)
        continue // Try next key
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Birdeye API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      return data as BirdeyeResponse
    } catch (error) {
      lastError = error
      if (error instanceof Error && error.message.includes('401')) {
        continue // Try next key
      }
      throw error // Re-throw if it's not a 401 error
    }
  }

  // If we've tried all keys and still failed
  throw lastError || new Error("All API keys failed")
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")
    const timeFrom = searchParams.get("timeFrom")
    const timeTo = searchParams.get("timeTo")

    if (!address) {
      return NextResponse.json({ error: "Token address is required" }, { status: 400 })
    }

    // Enforce rate limit
    await enforceRateLimit()

    console.log(`Fetching Birdeye data for: ${address}`)
    
    // Fetch historical price data
    const response = await makeBirdeyeRequest(address, {
      time_from: timeFrom || Math.floor(Date.now() / 1000 - 24 * 60 * 60).toString(), // Default to 24h ago
      time_to: timeTo || Math.floor(Date.now() / 1000).toString() // Default to now
    })

    // Check if response has the expected structure
    if (!response.success || !response.data?.items) {
      console.error("Invalid response format:", response)
      throw new Error("Invalid historical data format")
    }

    const historicalData = response.data.items

    // Calculate ATH and ATL from historical data
    const prices = historicalData.map(item => item.value)
    const ath = Math.max(...prices)
    const atl = Math.min(...prices)
    const currentPrice = prices[prices.length - 1] || 0

    // Calculate 24h change
    const price24hAgo = prices[0] || currentPrice
    const priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100

    return NextResponse.json({
      currentPrice,
      priceChange24h,
      ath,
      atl,
      historicalData: historicalData.map(item => ({
        timestamp: item.unixTime,
        price: item.value
      }))
    })
  } catch (error) {
    console.error("Error in Birdeye API:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch Birdeye data", 
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 