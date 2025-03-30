"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowRightLeft, ExternalLink } from "lucide-react"
import Script from "next/script"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

export function SimplifiedTokenSwap() {
  const { toast } = useToast()
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [solanaLoaded, setSolanaLoaded] = useState(false)
  const [amount, setAmount] = useState("0.001")
  const [slippage, setSlippage] = useState(100) // 1% slippage
  const [outputAmount, setOutputAmount] = useState("0.00")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [quote, setQuote] = useState<any>(null)

  // SOL and BONK token addresses
  const SOL_ADDRESS = "So11111111111111111111111111111111111111112"
  const BONK_ADDRESS = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"

  // Check if Phantom wallet is available
  const getProvider = () => {
    if (typeof window === "undefined") return null
    if ("phantom" in window) {
      // @ts-ignore
      const provider = window.phantom?.solana
      if (provider?.isPhantom) return provider
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
        title: "Solana Web3.js not loaded",
        description: "Please wait for Solana Web3.js to load",
        variant: "destructive",
      })
      return
    }

    setStatus("loading")
    setError(null)
    setSignature(null)
    setQuote(null)
    setOutputAmount("0.00")

    try {
      // Convert amount to lamports (SOL's smallest unit)
      const inputAmount = Number.parseFloat(amount)
      if (isNaN(inputAmount) || inputAmount <= 0) {
        throw new Error("Please enter a valid amount")
      }

      const amountInLamports = Math.floor(inputAmount * 1e9) // 1 SOL = 10^9 lamports

      // Step 1: Get quote from Jupiter API
      console.log("Step 1: Getting quote from Jupiter API...")
      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_ADDRESS}&outputMint=${BONK_ADDRESS}&amount=${amountInLamports}&slippageBps=${slippage}`,
      )

      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status} ${quoteResponse.statusText}`)
      }

      const quoteData = await quoteResponse.json()
      setQuote(quoteData)

      // Format the output amount (BONK has 5 decimals)
      const outAmount = Number.parseInt(quoteData.outAmount) / 1e5 // BONK has 5 decimals
      setOutputAmount(
        outAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      )

      // Step 2: Get swap transaction from Jupiter API
      console.log("Step 2: Getting swap transaction from Jupiter API...")
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

      // Step 3: Process transaction with Solana Web3.js
      console.log("Step 3: Processing transaction with Solana Web3.js...")

      // Get the provider
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found")
      }

      // Convert base64 to Uint8Array
      const transactionBuffer = Buffer.from(swapTransaction, "base64")

      // Create a transaction object
      // @ts-ignore
      const transaction = window.solanaWeb3.VersionedTransaction.deserialize(transactionBuffer)

      // Sign and send the transaction
      console.log("Signing and sending transaction...")
      const signatureResult = await provider.signAndSendTransaction(transaction)
      const txSignature = signatureResult.signature
      setSignature(txSignature)
      setStatus("success")

      toast({
        title: "Swap executed",
        description: `Transaction sent successfully!`,
      })
    } catch (error) {
      console.error("Error executing swap:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to execute swap"
      setError(errorMessage)
      setStatus("error")
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive",
      })
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

      <Card>
        <CardHeader>
          <CardTitle>Swap SOL to BONK</CardTitle>
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
                    <Label>From (SOL)</Label>
                    <Input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={status === "loading"}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex justify-center">
                    <ArrowRightLeft className="text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <Label>To (BONK)</Label>
                    <Input type="text" value={outputAmount} disabled placeholder="0.00" />
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
                      disabled={status === "loading"}
                    />
                  </div>

                  {quote && (
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Price Impact:</span>
                        <span>{Number.parseFloat(quote.priceImpactPct).toFixed(2)}%</span>
                      </div>
                    </div>
                  )}

                  <Button onClick={executeSwap} disabled={status === "loading" || !solanaLoaded} className="w-full">
                    {status === "loading" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Swapping...
                      </>
                    ) : (
                      "Swap SOL to BONK"
                    )}
                  </Button>
                </div>
              </>
            )}

            {error && <div className="text-sm text-red-500 mt-2">{error}</div>}

            {signature && (
              <div className="mt-4 text-sm">
                <div className="font-medium mb-1">Transaction Signature:</div>
                <a
                  href={`https://solscan.io/tx/${signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-500 hover:underline break-all"
                >
                  <span className="mr-1">
                    {signature.substring(0, 20)}...{signature.substring(signature.length - 8)}
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

