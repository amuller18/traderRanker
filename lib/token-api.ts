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
 * Fetches token information from DexScreener v1 API
 * Uses the new /tokens/v1/{chainId}/{tokenAddresses} endpoint
 * Rate limit: 300 requests per minute
 */
export async function getTokenInfo(contractAddress: string): Promise<TokenInfo[] | null> {
  try {
    console.log(`Fetching token info for: ${contractAddress}`)

    // Use DexScreener v1 API for Solana tokens (optimized - no fallbacks for speed)
    const url = `https://api.dexscreener.com/tokens/v1/solana/${contractAddress}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.log(`DexScreener v1 API failed for ${contractAddress}: ${response.status}`)
      return null
    }

    const data = await response.json()

    // v1 API returns array of pairs directly (not wrapped in 'pairs' key)
    const pairs = Array.isArray(data) ? data : data.pairs

    if (!pairs || pairs.length === 0) {
      console.log(`No trading pairs found in DexScreener v1 for ${contractAddress}`)
      return null
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
      const marketCap = pair.marketCap || pair.fdv || 0
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
    return null
  }
}

/**
 * Fetches token information from CoinGecko API as fallback
 */
async function getCoinGeckoTokenInfo(contractAddress: string): Promise<TokenInfo[] | null> {
  try {
    console.log(`🔍 Fetching token info from CoinGecko for: ${contractAddress}`)
    
    // Get price from CoinGecko
    const priceResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${contractAddress}&vs_currencies=usd`,
      {
        headers: {
          'accept': 'application/json',
          'x-cg-demo-api-key': 'CG-8jAASUaSyaz4VEsDjonVgjNr'
        },
        cache: 'no-store',
      }
    )

    if (!priceResponse.ok) {
      console.log(`❌ CoinGecko price API failed for ${contractAddress}: ${priceResponse.status}`)
      return await getJupiterTokenInfo(contractAddress)
    }

    const priceData = await priceResponse.json()
    const tokenPrice = priceData[contractAddress]
    
    if (!tokenPrice || !tokenPrice.usd) {
      console.log(`❌ No price data from CoinGecko for ${contractAddress}`)
      return await getJupiterTokenInfo(contractAddress)
    }

    const price = tokenPrice.usd
    console.log(`💰 CoinGecko price for ${contractAddress}: $${price}`)

    // Calculate market cap using supply estimation
    let marketCap = 0
    
    // For major tokens like SOL, use known supply
    if (contractAddress === "So11111111111111111111111111111111111111112") {
      // SOL has approximately 580 million circulating supply
      const solSupply = 580_000_000
      marketCap = price * solSupply
      console.log(`💰 Using known SOL supply: ${solSupply.toLocaleString()}`)
    } else {
      // Try to get supply from our API
      try {
        const supplyResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/token-supply?address=${contractAddress}`,
          { cache: 'no-store' }
        )
        
        if (supplyResponse.ok) {
          const supplyData = await supplyResponse.json()
          const supply = supplyData.circulating_supply || supplyData.total_supply || 1e9
          marketCap = price * supply
          console.log(`📊 Supply from API for ${contractAddress}: ${supply.toLocaleString()}`)
        } else {
          // Use default supply calculation
          const defaultSupply = 1e9
          marketCap = price * defaultSupply
          console.log(`⚠️ Using default supply for ${contractAddress}: ${defaultSupply.toLocaleString()}`)
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch supply for ${contractAddress}, using default`)
        const defaultSupply = 1e9
        marketCap = price * defaultSupply
      }
    }

    console.log(`💰 Calculated market cap for ${contractAddress}: $${marketCap.toLocaleString()}`)

    // Create TokenInfo object
    const tokenInfo: TokenInfo = {
      baseToken: {
        address: contractAddress,
        name: contractAddress === "So11111111111111111111111111111111111111112" ? "Wrapped SOL" : "Unknown",
        symbol: contractAddress === "So11111111111111111111111111111111111111112" ? "SOL" : "UNKNOWN",
      },
      priceUsd: price.toString(),
      transactions: { buys: 0, sells: 0 },
      volume: { h24: 0 },
      priceChange: { h24: 0 },
      liquidity: { usd: 0 },
      mintAddress: contractAddress,
      marketInfo: {
        marketCap: marketCap,
        fdv: marketCap,
        pairCreatedAt: 0,
      },
      info: {
        websites: [],
        socials: [],
      },
    }

    console.log(`✅ CoinGecko fallback completed for ${contractAddress}`)
    return [tokenInfo]
  } catch (error) {
    console.error(`❌ Error in CoinGecko fallback for ${contractAddress}:`, error)
    return await getJupiterTokenInfo(contractAddress)
  }
}

