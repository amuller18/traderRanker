"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownUp, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Script from "next/script"

interface TokenSwapProps {
  tokenAddress: string
  tokenSymbol: string
}

export function SolanaTokenSwap({ tokenAddress, tokenSymbol }: TokenSwapProps) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("0.1")
  const [swapDirection, setSwapDirection] = useState<"buy" | "sell">("buy")
  const [loading, setLoading] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quoteData, setQuoteData] = useState<any>(null)
  const [expectedOutput, setExpectedOutput] = useState<string | null>(null)
  const [solanaLoaded, setSolanaLoaded] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

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

  // Check wallet connection on component mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      const provider = getProvider()
      if (provider) {
        try {
          const { publicKey } = await provider.connect({ onlyIfTrusted: true })
          setPublicKey(publicKey.toString())
          setWalletConnected(true)
        } catch (error) {
          // User hasn't connected to this app yet or has revoked permissions
          setWalletConnected(false)
        }
      }
    }

    if (solanaLoaded) {
      checkWalletConnection()
    }
  }, [solanaLoaded])

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

  // Toggle swap direction
  const toggleSwapDirection = () => {
    setSwapDirection(swapDirection === "buy" ? "sell" : "buy")
    setQuoteData(null)
    setExpectedOutput(null)
  }

  // Get quote from Jupiter API
  const getQuote = async () => {
    setError(null)
    setQuoteData(null)
    setExpectedOutput(null)

    try {
      const parsedAmount = Number.parseFloat(amount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount")
      }

      // Define input and output tokens based on swap direction
      const solMint = "So11111111111111111111111111111111111111112" // SOL
      let inputMint, outputMint

      if (swapDirection === "buy") {
        inputMint = solMint
        outputMint = tokenAddress
      } else {
        inputMint = tokenAddress
        outputMint = solMint
      }

      // Convert amount to lamports/smallest unit
      const inputAmount = (parsedAmount * 1e9).toString() // Assuming SOL with 9 decimals

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: inputAmount,
        slippageBps: "50", // 0.5% slippage
      })

      addLog("Getting quote from Jupiter API...")
      const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?${params.toString()}`)

      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status}`)
      }

      const data = await quoteResponse.json()
      addLog("Quote received successfully")
      setQuoteData(data)

      // Calculate expected output
      const outAmount = Number.parseInt(data.outAmount) / 1e9 // Convert from lamports to SOL
      setExpectedOutput(outAmount.toFixed(6))

      return data
    } catch (error) {
      console.error("Error getting quote:", error)
      setError(error instanceof Error ? error.message : "Failed to get quote")
      toast({
        title: "Quote Failed",
        description: error instanceof Error ? error.message : "Failed to get quote",
        variant: "destructive",
      })
      return null
    }
  }

  // Execute swap
  const executeSwap = async () => {
    if (!walletConnected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    if (!solanaLoaded) {
      toast({
        title: "Solana Web3 not loaded",
        description: "Please wait for Solana Web3 to load",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get quote if not already fetched
      const quote = quoteData || (await getQuote())
      if (!quote) {
        throw new Error("Failed to get quote")
      }

      // Get swap transaction
      addLog("Getting swap transaction from Jupiter API...")
      const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteResponse: quote,
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
      addLog("Swap transaction received from Jupiter API")

      // Get the transaction data
      const { swapTransaction } = swapData

      // Get the provider
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found")
      }

      // For versioned transactions, we need to pass the serialized transaction directly
      addLog("Sending transaction to Phantom...")

      // Send the transaction directly to Phantom
      const signature = await provider.signAndSendTransaction({
        message: swapTransaction,
      })

      addLog(`Transaction sent successfully! Signature: ${signature.signature}`)

      toast({
        title: "Transaction sent",
        description: `Transaction signature: ${signature.signature.substring(0, 8)}...`,
      })

      // Reset form
      setQuoteData(null)
      setExpectedOutput(null)
    } catch (error) {
      console.error("Error executing swap:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to execute swap"
      setError(errorMessage)
      addLog(`Error: ${errorMessage}`)
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Script
        src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"
        onLoad={() => {
          console.log("Solana Web3.js loaded")
          setSolanaLoaded(true)
        }}
        onError={() => {
          console.error("Failed to load Solana Web3.js")
          setError("Failed to load Solana Web3.js")
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Swap {tokenSymbol}</CardTitle>
          <CardDescription>
            {swapDirection === "buy" ? `Buy ${tokenSymbol} with SOL` : `Sell ${tokenSymbol} for SOL`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{swapDirection === "buy" ? "From SOL" : `From ${tokenSymbol}`}</div>
              <Button variant="ghost" size="sm" onClick={toggleSwapDirection} className="h-8 w-8 p-0">
                <ArrowDownUp className="h-4 w-4" />
                <span className="sr-only">Swap direction</span>
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="flex space-x-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.1"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setQuoteData(null)
                    setExpectedOutput(null)
                  }}
                  disabled={loading}
                  min="0.000001"
                  step="0.01"
                  className="flex-1"
                />
                <Select disabled value={swapDirection === "buy" ? "SOL" : tokenSymbol}>
                  <SelectTrigger className="w-24">
                    <SelectValue>{swapDirection === "buy" ? "SOL" : tokenSymbol}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={swapDirection === "buy" ? "SOL" : tokenSymbol}>
                      {swapDirection === "buy" ? "SOL" : tokenSymbol}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>You will receive</Label>
              <div className="flex space-x-2">
                <div className="flex-1 p-2 border rounded-md bg-muted/50">
                  {expectedOutput ? expectedOutput : "0.00"}
                </div>
                <div className="w-24 p-2 border rounded-md bg-muted/50 flex items-center justify-center">
                  {swapDirection === "buy" ? tokenSymbol : "SOL"}
                </div>
              </div>
            </div>

            {error && <div className="text-sm text-red-500 mt-2">{error}</div>}

            {logs.length > 0 && (
              <div className="mt-4">
                <Label>Logs</Label>
                <div className="bg-muted p-2 rounded-md h-24 overflow-y-auto font-mono text-xs mt-1">
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
        <CardFooter className="flex flex-col space-y-2">
          {!walletConnected ? (
            <Button onClick={connectWallet} className="w-full">
              Connect Wallet
            </Button>
          ) : (
            <>
              {!quoteData && (
                <Button onClick={getQuote} disabled={loading || !solanaLoaded} className="w-full">
                  {loading ? (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : !solanaLoaded ? (
                    "Loading Solana Web3..."
                  ) : (
                    "Get Quote"
                  )}
                </Button>
              )}
              {quoteData && (
                <Button onClick={executeSwap} disabled={loading || !solanaLoaded} className="w-full">
                  {loading ? (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </div>
                  ) : !solanaLoaded ? (
                    "Loading Solana Web3..."
                  ) : (
                    "Swap"
                  )}
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    </>
  )
}

