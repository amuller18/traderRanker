"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

declare global {
  interface Window {
    Jupiter: {
      init: (config: { displayMode: string }) => void
    }
  }
}

interface JupiterSwapProps {
  tokenAddress?: string
  tokenSymbol?: string
}

export function JupiterSwap({ tokenAddress, tokenSymbol }: JupiterSwapProps) {
  const initialized = useRef(false)

  useEffect(() => {
    // Only initialize once
    if (!initialized.current && typeof window !== 'undefined' && window.Jupiter) {
      window.Jupiter.init({
        displayMode: "widget",
      })
      initialized.current = true
    }
  }, []) // Empty dependency array since we only want to run this once

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap {tokenSymbol || "Tokens"}</CardTitle>
        <CardDescription>
          Trade tokens using Jupiter's liquidity aggregator
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div id="jupiter-terminal" />
      </CardContent>
    </Card>
  )
} 