/**
 * Token API service for fetching token information from external APIs
 * Based on the provided Python implementation
 */
import { getPrimaryRpcEndpoint, logRpcEndpoint } from "@/lib/env"

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

    const url = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Error fetching data from Dexscreener: ${response.status}`)
      return null
    }

    const data = await response.json()

    const pairs = data.pairs
    if (!pairs || pairs.length === 0) {
      console.log(`No trading pairs found for address: ${contractAddress}`)
      return null
    }

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

      return {
        baseToken: {
          address: pair.baseToken?.address || contractAddress,
          name: pair.baseToken?.name || "Unknown",
          symbol: pair.baseToken?.symbol || "UNKNOWN",
        },
        priceUsd: pair.priceUsd || "0",
        transactions: transactions || { buys: 0, sells: 0 },
        volume: pair.volume || { h24: 0, h6: 0, h1: 0 },
        priceChange: pair.priceChange || { h24: 0, h6: 0, h1: 0 },
        liquidity: pair.liquidity || { usd: 0, base: 0, quote: 0 },
        mintAddress: pair.pairAddress || "",
        marketInfo: {
          marketCap: pair.marketCap || 0,
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
 * Fetches token supply from Solana RPC API
 */
export async function getTokenSupply(contractAddress: string): Promise<number> {
  try {
    const url = getPrimaryRpcEndpoint()
    logRpcEndpoint(url)

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [contractAddress],
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

    if (data.result?.value?.uiAmount) {
      return Number.parseInt(data.result.value.uiAmount)
    }

    return 0
  } catch (error) {
    console.error(`Error fetching token supply: ${error}`)
    return 0
  }
}

