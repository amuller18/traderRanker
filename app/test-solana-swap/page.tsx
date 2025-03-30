import { SolanaTokenSwap } from "@/app/components/solana-token-swap"

export default function TestSolanaSwapPage() {
  // Using BONK token as an example
  const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
  const tokenSymbol = "BONK"

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Test Solana Token Swap</h1>
      <p className="text-muted-foreground mb-6">
        This page tests the token swap functionality using Solana Web3.js to properly handle the transaction.
      </p>

      <div className="max-w-md mx-auto">
        <SolanaTokenSwap tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} />
      </div>
    </div>
  )
}

