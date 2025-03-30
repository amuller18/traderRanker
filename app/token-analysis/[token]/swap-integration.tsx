"use client"

import { useEffect, useState } from "react"
import { FinalTokenSwap } from "@/app/components/final-token-swap"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SwapIntegrationProps {
  tokenSymbol: string
}

export function SwapIntegration({ tokenSymbol }: SwapIntegrationProps) {
  const [mounted, setMounted] = useState(false)

  // Use useEffect to ensure component only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Swap {tokenSymbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">Loading swap component...</div>
        </CardContent>
      </Card>
    )
  }

  return <FinalTokenSwap defaultInputToken="SOL" defaultOutputToken={tokenSymbol} />
}

