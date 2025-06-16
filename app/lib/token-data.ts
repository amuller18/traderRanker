export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  marketInfo?: {
    fdv: number
    price: number
    volume24h: number
    liquidity: number
    marketCap?: number
    pairCreatedAt?: number
  }
  error?: string
}

export interface TokenMarketData {
  fdv: number
  price: number
  volume24h: number
  liquidity: number
} 