"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowRightLeft, ExternalLink } from "lucide-react"
import Script from "next/script"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export function FinalTokenSwap({ defaultInputToken = "SOL", defaultOutputToken = "BONK" }) {
  const { toast } = useToast()
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [solanaLoaded, setSolanaLoaded] = useState(false)
  const [amount, setAmount] = useState("0.001")
  const [slippage, setSlippage] = useState(100) // 1% slippage
  const [signature, setSignature] = useState<string | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [inputToken, setInputToken] = useState<Token | null>(null)
  const [outputToken, setOutputToken] = useState<Token | null>(null)
  const [quote, setQuote] = useState<any>(null)
  const [swapStatus, setSwapStatus] = useState<"idle" | "quoting" | "ready" | "swapping" | "success" | "error">("idle")
  const [outputAmount, setOutputAmount] = useState("0.00")

  // Load tokens from Jupiter API
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await fetch("https://token.jup.ag/all")
        if (!response.ok) {
          throw new Error(`Failed to fetch tokens: ${response.status}`)
        }
        const data = await response.json()
        setTokens(data)

        // Find default tokens
        const sol = data.find((t: Token) => t.symbol === defaultInputToken)
        const bonk = data.find((t: Token) => t.symbol === defaultOutputToken)

        if (sol) setInputToken(sol)
        if (bonk) setOutputToken(bonk)

        setLoadingTokens(false)
      } catch (error) {
        console.error("Error fetching tokens:", error)
        setError(error instanceof Error ? error.message : "Failed to fetch tokens")
        setLoadingTokens(false)
      }
    }

    fetchTokens()
  }, [defaultInputToken, defaultOutputToken])

  // Update output amount when quote changes
  useEffect(() => {
    if (quote && outputToken) {
      try {
        const outAmount = Number.parseInt(quote.outAmount)
        if (!isNaN(outAmount) && outputToken.decimals) {
          const formattedAmount = formatTokenAmount(quote.outAmount, outputToken.decimals)
          setOutputAmount(formattedAmount)
        } else {
          setOutputAmount("0.00")
        }
      } catch (error) {
        console.error("Error formatting output amount:", error)
        setOutputAmount("0.00")
      }
    } else {
      setOutputAmount("0.00")
    }
  }, [quote, outputToken])

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

  // Get quote from Jupiter API
  const getQuote = async () => {
    if (!inputToken || !outputToken) {
      toast({
        title: "Select tokens",
        description: "Please select input and output tokens",
        variant: "destructive",
      })
      return
    }

    const inputAmount = Number.parseFloat(amount)
    if (isNaN(inputAmount) || inputAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    setSwapStatus("quoting")
    setError(null)
    setQuote(null)
    setOutputAmount("0.00")

    try {
      // Convert amount to lamports/smallest unit
      const amountInSmallestUnit = Math.floor(inputAmount * 10 ** inputToken.decimals)

      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputToken.address}&outputMint=${outputToken.address}&amount=${amountInSmallestUnit}&slippageBps=${slippage}`,
      )

      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status} ${quoteResponse.statusText}`)
      }

      const quoteData = await quoteResponse.json()
      setQuote(quoteData)
      setSwapStatus("ready")

      // Format the output amount
      const outAmount = Number.parseInt(quoteData.outAmount)
      if (!isNaN(outAmount) && outputToken.decimals) {
        const formattedAmount = formatTokenAmount(quoteData.outAmount, outputToken.decimals)
        setOutputAmount(formattedAmount)
      }

      toast({
        title: "Quote received",
        description: `You'll receive approximately ${formatTokenAmount(quoteData.outAmount, outputToken.decimals)} ${outputToken.symbol}`,
      })
    } catch (error) {
      console.error("Error getting quote:", error)
      setError(error instanceof Error ? error.message : "Failed to get quote")
      setSwapStatus("error")
      toast({
        title: "Quote Failed",
        description: error instanceof Error ? error.message : "Failed to get quote",
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

    if (!quote) {
      toast({
        title: "No quote",
        description: "Please get a quote first",
        variant: "destructive",
      })
      return
    }

    setSwapStatus("swapping")
    setError(null)
    setSignature(null)

    try {
      // Get swap transaction from Jupiter API
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
        throw new Error(`Failed to get swap transaction: ${swapResponse.status} ${swapResponse.statusText}`)
      }

      const swapData = await swapResponse.json()
      const swapTransaction = swapData.swapTransaction

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
      setSignature(txSignature)
      setSwapStatus("success")

      toast({
        title: "Swap executed",
        description: `Transaction sent successfully!`,
      })
    } catch (error) {
      console.error("Error executing swap:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to execute swap"
      setError(errorMessage)
      setSwapStatus("error")
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Format token balance
  const formatTokenAmount = (amount: string, decimals: number) => {
    try {
      const value = Number.parseInt(amount) / 10 ** decimals
      if (isNaN(value)) return "0.00"

      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })
    } catch (error) {
      console.error("Error formatting token amount:", error)
      return "0.00"
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
          <CardTitle>Swap Tokens</CardTitle>
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
                    <Label>From</Label>
                    <div className="flex space-x-2">
                      <div className="w-2/3">
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={swapStatus === "swapping"}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-1/3">
                        <Select
                          value={inputToken?.address}
                          onValueChange={(value) => {
                            const token = tokens.find((t) => t.address === value)
                            if (token) setInputToken(token)
                            setQuote(null)
                            setOutputAmount("0.00")
                            setSwapStatus("idle")
                          }}
                          disabled={loadingTokens || swapStatus === "swapping"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select token" />
                          </SelectTrigger>
                          <SelectContent>
                            {tokens.map((token) => (
                              <SelectItem key={token.address} value={token.address}>
                                <div className="flex items-center">
                                  {token.logoURI && (
                                    <img
                                      src={token.logoURI || "/placeholder.svg"}
                                      alt={token.symbol}
                                      className="w-4 h-4 mr-2"
                                      onError={(e) => {
                                        // Hide broken images
                                        ;(e.target as HTMLImageElement).style.display = "none"
                                      }}
                                    />
                                  )}
                                  {token.symbol}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowRightLeft className="text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <Label>To</Label>
                    <div className="flex space-x-2">
                      <div className="w-2/3">
                        <Input type="text" value={outputAmount} disabled placeholder="0.00" />
                      </div>
                      <div className="w-1/3">
                        <Select
                          value={outputToken?.address}
                          onValueChange={(value) => {
                            const token = tokens.find((t) => t.address === value)
                            if (token) setOutputToken(token)
                            setQuote(null)
                            setOutputAmount("0.00")
                            setSwapStatus("idle")
                          }}
                          disabled={loadingTokens || swapStatus === "swapping"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select token" />
                          </SelectTrigger>
                          <SelectContent>
                            {tokens.map((token) => (
                              <SelectItem key={token.address} value={token.address}>
                                <div className="flex items-center">
                                  {token.logoURI && (
                                    <img
                                      src={token.logoURI || "/placeholder.svg"}
                                      alt={token.symbol}
                                      className="w-4 h-4 mr-2"
                                      onError={(e) => {
                                        // Hide broken images
                                        ;(e.target as HTMLImageElement).style.display = "none"
                                      }}
                                    />
                                  )}
                                  {token.symbol}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                      disabled={swapStatus === "swapping"}
                    />
                  </div>

                  {quote && (
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Price Impact:</span>
                        <span>{Number.parseFloat(quote.priceImpactPct).toFixed(2)}%</span>
                      </div>
                      {quote.routePlan && quote.routePlan.length > 0 && (
                        <div className="flex justify-between">
                          <span>Route:</span>
                          <span>{quote.routePlan.map((r: any) => r.swapInfo?.label || "Unknown").join(" → ")}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {swapStatus === "idle" || swapStatus === "error" ? (
                      <Button
                        onClick={getQuote}
                        disabled={!inputToken || !outputToken || !solanaLoaded || loadingTokens}
                        className="w-full"
                      >
                        {loadingTokens ? "Loading tokens..." : "Get Quote"}
                      </Button>
                    ) : swapStatus === "quoting" ? (
                      <Button disabled className="w-full">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Getting quote...
                      </Button>
                    ) : swapStatus === "ready" ? (
                      <Button onClick={executeSwap} className="w-full">
                        Swap
                      </Button>
                    ) : swapStatus === "swapping" ? (
                      <Button disabled className="w-full">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Swapping...
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setSwapStatus("idle")
                          setQuote(null)
                          setOutputAmount("0.00")
                        }}
                        className="w-full"
                      >
                        Swap Again
                      </Button>
                    )}
                  </div>
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

