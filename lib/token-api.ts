/**
 * Token API service for fetching token information from external APIs
 * Based on the provided Python implementation
 */

// Type definitions for token data
export interface TokenInfo {
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  priceUsd: string
  transactions?: {
    h1?: { buys: number; sells: number }
    h24?: { buys: number; sells: number }
    h6?: { buys: number; sells: number }
    h12?: { buys: number; sells: number }
    m5?: { buys: number; sells: number }
    buys?: number
    sells?: number
  }
  volume?: {
    h24?: number
    h6?: number
    h1?: number
    h12?: number
    m5?: number
  }
  priceChange?: {
    h24?: number
    h6?: number
    h1?: number
    h12?: number
    m5?: number
  }
  liquidity?: {
    usd?: number
    base?: number
    quote?: number
  }
  mintAddress?: string
  marketInfo: {
    marketCap?: number
    fdv?: number
    pairCreatedAt?: number
  }
  info: {
    websites?: string[]
    socials?: Array<string | { twitter?: string; telegram?: string; discord?: string }>
  }
}

/**
 * Fetches token information from DexScreener API
 */
export async function getTokenInfo(contractAddress: string): Promise<TokenInfo[] | null> {
  try {
    console.log(`Fetching token info for: ${contractAddress}`)

    // Try DexScreener first
    const url = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Referer': 'https://dexscreener.com/',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://dexscreener.com',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.log(`DexScreener failed for ${contractAddress} - likely low market cap or no liquidity`)
      // Try Jupiter as fallback
      return await getJupiterTokenInfo(contractAddress)
    }

    const data = await response.json()
    const pairs = data.pairs

    if (!pairs || pairs.length === 0) {
      console.log(`No trading pairs found in DexScreener for ${contractAddress} - likely low market cap or no liquidity`)
      return await getJupiterTokenInfo(contractAddress)
    }

    // Map the pairs to our TokenInfo format
    const tokenInformation: TokenInfo[] = pairs.map((pair: any) => {
      // Handle transactions data which might be in different formats
      let transactions = pair.txns

      // If transactions is in the format with h24, h1, etc.
      if (transactions && typeof transactions === "object") {
        // Check if it has h24 property
        if (transactions.h24) {
          transactions = {
            ...transactions,
            buys: transactions.h24.buys,
            sells: transactions.h24.sells,
          }
        }
      }

      // Log market cap for debugging
      const marketCap = pair.marketCap || 0
      if (marketCap < 10000) {
        console.log(`Low market cap detected for ${contractAddress}: $${marketCap}`)
      }

      return {
        baseToken: {
          address: pair.baseToken?.address || contractAddress,
          name: pair.baseToken?.name || "Unknown",
          symbol: pair.baseToken?.symbol || "UNKNOWN",
        },
        priceUsd: pair.priceUsd || "0",
        transactions: transactions || { buys: 0, sells: 0 },
        volume: pair.volume || { h24: 0 },
        priceChange: pair.priceChange || { h24: 0 },
        liquidity: pair.liquidity || { usd: 0 },
        mintAddress: pair.pairAddress || "",
        marketInfo: {
          marketCap: marketCap,
          fdv: pair.fdv || 0,
          pairCreatedAt: pair.pairCreatedAt || 0,
        },
        info: {
          websites: pair.info?.websites || [],
          socials: pair.info?.socials || [],
        },
      }
    })

    return tokenInformation
  } catch (error) {
    console.error(`Error fetching token info: ${error}`)
    // Try Jupiter as fallback
    return await getJupiterTokenInfo(contractAddress)
  }
}

/**
 * Fetches token information from Jupiter API as fallback
 */
async function getJupiterTokenInfo(contractAddress: string): Promise<TokenInfo[] | null> {
  try {
    console.log(`Fetching token info from Jupiter for: ${contractAddress} (likely low market cap token)`)
    
    // Get token list from Jupiter's new API endpoint
    const response = await fetch("https://token.jup.ag/strict")
    if (!response.ok) {
      console.error(`Error fetching Jupiter token list: ${response.status}`)
      return null
    }

    const tokens = await response.json()
    const token = tokens.find((t: any) => t.address === contractAddress)

    if (!token) {
      console.log(`Token not found in Jupiter: ${contractAddress} - may be very new or delisted`)
      return null
    }

    // Create a TokenInfo object from Jupiter data
    const tokenInfo: TokenInfo = {
      baseToken: {
        address: token.address,
        name: token.name || "Unknown",
        symbol: token.symbol || "UNKNOWN",
      },
      priceUsd: "0", // Jupiter doesn't provide price directly
      transactions: { buys: 0, sells: 0 },
      volume: { h24: 0 },
      priceChange: { h24: 0 },
      liquidity: { usd: 0 },
      mintAddress: token.address,
      marketInfo: {
        marketCap: 0, // Explicitly set to 0 for low market cap tokens
        fdv: 0,
        pairCreatedAt: 0,
      },
      info: {
        websites: [],
        socials: [],
      },
    }

    // Try to get price from Jupiter's price API
    try {
      const priceResponse = await fetch(`https://price.jup.ag/v4/price?ids=${contractAddress}`)
      if (priceResponse.ok) {
        const priceData = await priceResponse.json()
        if (priceData.data[contractAddress]) {
          tokenInfo.priceUsd = priceData.data[contractAddress].price.toString()
        }
      }
    } catch (error) {
      console.log(`Could not fetch price from Jupiter for ${contractAddress}`)
    }

    return [tokenInfo]
  } catch (error) {
    console.error(`Error fetching Jupiter token info: ${error}`)
    return null
  }
}

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

/**
 * Fetches token supply from Solana RPC API with fallbacks
 */
export async function getTokenSupply(contractAddress: string): Promise<number> {
  try {
    // Check cache first
    const cacheKey = `supply-${contractAddress}`
    const cachedData = cache.get(cacheKey)
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log('Using cached supply data')
      return cachedData.data
    }

    console.log('=== TOKEN SUPPLY DEBUG ===')
    console.log(`Token Address: ${contractAddress}`)
    
    // First try DexScreener
    console.log('\n1. Trying DexScreener...')
    const dexScreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`)
    const dexData = await dexScreenerResponse.json()
    
    if (dexData.pairs && dexData.pairs.length > 0) {
      const pair = dexData.pairs[0]
      const supply = pair.marketInfo?.supply || pair.liquidity?.usd || pair.priceUsd
      if (supply) {
        console.log('\nFound supply from DexScreener:', supply)
        const finalSupply = Number(supply)
        cache.set(cacheKey, {
          data: finalSupply,
          timestamp: Date.now()
        })
        return finalSupply
      }
    }

    // Fallback to Solana RPC
    console.log('\n2. Trying Solana RPC...')
    const result = await makeRpcRequest("getTokenSupply", [contractAddress])
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
    cache.set(cacheKey, {
      data: finalSupply,
      timestamp: Date.now()
    })
    return finalSupply
  } catch (error) {
    console.error(`Error fetching token supply: ${error}`)
    return 0
  }
}

