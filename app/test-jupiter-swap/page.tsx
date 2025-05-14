"use client"

import { JupiterSwap } from "@/app/components/jupiter-swap"

export default function TestJupiterSwapPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Jupiter Token Swap</h1>
      <div className="max-w-md mx-auto">
        <JupiterSwap />
      </div>
    </div>
  )
} 