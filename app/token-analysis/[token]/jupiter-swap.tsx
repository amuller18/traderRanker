"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownUp, AlertCircle } from "lucide-react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Transaction, VersionedTransaction } from "@solana/web3.js"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface JupiterSwapProps {
  tokenAddress: string
}

export default function JupiterSwap({ tokenAddress }: JupiterSwapProps) {
  const { connection } = useConnection()
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet()

  const [inputAmount, setInputAmount] = useState<string>("0.1")
  const [outputAmount, setOutputAmount] = useState<string>("0")
  const [slippage, setSlippage] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [swapDirection, setSwapDirection] = useState<"buy" | "sell">("buy")
  const [tokens, setTokens] = useState<any[]>([])
  const [inputToken, setInputToken] = useState<any>({
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    decimals: 9,
  })
  const [outputToken, setOutputToken] = useState<any | null>(null)
  const [quoteResponse, setQuoteResponse] = useState<any | null>(null)

  // Load tokens and set up the token we're analyzing
  useEffect(() => {
    const loadTokens = async () => {
      try {
        // Use Jupiter API to get token list
        const response = await fetch("https://token.jup.ag/all")
        const tokenList = await response.json()
        setTokens(tokenList)

        // Find the token we're analyzing
        const targetToken = tokenList.find((t: any) => t.address === tokenAddress)
        if (targetToken) {
          setOutputToken(targetToken)
        } else {
          console.error("Token not found in Jupiter token list")
          setError("Token not found in supported tokens list")
        }
      } catch (err) {
        console.error("Error loading tokens:", err)
        setError("Failed to load token information")
      }
    }

    if (tokenAddress) {
      loadTokens()
    }
  }, [tokenAddress])

  // Get quote when input changes
  useEffect(() => {
    const getQuote = async () => {
      if (!publicKey || !inputToken || !outputToken || Number.parseFloat(inputAmount) <= 0) return

      setLoading(true)
      setError(null)

      try {
        const inputMint = swapDirection === "buy" ? inputToken.address : outputToken.address
        const outputMint = swapDirection === "buy" ? outputToken.address : inputToken.address
        const amount = Math.floor(
          Number.parseFloat(inputAmount) * 10 ** (swapDirection === "buy" ? inputToken.decimals : outputToken.decimals),
        )

        // Use Jupiter API for quotes
        const quoteApi = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}`

        const response = await fetch(quoteApi)
        const quoteData = await response.json()

        if (quoteData.data && quoteData.data.length > 0) {
          setQuoteResponse(quoteData)

          // Calculate output amount
          const outAmount = quoteData.data[0].outAmount
          const decimals = swapDirection === "buy" ? outputToken.decimals : inputToken.decimals
          setOutputAmount((Number.parseInt(outAmount) / 10 ** decimals).toFixed(decimals > 6 ? 6 : decimals))
        } else {
          setError("No routes found for this swap")
          setQuoteResponse(null)
          setOutputAmount("0")
        }
      } catch (err: any) {
        console.error("Error getting quote:", err)
        setError(`Failed to get quote: ${err.message || "Unknown error"}`)
        setQuoteResponse(null)
        setOutputAmount("0")
      } finally {
        setLoading(false)
      }
    }

    if (Number.parseFloat(inputAmount) > 0 && inputToken && outputToken) {
      getQuote()
    }
  }, [inputAmount, inputToken, outputToken, slippage, publicKey, swapDirection])

  const executeSwap = async () => {
    if (!publicKey || !signTransaction || !quoteResponse || !quoteResponse.data || quoteResponse.data.length === 0) {
      setError("Cannot execute swap: missing requirements")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get the best route from the quote
      const route = quoteResponse.data[0]

      // Use Jupiter API to get the swap transaction
      const swapApi = "https://quote-api.jup.ag/v6/swap"

      const swapData = {
        quoteResponse: quoteResponse,
        userPublicKey: publicKey.toString(),
        wrapAndUnwrapSol: true, // Important for handling native SOL
        prioritizationFeeLamports: 1000, // Add a small priority fee to help transaction succeed
      }

      const swapResponse = await fetch(swapApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapData),
      })

      const swapResult = await swapResponse.json()

      if (swapResult.error) {
        throw new Error(swapResult.error)
      }

      // The response contains the serialized transaction
      const { swapTransaction } = swapResult

      // Deserialize the transaction
      const transactionBuffer = Buffer.from(swapTransaction, "base64")

      let transaction
      try {
        transaction = VersionedTransaction.deserialize(transactionBuffer)
      } catch (e) {
        // If it's not a versioned transaction, try as a legacy transaction
        transaction = Transaction.from(transactionBuffer)
      }

      // Sign the transaction
      let signedTransaction
      if (transaction instanceof VersionedTransaction) {
        // For versioned transactions
        transaction.sign([
          {
            publicKey,
            secretKey: new Uint8Array(0), // This is a dummy, signTransaction will replace with the real signature
          },
        ])
        signedTransaction = await signTransaction(transaction)
      } else {
        // For legacy transactions
        signedTransaction = await signTransaction(transaction)
      }

      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 2,
      })

      console.log("Swap transaction sent:", signature)

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, "confirmed")

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
      }

      console.log("Swap successful!")
      setError(null)

      // Reset input after successful swap
      setInputAmount("0.1")
      setOutputAmount("0")
    } catch (err: any) {
      console.error("Swap error:", err)
      setError(`Swap failed: ${err.message || "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const switchTokens = () => {
    setSwapDirection(swapDirection === "buy" ? "sell" : "buy")
    setInputAmount("0.1") // Reset input amount
    setOutputAmount("0")
  }

  // If the token we're analyzing isn't loaded yet, show loading
  if (!outputToken && tokenAddress) {
    return <div className="text-center py-8">Loading token information...</div>
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Swap Tokens</CardTitle>
        <CardDescription>
          {swapDirection === "buy" ? "Buy" : "Sell"} {outputToken?.symbol || "token"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">You pay</label>
              <span className="text-sm text-muted-foreground">
                Balance: {connected ? "Loading..." : "Connect wallet"}
              </span>
            </div>
            <div className="flex space-x-2">
              <Input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="flex-1"
                placeholder="0.0"
                min="0"
              />
              <Select
                value={swapDirection === "buy" ? inputToken?.address : outputToken?.address}
                onValueChange={(value) => {
                  const token = tokens.find((t) => t.address === value)
                  if (swapDirection === "buy") {
                    setInputToken(token)
                  } else {
                    setOutputToken(token)
                  }
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select token">
                    {swapDirection === "buy" ? inputToken?.symbol : outputToken?.symbol}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tokens
                    .filter((t) => t.address !== (swapDirection === "buy" ? outputToken?.address : inputToken?.address))
                    .slice(0, 10) // Limit to top 10 tokens for simplicity
                    .map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" size="icon" onClick={switchTokens} className="rounded-full">
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">You receive</label>
            </div>
            <div className="flex space-x-2">
              <Input type="text" value={outputAmount} readOnly className="flex-1" placeholder="0.0" />
              <div className="w-[120px] h-10 flex items-center justify-center border rounded-md px-3">
                {swapDirection === "buy" ? outputToken?.symbol : inputToken?.symbol}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Slippage Tolerance</label>
            <Select value={slippage.toString()} onValueChange={(value) => setSlippage(Number.parseFloat(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select slippage">{slippage}%</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5%</SelectItem>
                <SelectItem value="1">1%</SelectItem>
                <SelectItem value="2">2%</SelectItem>
                <SelectItem value="3">3%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {quoteResponse && quoteResponse.data && quoteResponse.data.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Price Impact:</span>
                <span>{(quoteResponse.data[0].priceImpactPct * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Route:</span>
                <span>{quoteResponse.data[0].marketInfos.map((m: any) => m.label).join(" → ")}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {!connected ? (
          <Button className="w-full" disabled>
            Connect wallet to swap
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={executeSwap}
            disabled={loading || !quoteResponse || Number.parseFloat(inputAmount) <= 0}
          >
            {loading
              ? "Processing..."
              : `Swap ${swapDirection === "buy" ? "to" : "from"} ${outputToken?.symbol || "token"}`}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

