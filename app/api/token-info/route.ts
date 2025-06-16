import { NextResponse } from 'next/server'
import { getTokenInfo } from '@/lib/token-api'

// Cache for token info with size limits
const tokenInfoCache: {
  [key: string]: {
    data: any;
    timestamp: number;
  };
} = {};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Maximum cache size (1MB)
const MAX_CACHE_SIZE = 1024 * 1024;

// Function to check if cache is valid
function isCacheValid(timestamp: number): boolean {
  return (Date.now() - timestamp) < CACHE_EXPIRATION;
}

// Function to trim data to reduce size
function trimTokenData(data: any): any {
  // Keep only essential fields and limit array sizes
  return {
    baseToken: {
      address: data.baseToken?.address,
      name: data.baseToken?.name,
      symbol: data.baseToken?.symbol,
    },
    priceUsd: data.priceUsd,
    transactions: {
      buys: data.transactions?.buys || 0,
      sells: data.transactions?.sells || 0,
    },
    volume: {
      h24: data.volume?.h24 || 0,
    },
    priceChange: {
      h24: data.priceChange?.h24 || 0,
    },
    liquidity: {
      usd: data.liquidity?.usd || 0,
    },
    mintAddress: data.mintAddress,
    marketInfo: {
      marketCap: data.marketInfo?.marketCap || 0,
      fdv: data.marketInfo?.fdv || 0,
      pairCreatedAt: data.marketInfo?.pairCreatedAt || 0,
    },
    info: {
      websites: (data.info?.websites || []).slice(0, 3),
      socials: (data.info?.socials || []).slice(0, 3),
    },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address) {
      return NextResponse.json({ error: "Token address is required" }, { status: 400 })
    }

    console.log(`Fetching token info for: ${address}`)
    const tokenInfo = await getTokenInfo(address)

    if (!tokenInfo) {
      return NextResponse.json({ error: "Token info not found" }, { status: 404 })
    }

    return NextResponse.json({ tokenInfo })
  } catch (error) {
    console.error("Error in token info API:", error)
    return NextResponse.json(
      { error: "Failed to fetch token info", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
} 