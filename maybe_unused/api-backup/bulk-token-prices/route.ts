import { NextRequest, NextResponse } from 'next/server'

interface TokenPriceResponse {
  [tokenAddress: string]: {
    usd: number
  }
}

interface TokenPriceResult {
  token: string
  price: number
  market_cap: number
  error?: string
}

async function tryBirdeyeFallback(token: string): Promise<TokenPriceResult | null> {
  try {
    console.log(`🔍 Trying Birdeye fallback for: ${token}`)
    
    const response = await fetch(
      `https://public-api.birdeye.so/public/token_price?address=${token}`,
      {
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY || 'ebe13bbb49954dc1a7dcee52bbe64b01',
          'accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      console.warn(`Birdeye API error for ${token}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const price = data.data?.value || 0

    if (!price || price === 0) {
      console.warn(`No price data from Birdeye for ${token}`)
      return null
    }

    // Try to get supply for market cap calculation
    let supply = 1e9
    try {
      const supplyResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/token-supply?address=${token}`,
        { cache: 'no-store' }
      )
      
      if (supplyResponse.ok) {
        const supplyData = await supplyResponse.json()
        supply = supplyData.circulating_supply || supplyData.total_supply || 1e9
      }
    } catch (error) {
      console.warn(`Could not fetch supply for ${token} from API in Birdeye fallback:`, error)
    }

    const marketCap = price * supply
    console.log(`✅ Birdeye fallback success for ${token}: price=$${price}, market_cap=$${marketCap}`)
    
    return {
      token,
      price,
      market_cap: marketCap
    }

  } catch (error) {
    console.error(`Error in Birdeye fallback for ${token}:`, error)
    return null
  }
}

async function tryDexScreener(token: string): Promise<TokenPriceResult | null> {
  try {
    console.log(`🔍 Trying DexScreener for: ${token}`)
    
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${token}`,
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
      console.warn(`DexScreener API error for ${token}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const pairs = data.pairs || []

    if (!pairs || pairs.length === 0) {
      console.warn(`No trading pairs found in DexScreener for ${token}`)
      return null
    }

    // Get the first pair with valid market cap data
    for (const pair of pairs) {
      const marketCap = pair.marketCap || 0
      const fdv = pair.fdv || 0
      const priceUsd = pair.priceUsd || '0'

      // Use the first valid market cap or FDV
      if (marketCap && marketCap > 0) {
        const price = parseFloat(priceUsd) || 0
        console.log(`✅ DexScreener success for ${token}: price=$${price}, market_cap=$${marketCap}`)
        return {
          token,
          price,
          market_cap: marketCap
        }
      } else if (fdv && fdv > 0) {
        const price = parseFloat(priceUsd) || 0
        console.log(`✅ DexScreener success for ${token}: price=$${price}, fdv=$${fdv}`)
        return {
          token,
          price,
          market_cap: fdv
        }
      }
    }

    console.warn(`No valid market cap data in DexScreener for ${token}`)
    return null

  } catch (error) {
    console.error(`Error in DexScreener for ${token}:`, error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tokens } = await request.json()
    
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Invalid tokens array' }, { status: 400 })
    }

    const results: TokenPriceResult[] = []

    // Process tokens individually to avoid rate limits and get better coverage
    for (const token of tokens) {
      try {
        // Start with DexScreener (best for Solana tokens)
        console.log(`🔍 Trying DexScreener for: ${token}`)
        const dexscreenerResult = await tryDexScreener(token)
        if (dexscreenerResult) {
          results.push(dexscreenerResult)
          continue
        }

        // Try Birdeye as fallback
        console.log(`DexScreener no data for ${token}, trying Birdeye...`)
        const birdeyeResult = await tryBirdeyeFallback(token)
        if (birdeyeResult) {
          results.push(birdeyeResult)
          continue
        }

        // Try CoinGecko as last resort (only for major tokens)
        console.log(`Birdeye no data for ${token}, trying CoinGecko...`)
        try {
          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${token}&vs_currencies=usd`,
            {
              headers: {
                'accept': 'application/json',
                'x-cg-demo-api-key': 'CG-8jAASUaSyaz4VEsDjonVgjNr'
              },
              cache: 'no-store'
            }
          )

          if (response.ok) {
            const priceData: TokenPriceResponse = await response.json()
            const tokenPrice = priceData[token]
            
            if (tokenPrice && tokenPrice.usd) {
              // Get supply information from existing API
              try {
                const supplyResponse = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/token-supply?address=${token}`,
                  { cache: 'no-store' }
                )
                
                let supply = 1e9 // Default supply if API fails
                if (supplyResponse.ok) {
                  const supplyData = await supplyResponse.json()
                  supply = supplyData.circulating_supply || supplyData.total_supply || 1e9
                }

                const marketCap = tokenPrice.usd * supply
                
                results.push({
                  token,
                  price: tokenPrice.usd,
                  market_cap: marketCap
                })
                continue
              } catch (supplyError) {
                console.error(`Error fetching supply for ${token}:`, supplyError)
                // Use default supply calculation
                const marketCap = tokenPrice.usd * 1e9
                results.push({
                  token,
                  price: tokenPrice.usd,
                  market_cap: marketCap
                })
                continue
              }
            }
          }
        } catch (coingeckoError) {
          console.log(`CoinGecko failed for ${token}:`, coingeckoError)
        }

        // If all APIs fail, add error result
        results.push({
          token,
          price: 0,
          market_cap: 0,
          error: 'Price not available from DexScreener, Birdeye, or CoinGecko'
        })

      } catch (tokenError) {
        console.error(`Error processing token ${token}:`, tokenError)
        results.push({
          token,
          price: 0,
          market_cap: 0,
          error: 'Token processing failed'
        })
      }

      // Add small delay between tokens to be respectful to APIs
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Bulk token prices error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch token prices' },
      { status: 500 }
    )
  }
} 