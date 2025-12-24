export interface Trade {
  partition_key: string
  ca: string
  caller: string
  date_called: string
  high_time: string
  low_time: string
  entry_price: number
  ath_price: number
  ath_roi: number
  initial_mc: number
  current_mc: number
  high_price: number
  low_mc: number
  roi: number
  roi_at_high: number
  roi_at_low: number
  profit_at_high: number
  profit_at_low: number
  profit: number
  is_winner: boolean
  multiples_hit: number[]
  supply?: number
}

export interface TokenInfo {
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  priceUsd: string
  transactions?: {
    h1?: { buys: number; sells: number }
    h24?: { buys: number; sells: number }
    h6?: { buys: number; sells: number }
    h12?: { buys: number; sells: number }
    m5?: { buys: number; sells: number }
    buys?: number
    sells?: number
  }
  volume?: {
    h24?: number
    h6?: number
    h1?: number
    h12?: number
    m5?: number
  }
  priceChange?: {
    h24?: number
    h6?: number
    h1?: number
    h12?: number
    m5?: number
  }
  liquidity?: {
    usd?: number
    base?: number
    quote?: number
  }
  mintAddress?: string
  marketInfo: {
    marketCap?: number
    fdv?: number
    pairCreatedAt?: number
  }
  info: {
    websites?: string[]
    socials?: Array<string | { twitter?: string; telegram?: string; discord?: string }>
  }
  dexId?: string
}

export interface BacktestResult {
  date: string
  profit: number
  cumulativeProfit: number
  trade: Trade
  exitPrice: number
  exitDate: string
  roi: number
  unrealizedGain: number
  realizedGain: number
  remainingPosition: number
  takeProfitsHit: number[]
  stopLossesHit: number[]
  positionSize: number
  isBankrupt: boolean
}

export interface TakeProfitLevel {
  percentage: number
  sellPercentage: number
}

export interface StopLossLevel {
  percentage: number
  sellPercentage: number
}

export interface PositionSizing {
  type: 'percentage' | 'fixed'
  value: number
} 