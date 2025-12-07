import { NextRequest, NextResponse } from 'next/server'

interface Trade {
  ca: string
  caller: string
  current_mc?: number
  [key: string]: any
}

interface TokenPriceResult {
  token: string
  price: number
  market_cap: number
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Forward all query parameters to Python backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const queryString = searchParams.toString()
    const tradesResponse = await fetch(
      `${backendUrl}/api/trades/filtered${queryString ? `?${queryString}` : ''}`,
      { cache: 'no-store' }
    )

    if (!tradesResponse.ok) {
      throw new Error(`Failed to fetch filtered trades: ${tradesResponse.status}`)
    }

    const trades: Trade[] = await tradesResponse.json()

    if (!trades || trades.length === 0) {
      return NextResponse.json([])
    }

    // Extract unique token addresses
    const uniqueTokens = [...new Set(trades.map(trade => trade.ca))]

    // Fetch current prices for all tokens using bulk API
    const pricesResponse = await fetch(`${backendUrl}/api/bulk-token-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens: uniqueTokens }),
      cache: 'no-store'
    })

    if (!pricesResponse.ok) {
      console.warn('Failed to fetch bulk prices, returning trades without current_mc updates')
      return NextResponse.json(trades)
    }

    const priceResults: TokenPriceResult[] = await pricesResponse.json()

    // Create a map of token address to current market cap
    const priceMap = new Map<string, number>()
    for (const result of priceResults) {
      if (result.market_cap > 0) {
        priceMap.set(result.token, result.market_cap)
      }
    }

    // Update trades with current market caps
    const updatedTrades = trades.map(trade => ({
      ...trade,
      current_mc: priceMap.get(trade.ca) || trade.current_mc || 0
    }))

    console.log(`✅ Updated ${updatedTrades.filter(t => t.current_mc > 0).length}/${trades.length} filtered trades with current market caps`)

    return NextResponse.json(updatedTrades)
  } catch (error) {
    console.error('Error fetching filtered trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filtered trades' },
      { status: 500 }
    )
  }
}
