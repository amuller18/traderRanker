import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Forward all query parameters to Python backend - no price fetching here, let client handle it
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const queryString = searchParams.toString()
    const tradesResponse = await fetch(
      `${backendUrl}/api/trades/filtered${queryString ? `?${queryString}` : ''}`,
      { cache: 'no-store' }
    )

    if (!tradesResponse.ok) {
      throw new Error(`Failed to fetch filtered trades: ${tradesResponse.status}`)
    }

    const trades = await tradesResponse.json()
    return NextResponse.json(trades)
  } catch (error) {
    console.error('Error fetching filtered trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filtered trades' },
      { status: 500 }
    )
  }
}
