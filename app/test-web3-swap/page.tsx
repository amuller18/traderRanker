"use client"

import { Web3TokenSwap } from "../components/web3-token-swap"

export default function TestWeb3SwapPage() {
  // Using BONK token as an example
  const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
  const tokenSymbol = "BONK"

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Test Web3 Token Swap</h1>
      <p className="text-muted-foreground mb-6">
        This page tests a different approach to token swapping using the Phantom wallet.
      </p>

      <div className="max-w-md mx-auto">
        <Web3TokenSwap tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} />
      </div>
    </div>
  )
}

