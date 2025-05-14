"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowDownUp, Loader2, Wallet, AlertCircle } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Script from "next/script"

// Token information
interface TokenInfo {
  symbol: string
  name: string
  decimals: number
  address: string
  logoURI?: string
}

// Common tokens on Solana
const TOKENS: Record<string, TokenInfo> = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    address: "So11111111111111111111111111111111111111112", // Native SOL wrapped address
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
}

// List of reliable RPC endpoints to try
const RPC_ENDPOINTS = [
  "https://distinguished-yolo-borough.solana-mainnet.quiknode.pro/e66f665fb3a8c58eb6fafb826fd0627ebbbf2426/",
  "https://api.mainnet-beta.solana.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
]

interface TokenSwapProps {
  tokenAddress: string
  tokenSymbol: string
  tokenDecimals?: number
}

export function TokenSwap({ tokenAddress, tokenSymbol, tokenDecimals = 5 }: TokenSwapProps) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("0.001")
  const [slippage, setSlippage] = useState(100) // 1% slippage
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [solanaLoaded, setSolanaLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceError, setBalanceError] = useState(false)
  const [outputAmount, setOutputAmount] = useState<string | null>(null)

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
    try {
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found. Please install Phantom wallet extension")
      }

      const { publicKey } = await provider.connect()
      setPublicKey(publicKey.toString())
      setWalletConnected(true)

      // Get SOL balance
      fetchBalance(publicKey.toString())

      toast({
        title: "Wallet connected",
        description: "Your wallet has been connected successfully",
      })
    } catch (error) {
      console.error("Error connecting wallet:", error)
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      })
    }
  }

  // Try multiple RPC endpoints to fetch balance
  const fetchBalance = async (address: string) => {
    setBalanceError(false)

    // Try each RPC endpoint until one works
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        // @ts-ignore
        const connection = new window.solanaWeb3.Connection(endpoint)
        // @ts-ignore
        const publicKey = new window.solanaWeb3.PublicKey(address)

        const balance = await connection.getBalance(publicKey)
        setBalance(balance / 1e9) // Convert lamports to SOL
        return // Exit if successful
      } catch (error) {
        console.warn(`Error fetching balance from ${endpoint}:`, error)
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    console.error("Failed to fetch balance from all RPC endpoints")
    setBalanceError(true)

    // Set a default balance for testing purposes
    // This allows the component to still be usable even if balance fetching fails
    setBalance(1.0)
  }

  // Set amount as percentage of balance
  const setAmountPercentage = (percentage: number) => {
    if (balance) {
      // Leave some SOL for transaction fees
      const maxAmount = balance > 0.01 ? balance - 0.01 : 0
      const newAmount = (maxAmount * percentage).toFixed(4)
      setAmount(newAmount)
      getQuote(newAmount)
    }
  }

  // Get quote from Jupiter API
  const getQuote = async (inputAmount: string) => {
    try {
      const amountValue = Number.parseFloat(inputAmount)
      if (isNaN(amountValue) || amountValue <= 0) {
        setOutputAmount(null)
        return
      }

      // Convert amount to lamports (SOL has 9 decimals)
      const amountLamports = Math.floor(amountValue * 1e9)

      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenAddress}&amount=${amountLamports}&slippageBps=${slippage}`,
      )

      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status} ${quoteResponse.statusText}`)
      }

      const quoteData = await quoteResponse.json()

      // Format token amount based on decimals
      const divisor = Math.pow(10, tokenDecimals)
      const formattedAmount = (Number(quoteData.outAmount) / divisor).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })

      setOutputAmount(formattedAmount)
    } catch (error) {
      console.error("Error getting quote:", error)
      setOutputAmount(null)
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

    setLoading(true)

    try {
      const amountValue = Number.parseFloat(amount)
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error("Please enter a valid amount")
      }

      // Convert amount to lamports (SOL has 9 decimals)
      const amountLamports = Math.floor(amountValue * 1e9)

      // Step 1: Get quote from Jupiter API
      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenAddress}&amount=${amountLamports}&slippageBps=${slippage}`,
      )

      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status} ${quoteResponse.statusText}`)
      }

      const quoteData = await quoteResponse.json()

      // Step 2: Get swap transaction from Jupiter API
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

      // Step 3: Process swap transaction with Solana Web3.js
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
      const signatureResult = await provider.signAndSendTransaction(transaction)
      const txSignature = signatureResult.signature

      // Create Solscan link
      const solscanLink = `https://solscan.io/tx/${txSignature}`

      toast({
        title: "Swap Successful",
        description: (
          <div>
            Transaction sent successfully!{" "}
            <a
              href={solscanLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500 hover:text-blue-700"
            >
              View on Solscan
            </a>
          </div>
        ),
      })

      // Refresh balance after swap
      setTimeout(() => fetchBalance(publicKey), 5000)
    } catch (error) {
      console.error("Error executing swap:", error)
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Failed to execute swap",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Update quote when amount or slippage changes
  useEffect(() => {
    if (walletConnected) {
      getQuote(amount)
    }
  }, [amount, slippage, walletConnected])

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
        }}
      />

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Swap SOL to {tokenSymbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!walletConnected ? (
              <Button onClick={connectWallet} className="w-full">
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="amount">From (SOL)</Label>
                      {balance !== null && (
                        <div className="flex items-center">
                          {balanceError && <AlertCircle className="h-3 w-3 text-yellow-500 mr-1" />}
                          <span className={`text-sm ${balanceError ? "text-yellow-500" : "text-muted-foreground"}`}>
                            Balance: {balanceError ? "~" : ""}
                            {balance.toFixed(4)} SOL
                          </span>
                        </div>
                      )}
                    </div>
                    <Input
                      id="amount"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value)
                        getQuote(e.target.value)
                      }}
                      disabled={loading}
                    />
                    <div className="flex gap-1 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountPercentage(0.25)}
                        disabled={loading || balance === null}
                        className="px-2 py-1 text-xs"
                      >
                        25%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountPercentage(0.5)}
                        disabled={loading || balance === null}
                        className="px-2 py-1 text-xs"
                      >
                        50%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountPercentage(0.75)}
                        disabled={loading || balance === null}
                        className="px-2 py-1 text-xs"
                      >
                        75%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountPercentage(1)}
                        disabled={loading || balance === null}
                        className="px-2 py-1 text-xs"
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowDownUp className="h-6 w-6 text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="output">To ({tokenSymbol})</Label>
                    <div className="p-3 bg-muted rounded-md flex items-center justify-between">
                      <div className="font-mono text-lg">
                        {outputAmount ? outputAmount : "0"} {tokenSymbol}
                      </div>
                      <img
                        src={`/placeholder.svg?height=24&width=24&text=${tokenSymbol}`}
                        alt={tokenSymbol}
                        className="h-6 w-6 rounded-full"
                      />
                    </div>
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

                  <Button onClick={executeSwap} className="w-full" disabled={loading || !solanaLoaded}>
                    {loading ? (
                      <div className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Swapping...
                      </div>
                    ) : (
                      `Swap SOL to ${tokenSymbol}`
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

