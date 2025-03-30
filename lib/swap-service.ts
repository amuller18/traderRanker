// Types for Jupiter API
export interface TokenInfo {
  address: string
  chainId: number
  decimals: number
  name: string
  symbol: string
  logoURI?: string
  tags?: string[]
  extensions?: Record<string, any>
}

export interface QuoteResponse {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  platformFee: {
    amount: string
    feeBps: number
  }
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
  contextSlot: number
  timeTaken: number
}

// Update the SwapTransactionResponse interface to include addressLookupTableAccounts
export interface SwapTransactionResponse {
  swapTransaction: string // base64 encoded transaction
  addressLookupTableAccounts?: Array<{
    publicKey: string
    // Other fields might be present but we only need the publicKey
  }>
}

// Function to fetch token list from Jupiter
export async function fetchTokenList(): Promise<TokenInfo[]> {
  try {
    const response = await fetch("https://token.jup.ag/all")
    if (!response.ok) {
      throw new Error(`Failed to fetch token list: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching token list:", error)
    return []
  }
}

// Function to get quote from Jupiter
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 50, // 0.5% default slippage
): Promise<QuoteResponse | null> {
  try {
    // Convert amount to proper format (in lamports/smallest unit)
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
    })

    const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params.toString()}`)

    if (!response.ok) {
      throw new Error(`Failed to get quote: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting swap quote:", error)
    return null
  }
}

// Function to get swap transaction
export async function getSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: string,
): Promise<SwapTransactionResponse | null> {
  try {
    const response = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapUnwrapSOL: true, // Automatically wrap/unwrap SOL
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get swap transaction: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting swap transaction:", error)
    return null
  }
}

// Function to get token by symbol
export function getTokenBySymbol(tokenList: TokenInfo[], symbol: string): TokenInfo | undefined {
  return tokenList.find((token) => token.symbol.toLowerCase() === symbol.toLowerCase())
}

// Function to get token by address
export function getTokenByAddress(tokenList: TokenInfo[], address: string): TokenInfo | undefined {
  return tokenList.find((token) => token.address === address)
}

// Format amount based on decimals
export function formatTokenAmount(amount: string, decimals: number): string {
  const value = Number.parseInt(amount) / Math.pow(10, decimals)
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  })
}

// Parse amount to smallest unit
export function parseTokenAmount(amount: string, decimals: number): string {
  const value = Number.parseFloat(amount) * Math.pow(10, decimals)
  return Math.floor(value).toString()
}

// Calculate price per token
export function calculatePrice(inAmount: string, outAmount: string, inDecimals: number, outDecimals: number): string {
  const inValue = Number.parseInt(inAmount) / Math.pow(10, inDecimals)
  const outValue = Number.parseInt(outAmount) / Math.pow(10, outDecimals)

  if (outValue === 0) return "0"

  const price = inValue / outValue

  if (price < 0.000001) return price.toExponential(6)
  if (price < 0.01) return price.toFixed(6)
  if (price < 1) return price.toFixed(4)
  if (price < 1000) return price.toFixed(2)

  return price.toLocaleString()
}

// Format USD value
export function formatUsdValue(value: number): string {
  if (value === 0) return "$0.00"
  if (value < 0.01) return "<$0.01"
  if (value < 1000) return `$${value.toFixed(2)}`
  if (value < 1000000) return `$${(value / 1000).toFixed(2)}K`
  return `$${(value / 1000000).toFixed(2)}M`
}