/**
 * Fetches token information from Jupiter API as fallback
 */
export async function getJupiterTokenInfo(contractAddress: string): Promise<TokenInfo[] | null> {
  try {
    console.log(`🔍 Fetching token info from Jupiter for: ${contractAddress}`)
    
    // Get token list from Jupiter's new API endpoint
    const tokenListResponse = await fetch("https://token.jup.ag/strict", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })
    
    if (!tokenListResponse.ok) {
      console.error(`❌ Error fetching Jupiter token list: ${tokenListResponse.status}`)
      return null
    }

    const tokens = await tokenListResponse.json()
    const token = tokens.find((t: any) => t.address === contractAddress)

    if (!token) {
      console.log(`❌ Token not found in Jupiter: ${contractAddress}`)
      return null
    }

    console.log(`✅ Token found in Jupiter: ${token.symbol} (${token.name})`)

    let price = 0
    let marketCap = 0

    // Try to get price from Jupiter's price API
    try {
      console.log(`🔍 Fetching price from Jupiter for: ${contractAddress}`)
      const priceResponse = await fetch(`https://price.jup.ag/v4/price?ids=${contractAddress}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })
      
      if (priceResponse.ok) {
        const priceData = await priceResponse.json()
        console.log(`📊 Jupiter price response:`, priceData)
        
        if (priceData.data && priceData.data[contractAddress]) {
          price = priceData.data[contractAddress].price
          console.log(`💰 Jupiter price for ${contractAddress}: $${price}`)
        } else {
          console.log(`⚠️ No price data found for ${contractAddress} in Jupiter response`)
        }
      } else {
        console.log(`❌ Jupiter price API error: ${priceResponse.status}`)
      }
    } catch (error) {
      console.error(`❌ Error fetching price from Jupiter for ${contractAddress}:`, error)
    }

    // Try to get supply information to calculate market cap
    try {
      console.log(`🔍 Fetching supply for: ${contractAddress}`)
      const supply = await getTokenSupply(contractAddress)
      console.log(`📊 Supply for ${contractAddress}: ${supply}`)
      
      if (supply > 0 && price > 0) {
        marketCap = price * supply
        console.log(`💰 Calculated market cap for ${contractAddress}: $${marketCap.toLocaleString()} (price: $${price}, supply: ${supply.toLocaleString()})`)
      } else if (price > 0) {
        // Use default supply of 1 billion for calculation
        marketCap = price * 1_000_000_000
        console.log(`💰 Using default supply calculation for ${contractAddress}: $${marketCap.toLocaleString()}`)
      }
    } catch (error) {
      console.error(`❌ Error fetching supply for ${contractAddress}:`, error)
      // Use default supply of 1 billion for calculation
      if (price > 0) {
        marketCap = price * 1_000_000_000
        console.log(`💰 Using default supply calculation for ${contractAddress}: $${marketCap.toLocaleString()}`)
      }
    }

    // Create a TokenInfo object from Jupiter data
    const tokenInfo: TokenInfo = {
      baseToken: {
        address: token.address,
        name: token.name || "Unknown",
        symbol: token.symbol || "UNKNOWN",
      },
      priceUsd: price.toString(),
      transactions: { buys: 0, sells: 0 },
      volume: { h24: 0 },
      priceChange: { h24: 0 },
      liquidity: { usd: 0 },
      mintAddress: token.address,
      marketInfo: {
        marketCap: marketCap,
        fdv: marketCap, // Use same value for FDV
        pairCreatedAt: 0,
      },
      info: {
        websites: [],
        socials: [],
      },
    }

    console.log(`✅ Jupiter fallback completed for ${contractAddress}:`, {
      price: price,
      marketCap: marketCap,
      symbol: token.symbol
    })

    return [tokenInfo]
  } catch (error) {
    console.error(`❌ Error in Jupiter fallback for ${contractAddress}:`, error)
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

    // First try DexScreener v1 API
    console.log('\n1. Trying DexScreener v1 API...')
    const dexScreenerResponse = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${contractAddress}`)
    const dexData = await dexScreenerResponse.json()

    // v1 API returns array directly
    const pairs = Array.isArray(dexData) ? dexData : dexData.pairs
    if (pairs && pairs.length > 0) {
      const pair = pairs[0]
      const supply = pair.marketInfo?.supply || pair.liquidity?.usd || pair.priceUsd
      if (supply) {
        console.log('\nFound supply from DexScreener v1:', supply)
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

