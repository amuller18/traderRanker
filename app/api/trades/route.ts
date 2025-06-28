import { NextRequest, NextResponse } from 'next/server'
import { getAllTrades } from '@/lib/trader-data'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all trades from /api/trades endpoint')
    
    // Get all trades from the database
    const trades = await getAllTrades()
    
    console.log(`Successfully fetched ${trades.length} trades`)
    
    // Log first trade for debugging
    if (trades.length > 0) {
      console.log('First trade sample:', JSON.stringify(trades[0], null, 2))
    }
    
    return NextResponse.json(trades)
  } catch (error) {
    console.error('Error fetching trades:', error)
    
    // Return mock data if there's an error
    console.log('Returning mock data due to error')
    const { mockTrades } = await import('@/lib/mock-data')
    return NextResponse.json(mockTrades)
  }
} 