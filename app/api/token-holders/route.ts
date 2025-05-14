import { NextResponse } from "next/server"

// RPC endpoints
const MAINNET_RPC = "https://api.mainnet-beta.solana.com"
const QUICKNODE_RPC = process.env.QUICKNODE_RPC || "https://api.mainnet-beta.solana.com"

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>()

// Rate limit configuration
const RATE_LIMIT_DELAY = 1000 // 1 second delay between requests
let lastRequestTime = 0

// Helper function to enforce rate limiting
async function enforceRateLimit() {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest))
  }
  lastRequestTime = Date.now()
}

// Function to make RPC request
async function makeRpcRequest(method: string, params: any[], useMainnet = true) {
  try {
    // Check cache first
    const cacheKey = `${method}-${JSON.stringify(params)}-${useMainnet}`
    const cachedData = cache.get(cacheKey)
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log('Using cached data for:', method)
      return cachedData.data
    }

    // Enforce rate limiting
    await enforceRateLimit()

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    // Try mainnet first, fallback to QuickNode if it fails
    const endpoint = useMainnet ? MAINNET_RPC : QUICKNODE_RPC
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // If mainnet fails, try QuickNode as fallback
      if (useMainnet) {
        console.log("Mainnet request failed, falling back to QuickNode...")
        return makeRpcRequest(method, params, false)
      }
      throw new Error(`Failed to fetch data: ${response.status}`)
    }

    const data = await response.json()
    if (data.error) {
      // If mainnet returns error, try QuickNode as fallback
      if (useMainnet) {
        console.log("Mainnet returned error, falling back to QuickNode...")
        return makeRpcRequest(method, params, false)
      }
      throw new Error(data.error.message || 'RPC error')
    }

    // Cache successful response
    cache.set(cacheKey, {
      data: data.result,
      timestamp: Date.now()
    })

    return data.result
  } catch (error) {
    // If mainnet request fails, try QuickNode as fallback
    if (useMainnet) {
      console.log("Mainnet request failed, falling back to QuickNode...")
      return makeRpcRequest(method, params, false)
    }
    console.error("RPC request failed:", error)
    throw error
  }
}

// Function to fetch token supply
async function fetchTokenSupply(tokenAddress: string) {
  try {
    // Check cache first
    const cacheKey = `supply-${tokenAddress}`
    const cachedData = cache.get(cacheKey)
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log('Using cached supply data')
      return cachedData.data
    }

    console.log('=== TOKEN SUPPLY DEBUG ===')
    console.log(`Token Address: ${tokenAddress}`)
    
    // First try DexScreener
    console.log('\n1. Trying DexScreener...')
    const dexScreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`)
    const dexData = await dexScreenerResponse.json()
    
    if (dexData.pairs && dexData.pairs.length > 0) {
      const pair = dexData.pairs[0]
      const supply = pair.marketInfo?.supply || pair.liquidity?.usd || pair.priceUsd
      if (supply) {
        console.log('\nFound supply from DexScreener:', supply)
        const result = { finalSupply: Number(supply) }
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
        return result
      }
    }

    // Fallback to Solana RPC
    console.log('\n2. Trying Solana RPC...')
    const result = await makeRpcRequest("getTokenSupply", [tokenAddress])
    const supply = result.value

    if (!supply) {
      throw new Error('Could not determine token supply')
    }

    let finalSupply = 0
    if (supply.uiAmount !== undefined && supply.uiAmount !== null) {
      finalSupply = supply.uiAmount
    } else if (supply.uiAmountString) {
      finalSupply = parseFloat(supply.uiAmountString)
    } else if (supply.amount && supply.decimals !== undefined) {
      const rawAmount = BigInt(supply.amount)
      const decimals = supply.decimals
      finalSupply = Number(rawAmount) / Math.pow(10, decimals)
    }

    if (finalSupply <= 0) {
      throw new Error('Invalid token supply')
    }

    console.log('\nReturning supply:', finalSupply)
    const response = { finalSupply }
    cache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    })
    return response
  } catch (error) {
    console.error("\nError in fetchTokenSupply:", error)
    throw error
  }
}

// Function to fetch largest token accounts
async function fetchLargestAccounts(tokenAddress: string) {
  try {
    // Check cache first
    const cacheKey = `accounts-${tokenAddress}`
    const cachedData = cache.get(cacheKey)
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log('Using cached accounts data')
      return cachedData.data
    }

    // Use getTokenLargestAccounts method with the token address
    const result = await makeRpcRequest("getTokenLargestAccounts", [tokenAddress])
    
    if (!result || !result.value) {
      throw new Error('Invalid response from getTokenLargestAccounts')
    }

    // Filter and map the results to match our expected format
    const accounts = result.value.map((account: any) => ({
      address: account.address,
      uiAmount: account.uiAmount || 0,
      owner: account.address,
      owner_supply: account.uiAmount || 0,
      owner_supply_percentage: 0 // Will be calculated later
    }))

    // Cache the results
    cache.set(cacheKey, {
      data: accounts,
      timestamp: Date.now()
    })

    return accounts
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address) {
      return NextResponse.json({ error: "Token address is required" }, { status: 400 })
    }

    console.log(`Processing request for token address: ${address}`)

    // Check cache first
    const cacheKey = `token-holders-${address}`
    const cachedData = cache.get(cacheKey)

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`Using cached data for ${address}`)
      return NextResponse.json(cachedData.data)
    }

    try {
      // Fetch token supply and largest accounts in parallel
      const [supplyData, largestAccounts] = await Promise.all([
        fetchTokenSupply(address),
        fetchLargestAccounts(address)
      ])

      // Use the final calculated supply
      const totalSupply = supplyData.finalSupply
      console.log('Total supply used for calculations:', totalSupply)

      if (!totalSupply || totalSupply <= 0) {
        throw new Error('Invalid token supply')
      }

      // Calculate statistics
      const stats = calculateHolderStats(largestAccounts, totalSupply)
      console.log('Calculated holder stats:', {
        totalHolders: stats.totalHolders,
        topHolderPercentage: stats.topHolderPercentage,
        top10HolderPercentage: stats.top10HolderPercentage
      })

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

      return NextResponse.json(responseData)
    } catch (error) {
      console.error('Error processing token holders:', error)
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch token holders data'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in token holders API:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

