import { NextRequest, NextResponse } from 'next/server'

interface TokenPriceResponse {
  [tokenAddress: string]: {
    usd: number
  }
}

interface BulkPriceResult {
  token: string
  price: number
  marketCap: number
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { tokens } = await request.json()
    
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Invalid tokens array' }, { status: 400 })
    }

    // CoinGecko API has a limit of 100 tokens per request
    const BATCH_SIZE = 100
    const results: BulkPriceResult[] = []

    // Process tokens in batches
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE)
      const contractAddresses = batch.join(',')
      
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${contractAddresses}&vs_currencies=usd`,
          {
            headers: {
              'accept': 'application/json',
              'x-cg-demo-api-key': 'CG-8jAASUaSyaz4VEsDjonVgjNr'
            }
          }
        )

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`)
        }

        const priceData: TokenPriceResponse = await response.json()

        // Process each token in the batch
        for (const token of batch) {
          const tokenPrice = priceData[token]
          
          if (tokenPrice && tokenPrice.usd) {
            // Get supply information from existing API
            try {
              const supplyResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/token-supply?address=${token}`,
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
                marketCap
              })
            } catch (supplyError) {
              console.error(`Error fetching supply for ${token}:`, supplyError)
              // Use default supply calculation
              const marketCap = tokenPrice.usd * 1e9
              results.push({
                token,
                price: tokenPrice.usd,
                marketCap
              })
            }
          } else {
            results.push({
              token,
              price: 0,
              marketCap: 0,
              error: 'Price not available'
            })
          }
        }

        // Add delay between batches to respect rate limits
        if (i + BATCH_SIZE < tokens.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (batchError) {
        console.error(`Error processing batch ${i}-${i + BATCH_SIZE}:`, batchError)
        
        // Add error results for this batch
        for (const token of batch) {
          results.push({
            token,
            price: 0,
            marketCap: 0,
            error: 'Batch processing failed'
          })
        }
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Bulk price update error:', error)
    return NextResponse.json(
      { error: 'Failed to update prices' },
      { status: 500 }
    )
  }
} 