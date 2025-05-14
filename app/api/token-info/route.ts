import { NextResponse } from 'next/server'
import type { TokenInfo } from '@/lib/token-data'

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
  console.log('Token info API called')
  
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('address')
    console.log('Received token:', token)
    
    if (!token) {
      console.error('No token provided')
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      )
    }

    // Decode the token address
    const address = decodeURIComponent(token)
    console.log('Decoded address:', address)

    // Check cache first
    if (tokenInfoCache[address] && isCacheValid(tokenInfoCache[address].timestamp)) {
      console.log(`Using cached token info for ${address}`)
      return NextResponse.json(tokenInfoCache[address].data)
    }

    console.log(`Fetching token info for address: ${address}`)
    
    // Fetch from DexScreener
    const dexscreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${address}`
    console.log('Fetching from DexScreener:', dexscreenerUrl)
    
    const response = await fetch(
      dexscreenerUrl,
      {
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
      }
    )

    if (!response.ok) {
      console.error(`Error fetching data from Dexscreener: ${response.status}`)
      // Return default response instead of error
      const defaultTokenInfo = trimTokenData({
        baseToken: {
          address: address,
          name: 'Unknown Token',
          symbol: 'UNKNOWN',
        },
        priceUsd: '0',
        transactions: { buys: 0, sells: 0 },
        volume: { h24: 0 },
        priceChange: { h24: 0 },
        liquidity: { usd: 0 },
        mintAddress: '',
        marketInfo: {
          marketCap: 0,
          fdv: 0,
          pairCreatedAt: 0,
        },
        info: {
          websites: [],
          socials: [],
        },
      })

      // Update cache
      tokenInfoCache[address] = {
        data: defaultTokenInfo,
        timestamp: Date.now()
      }

      return NextResponse.json(defaultTokenInfo)
    }

    const data = await response.json()
    console.log('Received data from DexScreener:', JSON.stringify(data, null, 2))
    
    const pairs = data.pairs

    if (!pairs || pairs.length === 0) {
      console.log(`No trading pairs found for address: ${address}`)
      // Return a default response instead of 404
      const defaultTokenInfo = trimTokenData({
        baseToken: {
          address: address,
          name: 'Unknown Token',
          symbol: 'UNKNOWN',
        },
        priceUsd: '0',
        transactions: { buys: 0, sells: 0 },
        volume: { h24: 0 },
        priceChange: { h24: 0 },
        liquidity: { usd: 0 },
        mintAddress: '',
        marketInfo: {
          marketCap: 0,
          fdv: 0,
          pairCreatedAt: 0,
        },
        info: {
          websites: [],
          socials: [],
        },
      })

      // Update cache
      tokenInfoCache[address] = {
        data: defaultTokenInfo,
        timestamp: Date.now()
      }

      return NextResponse.json(defaultTokenInfo)
    }

    // Map the first pair to our TokenInfo format and trim the data
    const pair = pairs[0]
    const tokenInfo = trimTokenData({
      baseToken: {
        address: pair.baseToken?.address || address,
        name: pair.baseToken?.name || 'Unknown',
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
      },
      priceUsd: pair.priceUsd || '0',
      transactions: pair.txns || { buys: 0, sells: 0 },
      volume: pair.volume || { h24: 0 },
      priceChange: pair.priceChange || { h24: 0 },
      liquidity: pair.liquidity || { usd: 0 },
      mintAddress: pair.pairAddress || '',
      marketInfo: {
        marketCap: pair.marketCap || 0,
        fdv: pair.fdv || 0,
        pairCreatedAt: pair.pairCreatedAt || 0,
      },
      info: {
        websites: pair.info?.websites || [],
        socials: pair.info?.socials || [],
      },
    })

    console.log('Processed token info:', JSON.stringify(tokenInfo, null, 2))

    // Update cache
    tokenInfoCache[address] = {
      data: tokenInfo,
      timestamp: Date.now()
    }

    return NextResponse.json(tokenInfo)
  } catch (error) {
    console.error('Error in token info API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch token info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 