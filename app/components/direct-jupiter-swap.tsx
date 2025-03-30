"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import Script from "next/script"

export function DirectJupiterSwap() {
  const { toast } = useToast()
  const [amount, setAmount] = useState("0.001")
  const [slippage, setSlippage] = useState(100) // 1% slippage
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [solanaLoaded, setSolanaLoaded] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  // Test direct Jupiter swap
  const testDirectJupiterSwap = async () => {
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
        title: "Solana Web3.js not loaded",
        description: "Please wait for Solana Web3.js to load",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)
    setSignature(null)
    setLogs([])

    try {
      const amountValue = Number.parseFloat(amount)
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error("Please enter a valid amount")
      }

      // Convert amount to lamports (SOL has 9 decimals)
      const amountLamports = Math.floor(amountValue * 1e9)

      addLog(`Starting direct Jupiter swap test with ${amount} SOL and ${slippage / 100}% slippage...`)

      // Step 1: Get quote from Jupiter API
      addLog("Step 1: Getting quote from Jupiter API...")
      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&amount=${amountLamports}&slippageBps=${slippage}`,
      )

      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status} ${quoteResponse.statusText}`)
      }

      const quoteData = await quoteResponse.json()
      addLog(`Quote received successfully. Output amount: ${quoteData.outAmount} BONK`)
      addLog(`Price impact: ${quoteData.priceImpactPct}%`)

      // Step 2: Get swap transaction from Jupiter API
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
        throw new Error(`Failed to get swap transaction: ${swapResponse.status} ${swapResponse.statusText}`)
      }

      const swapData = await swapResponse.json()
      const swapTransaction = swapData.swapTransaction
      addLog("Swap transaction received from Jupiter API")

      // Step 3: Process transaction with Solana Web3.js
      addLog("Step 3: Processing transaction with Solana Web3.js...")

      // Convert base64 to Uint8Array
      const transactionBuffer = Buffer.from(swapTransaction, "base64")
      addLog(`Transaction buffer created with length: ${transactionBuffer.length}`)

      // Create a transaction object
      // @ts-ignore
      const transaction = window.solanaWeb3.VersionedTransaction.deserialize(transactionBuffer)
      addLog("Transaction deserialized successfully")

      // Get the provider
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found")
      }

      // Sign and send the transaction
      addLog("Signing and sending transaction...")
      const signatureResult = await provider.signAndSendTransaction(transaction)
      const txSignature = signatureResult.signature
      setSignature(txSignature)
      addLog(`Transaction sent successfully! Signature: ${txSignature}`)

      toast({
        title: "Transaction Sent",
        description: "Your swap transaction has been sent successfully!",
      })
    } catch (error) {
      console.error("Error sending test transaction:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setError(errorMessage)
      addLog(`Error: ${errorMessage}`)
      toast({
        title: "Error",
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
        src="https://unpkg.com/@solana/web3.js@1.73.0/lib/index.iife.min.js"
        onLoad={() => {
          console.log("Solana Web3.js loaded")
          setSolanaLoaded(true)
        }}
        onError={() => {
          console.error("Failed to load Solana Web3.js")
          setError("Failed to load Solana Web3.js")
        }}
      />

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Test Jupiter Swap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!walletConnected ? (
              <Button onClick={connectWallet} className="w-full">
                Connect Wallet
              </Button>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (SOL)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="slippage">Slippage Tolerance: {slippage / 100}%</Label>
                    </div>
                    <Slider
                      id="slippage"
                      min={10}
                      max={500}
                      step={10}
                      value={[slippage]}
                      onValueChange={(value) => setSlippage(value[0])}
                      disabled={loading}
                    />
                  </div>

                  <Button onClick={testDirectJupiterSwap} className="w-full" disabled={loading || !solanaLoaded}>
                    {loading ? "Processing..." : "Test Direct Jupiter Swap"}
                  </Button>
                </div>
              </>
            )}

            {error && <div className="text-sm text-red-500 mt-2">{error}</div>}

            {signature && (
              <div className="mt-2 text-sm">
                <div className="font-medium">Transaction Signature:</div>
                <a
                  href={`https://solscan.io/tx/${signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline break-all"
                >
                  {signature}
                </a>
              </div>
            )}

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
    </>
  )
}

