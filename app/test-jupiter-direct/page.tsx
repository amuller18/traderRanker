"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function TestJupiterDirectPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  // Add a log message
  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message])
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

      addLog("Connecting to Phantom wallet...")
      const { publicKey } = await provider.connect()
      setPublicKey(publicKey.toString())
      setWalletConnected(true)
      addLog(`Connected to wallet: ${publicKey.toString()}`)

      toast({
        title: "Wallet connected",
        description: "Your wallet has been connected successfully",
      })
    } catch (error) {
      console.error("Error connecting wallet:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to connect wallet"
      setError(errorMessage)
      addLog(`Error: ${errorMessage}`)
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Test Jupiter API directly
  const testJupiterDirect = async () => {
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
    addLog("Starting Jupiter API test...")

    try {
      // Using BONK token as an example
      const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
      const solMint = "So11111111111111111111111111111111111111112" // SOL
      const inputMint = solMint
      const outputMint = tokenAddress
      const inputAmount = "100000000" // 0.1 SOL in lamports

      // Step 1: Get quote
      addLog("Step 1: Getting quote from Jupiter API...")
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: inputAmount,
        slippageBps: "50", // 0.5% slippage
      })

      const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?${params.toString()}`)

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
        addLog(`Jupiter API error: ${errorText}`)
        throw new Error(`Failed to get swap transaction: ${swapResponse.status}`)
      }

      const swapData = await swapResponse.json()
      addLog(`Swap transaction received with length: ${swapData.swapTransaction.length} characters`)

      // Step 3: Sign and send transaction
      addLog("Step 3: Signing and sending transaction with Phantom...")
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found")
      }

      // Try different approaches to send the transaction
      try {
        // Approach 1: Pass the transaction directly
        addLog("Approach 1: Passing transaction directly...")
        const txid1 = await provider.signAndSendTransaction(swapData.swapTransaction)
        addLog(`Success! Transaction signature: ${txid1.signature}`)
        return
      } catch (err1) {
        addLog(`Approach 1 failed: ${err1 instanceof Error ? err1.message : String(err1)}`)

        // Approach 2: Pass as an object with message property
        try {
          addLog("Approach 2: Passing as object with message property...")
          const txid2 = await provider.signAndSendTransaction({
            message: swapData.swapTransaction,
          })
          addLog(`Success! Transaction signature: ${txid2.signature}`)
          return
        } catch (err2) {
          addLog(`Approach 2 failed: ${err2 instanceof Error ? err2.message : String(err2)}`)

          // Approach 3: Use Jupiter v4 format
          try {
            addLog("Approach 3: Using Jupiter v4 format...")
            // Get v4 transaction
            const v4Response = await fetch("https://quote-api.jup.ag/v4/swap", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                route: quoteData,
                userPublicKey: publicKey,
                wrapUnwrapSOL: true,
              }),
            })

            if (!v4Response.ok) {
              throw new Error(`Failed to get v4 swap transaction: ${v4Response.status}`)
            }

            const v4Data = await v4Response.json()
            addLog(`V4 transaction received with length: ${v4Data.swapTransaction.length} characters`)

            const txid3 = await provider.signAndSendTransaction(v4Data.swapTransaction)
            addLog(`Success! Transaction signature: ${txid3.signature}`)
            return
          } catch (err3) {
            addLog(`Approach 3 failed: ${err3 instanceof Error ? err3.message : String(err3)}`)
            throw new Error("All approaches failed to send transaction")
          }
        }
      }
    } catch (error) {
      console.error("Error in Jupiter test:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to execute Jupiter test"
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
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Test Jupiter API Directly</h1>
      <p className="text-muted-foreground mb-6">
        This page tests the Jupiter API directly with detailed logging to help debug issues.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Jupiter API Test</CardTitle>
            <CardDescription>Test the Jupiter API directly with your Phantom wallet</CardDescription>
          </CardHeader>
          <CardContent>{error && <div className="text-sm text-red-500 mb-4">{error}</div>}</CardContent>
          <CardFooter className="flex flex-col space-y-2">
            {!walletConnected ? (
              <Button onClick={connectWallet} className="w-full">
                Connect Wallet
              </Button>
            ) : (
              <Button onClick={testJupiterDirect} disabled={loading} className="w-full">
                {loading ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </div>
                ) : (
                  "Test Jupiter API"
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
            <CardDescription>Detailed logs of the API test process</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md h-[400px] overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">No logs yet. Start the test to see logs.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

