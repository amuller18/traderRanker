"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export function MultiApproachSwap() {
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

  // Base64 to Uint8Array conversion
  const base64ToUint8Array = (base64: string) => {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  // Test Jupiter swap with multiple approaches
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
    addLog("Starting Jupiter swap test with multiple approaches...")

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

      // Step 3: Try multiple approaches to sign and send the transaction
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found")
      }

      // Try different approaches one by one
      let signature = null
      let successfulApproach = ""

      // Approach 1: Pass the base64 string directly
      try {
        addLog("Approach 1: Passing base64 string directly...")
        signature = await provider.signAndSendTransaction(swapTransaction)
        successfulApproach = "Approach 1: Passing base64 string directly"
        addLog(`Approach 1 succeeded!`)
      } catch (error) {
        addLog(`Approach 1 failed: ${error instanceof Error ? error.message : String(error)}`)
      }

      // If Approach 1 failed, try Approach 2
      if (!signature) {
        try {
          addLog("Approach 2: Converting to Uint8Array...")
          const uint8Array = base64ToUint8Array(swapTransaction)
          signature = await provider.signAndSendTransaction(uint8Array)
          successfulApproach = "Approach 2: Converting to Uint8Array"
          addLog(`Approach 2 succeeded!`)
        } catch (error) {
          addLog(`Approach 2 failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // If Approach 2 failed, try Approach 3
      if (!signature) {
        try {
          addLog("Approach 3: Using signTransaction then sendTransaction...")
          const signedTransaction = await provider.signTransaction(swapTransaction)
          signature = await provider.sendTransaction(signedTransaction)
          successfulApproach = "Approach 3: Using signTransaction then sendTransaction"
          addLog(`Approach 3 succeeded!`)
        } catch (error) {
          addLog(`Approach 3 failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // If Approach 3 failed, try Approach 4
      if (!signature) {
        try {
          addLog("Approach 4: Using { message: swapTransaction }...")
          signature = await provider.signAndSendTransaction({ message: swapTransaction })
          successfulApproach = "Approach 4: Using { message: swapTransaction }"
          addLog(`Approach 4 succeeded!`)
        } catch (error) {
          addLog(`Approach 4 failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // If all approaches failed, throw an error
      if (!signature) {
        throw new Error("All approaches failed to send transaction")
      }

      addLog(`Transaction sent successfully using ${successfulApproach}!`)
      addLog(`Signature: ${signature.signature}`)

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
        <CardTitle>Multi-Approach Jupiter Swap Test</CardTitle>
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

