import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trader = searchParams.get('trader')

    if (!trader) {
      return NextResponse.json({ error: 'Trader parameter is required' }, { status: 400 })
    }

    // Fetch trades from Python backend - no price fetching here, let client handle it
    const encodedTrader = encodeURIComponent(trader)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const tradesResponse = await fetch(`${backendUrl}/api/traders/${encodedTrader}/trades`, {
      cache: 'no-store'
    })

    if (!tradesResponse.ok) {
      throw new Error(`Failed to fetch trades: ${tradesResponse.status}`)
    }

    const trades = await tradesResponse.json()
    return NextResponse.json(trades)
  } catch (error) {
    console.error('Error fetching trader trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trader trades' },
      { status: 500 }
    )
  }
} 