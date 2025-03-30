"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownUp } from "lucide-react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Jupiter, type RouteInfo, TOKEN_LIST_URL } from "@jup-ag/core"
import JSBI from "jsbi"

interface SwapComponentProps {
  tokenAddress: string
}

export default function SwapComponent({ tokenAddress }: SwapComponentProps) {
  const { connection } = useConnection()
  const { publicKey, signTransaction, connected } = useWallet()

  const [inputAmount, setInputAmount] = useState<string>("0.1")
  const [outputAmount, setOutputAmount] = useState<string>("0")
  const [slippage, setSlippage] = useState<number>(1)
  const [jupiter, setJupiter] = useState<Jupiter | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [routes, setRoutes] = useState<RouteInfo[] | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null)
  const [tokens, setTokens] = useState<any[]>([])
  const [inputToken, setInputToken] = useState<any>({
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
  }) // Default to SOL
  const [outputToken, setOutputToken] = useState<any | null>(null)
  const [swapDirection, setSwapDirection] = useState<"buy" | "sell">("buy")
  const [error, setError] = useState<string | null>(null)

  // Initialize Jupiter and load tokens
  useEffect(() => {
    const loadJupiter = async () => {
      try {
        // Load token list
        const response = await fetch(TOKEN_LIST_URL["mainnet-beta"])
        const tokenList = await response.json()
        setTokens(tokenList)

        // Find the token we're analyzing
        const targetToken = tokenList.find((t: any) => t.address === tokenAddress)
        if (targetToken) {
          setOutputToken(targetToken)
        }

        // Initialize Jupiter
        if (publicKey) {
          const jupiterInstance = await Jupiter.load({
            connection,
            cluster: "mainnet-beta",
            user: publicKey,
            wrapUnwrapSOL: true, // Important for handling native SOL
          })
          setJupiter(jupiterInstance)
        }
      } catch (err) {
        console.error("Error loading Jupiter:", err)
        setError("Failed to initialize swap functionality")
      }
    }

    if (connection && tokenAddress) {
      loadJupiter()
    }
  }, [connection, tokenAddress, publicKey])

  // Find routes when input changes
  useEffect(() => {
    const getRoutes = async () => {
      if (!jupiter || !publicKey || !inputToken || !outputToken) return

      setLoading(true)
      setError(null)

      try {
        const inputMint = new PublicKey(swapDirection === "buy" ? inputToken.address : outputToken.address)
        const outputMint = new PublicKey(swapDirection === "buy" ? outputToken.address : inputToken.address)

        const amount = JSBI.BigInt(
          Number.parseFloat(inputAmount) * 10 ** (swapDirection === "buy" ? inputToken.decimals : outputToken.decimals),
        )

        const routeMap = await jupiter.computeRoutes({
          inputMint,
          outputMint,
          amount,
          slippageBps: slippage * 100,
          forceFetch: true,
        })

        if (routeMap.routesInfos.length > 0) {
          setRoutes(routeMap.routesInfos)
          setSelectedRoute(routeMap.routesInfos[0])

          // Update output amount based on best route
          const outAmount = routeMap.routesInfos[0].outAmount
          const decimals = swapDirection === "buy" ? outputToken.decimals : inputToken.decimals
          setOutputAmount((Number.parseInt(outAmount.toString()) / 10 ** decimals).toString())
        } else {
          setError("No routes found for this swap")
          setRoutes(null)
          setSelectedRoute(null)
        }
      } catch (err) {
        console.error("Error computing routes:", err)
        setError("Failed to compute swap routes")
        setRoutes(null)
        setSelectedRoute(null)
      } finally {
        setLoading(false)
      }
    }

    if (Number.parseFloat(inputAmount) > 0) {
      getRoutes()
    }
  }, [jupiter, inputAmount, inputToken, outputToken, slippage, publicKey, swapDirection])

  const executeSwap = async () => {
    if (!jupiter || !publicKey || !signTransaction || !selectedRoute) {
      setError("Cannot execute swap: missing requirements")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Prepare the transaction
      const { transactions } = await jupiter.exchange({
        routeInfo: selectedRoute,
      })

      // Sign and send the transaction
      const { swapTransaction } = transactions

      if (swapTransaction) {
        const txid = await connection.sendTransaction(swapTransaction, [], {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })

        console.log("Swap transaction sent:", txid)

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(txid, "confirmed")

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`)
        }

        console.log("Swap successful!")
      } else {
        throw new Error("No swap transaction returned")
      }
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

          {error && <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm">{error}</div>}
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
            disabled={loading || !selectedRoute || Number.parseFloat(inputAmount) <= 0}
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

