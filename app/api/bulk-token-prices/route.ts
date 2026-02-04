import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { tokens } = await request.json()

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Invalid tokens array' }, { status: 400 })
    }

    // Forward request to Python backend which has efficient bulk API implementation
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/bulk-token-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens }),
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const results = await response.json()
    return NextResponse.json(results)
  } catch (error) {
    console.error('Bulk token prices error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch token prices' },
      { status: 500 }
    )
  }
} 