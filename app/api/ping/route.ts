import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'API server is running',
    timestamp: new Date().toISOString()
  })
} 