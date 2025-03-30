"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export function SimpleSwap() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  // Add a log message
  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message])
    console.log(message)
  }

  // Check if Phantom wallet is available
  const getProvider = () => {
    if (typeof window === "undefined") {
      return null
    }

    if ("phantom" in window) {
      // @ts-ignore
      const provider = window.phantom?.solana

      if (provider?.isPhantom) {
        return provider
      }
    }

    return null
  }

  // Connect wallet function
  const connectWallet = async () => {
    setError(null)
    try {
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found. Please install Phantom wallet extension")
      }

      const { publicKey } = await provider.connect()
      setPublicKey(publicKey.toString())
      setWalletConnected(true)

      toast({
        title: "Wallet connected",
        description: "Your wallet has been connected successfully",
      })
    } catch (error) {
      console.error("Error connecting wallet:", error)
      setError(error instanceof Error ? error.message : "Failed to connect wallet")
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      })
    }
  }

  // Test Jupiter swap
  const testJupiterSwap = async () => {
    if (!walletConnected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)
    addLog("Starting Jupiter swap test...")

    try {
      // Define parameters for a small SOL to BONK swap
      const inputMint = "So11111111111111111111111111111111111111112" // SOL
      const outputMint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" // BONK
      const amount = "10000000" // 0.01 SOL in lamports

      // Step 1: Get quote
      addLog("Step 1: Getting quote from Jupiter API...")
      const quoteParams = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: "50", // 0.5% slippage
      })

      const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?${quoteParams.toString()}`)
      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status}`)
      }

      const quoteData = await quoteResponse.json()
      addLog(`Quote received: ${JSON.stringify(quoteData).substring(0, 100)}...`)

      // Step 2: Get swap transaction
      addLog("Step 2: Getting swap transaction from Jupiter API...")
      const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: publicKey,
          wrapUnwrapSOL: true,
        }),
      })

      if (!swapResponse.ok) {
        const errorText = await swapResponse.text()
        console.error("Jupiter API error:", errorText)
        throw new Error(`Failed to get swap transaction: ${swapResponse.status}`)
      }

      const swapData = await swapResponse.json()
      const { swapTransaction } = swapData
      addLog(`Swap transaction received with length: ${swapTransaction.length} characters`)

      // Step 3: Sign and send transaction
      addLog("Step 3: Signing and sending transaction with Phantom...")
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found")
      }

      // Send the transaction to Phantom
      const signature = await provider.signAndSendTransaction({
        message: swapTransaction,
      })

      addLog(`Transaction sent successfully! Signature: ${signature.signature}`)

      toast({
        title: "Transaction sent",
        description: `Transaction signature: ${signature.signature.substring(0, 8)}...`,
      })
    } catch (error) {
      console.error("Error testing Jupiter swap:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to test Jupiter swap"
      setError(errorMessage)
      addLog(`Error: ${errorMessage}`)
      toast({
        title: "Test Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simple Jupiter Swap Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!walletConnected ? (
            <Button onClick={connectWallet} className="w-full">
              Connect Wallet
            </Button>
          ) : (
            <Button onClick={testJupiterSwap} disabled={loading} className="w-full">
              {loading ? (
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                "Test Jupiter Swap (0.01 SOL to BONK)"
              )}
            </Button>
          )}

          {error && <div className="text-sm text-red-500 mt-2">{error}</div>}

          {logs.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-1">Logs:</div>
              <div className="bg-muted p-2 rounded-md h-48 overflow-y-auto font-mono text-xs">
                {logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

