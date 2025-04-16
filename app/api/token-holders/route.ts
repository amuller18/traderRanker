import { NextResponse } from "next/server"

// Update the RPC_ENDPOINTS array to use reliable public endpoints
const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
]

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

// Helper function to sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Function to make RPC request with retry logic
async function makeRpcRequest(method: string, params: any[], retries = MAX_RETRIES, backoff = INITIAL_BACKOFF_MS) {
  // Try each endpoint in sequence
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      // If rate limited, try next endpoint or retry
      if (response.status === 429) {
        console.warn(`Rate limited by ${endpoint}, trying next endpoint or retrying...`)
        continue
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
      }

      return data.result
    } catch (error) {
      console.error(`Error with endpoint ${endpoint}:`, error)
      // Continue to next endpoint
    }
  }

  // If we've tried all endpoints and still failed, retry with backoff
  if (retries > 0) {
    console.log(`All endpoints failed, retrying in ${backoff}ms... (${retries} retries left)`)
    await sleep(backoff)
    return makeRpcRequest(method, params, retries - 1, backoff * 2)
  }

  // If all retries failed, throw error
  throw new Error(`Failed to fetch data after ${MAX_RETRIES} retries with all endpoints`)
}

// Function to fetch token supply
async function fetchTokenSupply(tokenAddress: string) {
  try {
    const result = await makeRpcRequest("getTokenSupply", [tokenAddress])
    return result.value
  } catch (error) {
    console.error("Error fetching token supply:", error)
    throw error
  }
}

// Function to fetch largest token accounts
async function fetchLargestAccounts(tokenAddress: string) {
  try {
    const result = await makeRpcRequest("getTokenLargestAccounts", [tokenAddress])
    return result.value
  } catch (error) {
    console.error("Error fetching largest accounts:", error)
    throw error
  }
}

// Function to calculate holder distribution statistics
function calculateHolderStats(holders: any[], totalSupply: number) {
  if (!holders || holders.length === 0) {
    return {
      totalHolders: 0,
      topHolderPercentage: 0,
      top10HolderPercentage: 0,
      distributionData: [],
    }
  }

  // Sort holders by amount (descending)
  const sortedHolders = [...holders].sort((a, b) => b.uiAmount - a.uiAmount)

  // Calculate percentages for each holder
  const holdersWithPercentage = sortedHolders.map((holder) => {
    const percentage = (holder.uiAmount / totalSupply) * 100
    return {
      ...holder,
      owner: holder.address,
      owner_supply: holder.uiAmount,
      owner_supply_percentage: percentage,
    }
  })

  // Calculate top holder percentage
  const topHolder = holdersWithPercentage[0]
  const topHolderPercentage = topHolder ? topHolder.owner_supply_percentage : 0

  // Calculate top 10 holders percentage (or as many as we have up to 10)
  const top10Holders = holdersWithPercentage.slice(0, Math.min(10, holdersWithPercentage.length))
  const top10HolderPercentage = top10Holders.reduce((sum, holder) => sum + holder.owner_supply_percentage, 0)

  // Create distribution data for pie chart
  const distributionData = [
    { name: "Top Holder", value: topHolderPercentage, color: "#ef4444" },
    { name: "Top 2-10", value: top10HolderPercentage - topHolderPercentage, color: "#f97316" },
    { name: "Remaining", value: 100 - top10HolderPercentage, color: "#3b82f6" },
  ]

  return {
    totalHolders: holders.length,
    topHolderPercentage,
    top10HolderPercentage,
    distributionData,
    holders: holdersWithPercentage,
  }
}

// Simple in-memory cache with expiration
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    // Get token address from query parameter
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address) {
      return NextResponse.json({ error: "Token address is required" }, { status: 400 })
    }

    // Check cache first
    const cacheKey = `token-holders-${address}`
    const cachedData = cache.get(cacheKey)

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
      console.log(`Using cached data for ${address}`)
      return NextResponse.json(cachedData.data)
    }

    // Fetch token supply and largest accounts in parallel
    const [supplyData, largestAccounts] = await Promise.all([fetchTokenSupply(address), fetchLargestAccounts(address)])

    // Extract total supply
    const totalSupply = supplyData.uiAmount || 0

    // Calculate statistics
    const stats = calculateHolderStats(largestAccounts, totalSupply)

    // Prepare response data
    const responseData = {
      topHolders: stats.holders || [],
      stats: {
        totalHolders: stats.totalHolders,
        topHolderPercentage: stats.topHolderPercentage,
        top10HolderPercentage: stats.top10HolderPercentage,
        distributionData: stats.distributionData,
      },
      totalHolders: stats.totalHolders,
    }

    // Update cache
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
    })

    // Return the top holders and statistics
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error in token holders API:", error)

    // Provide a more user-friendly error message
    let errorMessage = "Failed to fetch token holder data"
    if (error instanceof Error) {
      if (error.message.includes("429") || error.message.includes("rate limit")) {
        errorMessage = "Rate limit exceeded. Please try again later."
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    )
  }
}

