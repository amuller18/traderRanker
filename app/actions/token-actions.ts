import { getTokenInfo, getTokenSupply, type TokenInfo } from "@/lib/token-api"

export interface TokenData {
  tokenInfo: TokenInfo[] | null
  tokenSupply: number
  contractAddress: string
}

/**
 * Fetches comprehensive token data from multiple sources
 * @param contractAddress The token contract address
 * @returns Combined token data
 */
export async function fetchTokenData(contractAddress: string): Promise<TokenData> {
  console.log(`Fetching comprehensive token data for: ${contractAddress}`)

  // Fetch token info and supply in parallel
  const [tokenInfo, tokenSupply] = await Promise.all([getTokenInfo(contractAddress), getTokenSupply(contractAddress)])

  return {
    tokenInfo,
    tokenSupply,
    contractAddress,
  }
}

