"use client"

import { FixedTokenSwap } from "../components/fixed-token-swap"

export default function TestSwapPage() {
  // Using BONK token as an example
  const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
  const tokenSymbol = "BONK"

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Test Token Swap</h1>
      <p className="text-muted-foreground mb-6">
        This page allows you to test the token swap functionality with the fixed component.
      </p>

      <div className="max-w-md mx-auto">
        <FixedTokenSwap tokenAddress={tokenAddress} tokenSymbol={tokenSymbol} />
      </div>
    </div>
  )
}

