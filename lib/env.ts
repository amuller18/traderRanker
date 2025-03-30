// Environment variables for the application
// This centralizes all environment variable access

// Solana RPC endpoints
export const SOLANA_RPC_ENDPOINTS = [
  process.env.QUICKNODE_RPC_URL || "https://api.mainnet-beta.solana.com", // QuickNode RPC (primary)
  "https://api.mainnet-beta.solana.com", // Public RPC (fallback)
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
]

// Get the primary RPC endpoint (first in the list)
export const getPrimaryRpcEndpoint = () => SOLANA_RPC_ENDPOINTS[0]

// Log which RPC endpoint is being used (without revealing the full URL)
export const logRpcEndpoint = (endpoint: string) => {
  if (endpoint.includes("quiknode")) {
    console.log("Using QuickNode RPC endpoint")
  } else {
    console.log(`Using public RPC endpoint: ${endpoint}`)
  }
}

