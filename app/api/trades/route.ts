import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Fetch all trades from Python backend - no price fetching here, let client handle it
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const tradesResponse = await fetch(`${backendUrl}/api/trades`, {
      next: { revalidate: 30 },
    })

    if (!tradesResponse.ok) {
      throw new Error(`Failed to fetch trades: ${tradesResponse.status}`)
    }

    const trades = await tradesResponse.json()
    return NextResponse.json(trades)
  } catch (error) {
    console.error('Error fetching all trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    )
  }
}
