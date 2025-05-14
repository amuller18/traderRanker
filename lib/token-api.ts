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

/**
 * Fetches token supply from Solana RPC API
 */
export async function getTokenSupply(contractAddress: string): Promise<number> {
  try {
    const url = "https://api.mainnet-beta.solana.com"

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [contractAddress]
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(`Error fetching token supply: ${response.status}`)
      return 0
    }

    const data = await response.json()

    if (data.result?.value?.uiAmountString) {
      return parseFloat(data.result.value.uiAmountString)
    }

    return 0
  } catch (error) {
    console.error(`Error fetching token supply: ${error}`)
    return 0
  }
}

