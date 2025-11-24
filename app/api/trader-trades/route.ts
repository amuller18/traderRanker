import { NextRequest, NextResponse } from 'next/server'
import { fetchTraderTrades } from '@/lib/api-client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trader = searchParams.get('trader')

    if (!trader) {
      return NextResponse.json({ error: 'Trader parameter is required' }, { status: 400 })
    }

    const trades = await fetchTraderTrades(trader)
    
    return NextResponse.json(trades)
  } catch (error) {
    console.error('Error fetching trader trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trader trades' },
      { status: 500 }
    )
  }
} 