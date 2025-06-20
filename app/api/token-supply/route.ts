import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 })
    }

    // Try to get supply from Birdeye API first
    try {
      const response = await fetch(
        `https://public-api.birdeye.so/public/token_list?address=${address}`,
        {
          headers: {
            'X-API-KEY': process.env.BIRDEYE_API_KEY || '',
            'accept': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.data && data.data.length > 0) {
          const token = data.data[0]
          return NextResponse.json({
            total_supply: token.totalSupply || 0,
            circulating_supply: token.circulatingSupply || token.totalSupply || 0,
            decimals: token.decimals || 9
          })
        }
      }
    } catch (birdeyeError) {
      console.error('Birdeye API error:', birdeyeError)
    }

    // Fallback to default values
    return NextResponse.json({
      total_supply: 1e9,
      circulating_supply: 1e9,
      decimals: 9
    })
  } catch (error) {
    console.error('Error fetching token supply:', error)
    return NextResponse.json(
      { error: 'Failed to fetch token supply' },
      { status: 500 }
    )
  }
} 