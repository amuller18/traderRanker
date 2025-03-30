"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownUp, AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Transaction, SendTransactionError, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WalletConnectButton } from "./wallet-connect-button"

interface JupiterSwapProps {
  tokenAddress: string
}

export default function JupiterSwap({ tokenAddress }: JupiterSwapProps) {
  const { connection } = useConnection()
  const { publicKey, signTransaction, connected } = useWallet()

  const [inputAmount, setInputAmount] = useState<string>("0.1")
  const [outputAmount, setOutputAmount] = useState<string>("0")
  const [slippage, setSlippage] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [swapDirection, setSwapDirection] = useState<"buy" | "sell">("buy")
  const [tokens, setTokens] = useState<any[]>([])
  const [inputToken, setInputToken] = useState<any>({
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    decimals: 9,
  })
  const [outputToken, setOutputToken] = useState<any | null>(null)
  const [quoteResponse, setQuoteResponse] = useState<any | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false)

  // Load tokens and set up the token we're analyzing
  useEffect(() => {
    const loadTokens = async () => {
      try {
        // Use Jupiter API to get token list
        const response = await fetch("https://token.jup.ag/all")
        const tokenList = await response.json()
        setTokens(tokenList)

        console.log(`Looking for token with address: ${tokenAddress}`)

        // Find the token we're analyzing - try both with and without case sensitivity
        let targetToken = tokenList.find(
          (t: any) =>
            t.address && typeof t.address === "string" && t.address.toLowerCase() === tokenAddress.toLowerCase(),
        )

        if (!targetToken) {
          console.warn(`Token not found with exact match, trying alternative methods`)
          // Try to find by partial match
          targetToken = tokenList.find(
            (t: any) =>
              t.address &&
              typeof t.address === "string" &&
              (t.address.includes(tokenAddress) || tokenAddress.includes(t.address)),
          )
        }

        if (targetToken) {
          console.log(`Found token:`, targetToken)
          setOutputToken(targetToken)
        } else {
          // If we still can't find the token, create a basic token object with the address
          console.warn("Token not found in Jupiter token list, creating basic token object")
          setOutputToken({
            address: tokenAddress,
            symbol: "TOKEN",
            decimals: 9, // Default to 9 decimals (common for Solana tokens)
            name: "Unknown Token",
          })
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

  // Function to check wallet balance
  const checkBalance = useCallback(async () => {
    if (publicKey && connection) {
      try {
        setBalanceLoading(true)
        // Use getBalance with commitment: 'processed' to get the most up-to-date balance
        const balance = await connection.getBalance(publicKey, "processed")
        const solBalance = balance / LAMPORTS_PER_SOL
        console.log(`Wallet balance: ${solBalance} SOL (${balance} lamports)`)
        setWalletBalance(solBalance)
        return solBalance
      } catch (err) {
        console.error("Error checking wallet balance:", err)
        return null
      } finally {
        setBalanceLoading(false)
      }
    }
    return null
  }, [publicKey, connection])

  // Check wallet balance when connected
  useEffect(() => {
    if (connected) {
      checkBalance()
    } else {
      setWalletBalance(null)
    }
  }, [connected, checkBalance])

  // Get quote when input changes
  useEffect(() => {
    const getQuote = async () => {
      if (!inputToken || !outputToken || Number.parseFloat(inputAmount) <= 0) {
        console.log("Missing requirements for quote:", {
          hasInputToken: !!inputToken,
          hasOutputToken: !!outputToken,
          inputAmount,
        })
        return
      }

      setLoading(true)
      setError(null)

      try {
        const inputMint = swapDirection === "buy" ? inputToken.address : outputToken.address
        const outputMint = swapDirection === "buy" ? outputToken.address : inputToken.address
        const amount = Math.floor(
          Number.parseFloat(inputAmount) * 10 ** (swapDirection === "buy" ? inputToken.decimals : outputToken.decimals),
        )

        console.log("Getting quote with params:", {
          inputMint,
          outputMint,
          amount,
          slippage: slippage * 100,
        })

        // Always use legacy transactions for simplicity and reliability
        const quoteApi = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&onlyDirectRoutes=false&asLegacyTransaction=true`

        console.log("Quote API URL:", quoteApi)

        const response = await fetch(quoteApi)
        const quoteData = await response.json()

        console.log("Quote response:", quoteData)

        // Check if the response has a valid route
        if (quoteData && quoteData.routePlan && quoteData.routePlan.length > 0) {
          // This is the new Jupiter API response format
          setQuoteResponse(quoteData)

          // Calculate output amount from the response
          if (quoteData.outAmount) {
            const decimals = swapDirection === "buy" ? outputToken.decimals : inputToken.decimals
            setOutputAmount(
              (Number.parseInt(quoteData.outAmount) / 10 ** decimals).toFixed(decimals > 6 ? 6 : decimals),
            )
          }
        } else if (quoteData.data && quoteData.data.length > 0) {
          // This is the older Jupiter API response format
          setQuoteResponse(quoteData)

          // Calculate output amount
          const outAmount = quoteData.data[0].outAmount
          const decimals = swapDirection === "buy" ? outputToken.decimals : inputToken.decimals
          setOutputAmount((Number.parseInt(outAmount) / 10 ** decimals).toFixed(decimals > 6 ? 6 : decimals))
        } else {
          // Try with different parameters if no routes found
          console.log("No routes found, trying with different parameters")

          // Try with direct routes
          const directQuoteApi = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&onlyDirectRoutes=true&asLegacyTransaction=true`

          const directResponse = await fetch(directQuoteApi)
          const directQuoteData = await directResponse.json()

          if (
            (directQuoteData.routePlan && directQuoteData.routePlan.length > 0) ||
            (directQuoteData.data && directQuoteData.data.length > 0)
          ) {
            setQuoteResponse(directQuoteData)

            // Calculate output amount based on the response format
            if (directQuoteData.outAmount) {
              const decimals = swapDirection === "buy" ? outputToken.decimals : inputToken.decimals
              setOutputAmount(
                (Number.parseInt(directQuoteData.outAmount) / 10 ** decimals).toFixed(decimals > 6 ? 6 : decimals),
              )
            } else if (directQuoteData.data && directQuoteData.data.length > 0) {
              const outAmount = directQuoteData.data[0].outAmount
              const decimals = swapDirection === "buy" ? outputToken.decimals : inputToken.decimals
              setOutputAmount((Number.parseInt(outAmount) / 10 ** decimals).toFixed(decimals > 6 ? 6 : decimals))
            }
          } else {
            console.error("No routes found with any parameters", quoteData)
            setError(
              `No routes found for swapping ${inputToken.symbol} to ${outputToken.symbol}. This token may not be available for trading on Jupiter.`,
            )
            setQuoteResponse(null)
            setOutputAmount("0")
          }
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
  }, [inputAmount, inputToken, outputToken, slippage, swapDirection])

  const executeSwap = async () => {
    if (!publicKey || !signTransaction || !quoteResponse) {
      setError("Cannot execute swap: missing requirements")
      return
    }

    // Check if wallet has enough SOL for the transaction
    const currentBalance = await checkBalance()
    if (currentBalance !== null && currentBalance < 0.001) {
      setError("Your wallet doesn't have enough SOL to cover transaction fees. Please add some SOL to your wallet.")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Use Jupiter API to get the swap transaction
      const swapApi = "https://quote-api.jup.ag/v6/swap"

      const swapData = {
        quoteResponse: quoteResponse,
        userPublicKey: publicKey.toString(),
        wrapAndUnwrapSol: true, // Important for handling native SOL
        prioritizationFeeLamports: 1000, // Add a small priority fee to help transaction succeed
        asLegacyTransaction: true, // Always use legacy transactions for simplicity
        // Add this to create associated token accounts if they don't exist
        computeUnitPriceMicroLamports: 1000, // Add compute unit price to help transaction succeed
        dynamicComputeUnitLimit: true, // Dynamically adjust compute unit limit
      }

      console.log("Swap request data:", {
        ...swapData,
        quoteResponse: "...", // Don't log the full quote response
      })

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

      // Get a fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized")
      console.log("Got fresh blockhash:", blockhash)

      // For legacy transactions
      console.log("Using legacy transaction")
      const legacyTransaction = Transaction.from(transactionBuffer)

      // Update the transaction with a fresh blockhash
      legacyTransaction.recentBlockhash = blockhash
      legacyTransaction.lastValidBlockHeight = lastValidBlockHeight

      // Sign the transaction
      const signedTransaction = await signTransaction(legacyTransaction)

      // Send the signed transaction with better error handling
      try {
        // Use preflight to check for errors before sending
        const simulationResult = await connection.simulateTransaction(signedTransaction)

        if (simulationResult.value.err) {
          console.error("Transaction simulation failed:", simulationResult.value.err)
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`)
        }

        // If simulation succeeds, send the transaction
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false, // Enable preflight checks
          preflightCommitment: "confirmed",
          maxRetries: 3,
        })

        console.log("Swap transaction sent:", signature)

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed",
        )

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
        }

        console.log("Swap successful!")
        setSuccess(`Swap successful! Transaction ID: ${signature}`)

        // Reset input after successful swap
        setInputAmount("0.1")
        setOutputAmount("0")

        // Update wallet balance after successful swap
        setTimeout(() => {
          checkBalance()
        }, 2000) // Wait 2 seconds before checking balance to allow network to update
      } catch (sendError) {
        console.error("Error sending transaction:", sendError)

        // Check if it's a SendTransactionError and handle it specially
        if (sendError instanceof SendTransactionError) {
          const logs = sendError.logs ? sendError.logs.join("\n") : "No logs available"
          console.error("Transaction logs:", logs)

          // Check for specific errors
          if (sendError.message.includes("debit an account") || logs.includes("debit an account")) {
            throw new Error(
              "Transaction failed: Your wallet doesn't have enough tokens for this swap. Make sure you have enough SOL and the token you're trying to swap.",
            )
          } else if (sendError.message.includes("blockhash") || logs.includes("blockhash")) {
            throw new Error("Transaction failed due to blockhash issues. Please try again.")
          } else {
            throw new Error(`Transaction failed: ${sendError.message}`)
          }
        } else {
          throw sendError
        }
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
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading token information...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Check if we have a valid quote response
  const hasValidQuote = () => {
    if (!quoteResponse) return false

    // Check different possible response formats
    if (quoteResponse.routePlan && quoteResponse.routePlan.length > 0) return true
    if (quoteResponse.data && quoteResponse.data.length > 0) return true

    return false
  }

  // Get price impact from quote response
  const getPriceImpact = () => {
    if (!quoteResponse) return null

    // Check different possible response formats
    if (quoteResponse.priceImpactPct !== undefined) {
      return quoteResponse.priceImpactPct * 100
    }

    if (quoteResponse.data && quoteResponse.data.length > 0 && quoteResponse.data[0].priceImpactPct !== undefined) {
      return quoteResponse.data[0].priceImpactPct * 100
    }

    return null
  }

  // Get route information from quote response
  const getRouteInfo = () => {
    if (!quoteResponse) return null

    // Check different possible response formats
    if (quoteResponse.routePlan && quoteResponse.routePlan.length > 0) {
      return quoteResponse.routePlan.map((r: any) => r.swapInfo?.label || "Unknown").join(" → ")
    }

    if (quoteResponse.data && quoteResponse.data.length > 0 && quoteResponse.data[0].marketInfos) {
      return quoteResponse.data[0].marketInfos.map((m: any) => m.label).join(" → ")
    }

    return "Direct swap"
  }

  // Format SOL balance with appropriate decimal places
  const formatSolBalance = (balance: number | null) => {
    if (balance === null) return "0"

    // For very small balances (less than 0.001), show more decimal places
    if (balance < 0.001) {
      return balance.toFixed(9)
    } else if (balance < 0.01) {
      return balance.toFixed(6)
    } else {
      return balance.toFixed(4)
    }
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
          <div className="flex justify-between items-center">
            <span className="text-sm">Wallet Balance:</span>
            <div className="flex items-center">
              {balanceLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mr-1" onClick={checkBalance}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <span className="text-sm font-medium">{formatSolBalance(walletBalance)} SOL</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">You pay</label>
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

          {success && (
            <Alert variant="default" className="bg-green-50 text-green-800 border-green-200">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {hasValidQuote() && (
            <div className="text-sm text-muted-foreground">
              {getPriceImpact() !== null && (
                <div className="flex justify-between">
                  <span>Price Impact:</span>
                  <span>{getPriceImpact().toFixed(2)}%</span>
                </div>
              )}
              {getRouteInfo() && (
                <div className="flex justify-between">
                  <span>Route:</span>
                  <span className="text-right">{getRouteInfo()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {!connected ? (
          <WalletConnectButton className="w-full" />
        ) : (
          <Button
            className="w-full"
            onClick={executeSwap}
            disabled={
              loading ||
              !hasValidQuote() ||
              Number.parseFloat(inputAmount) <= 0 ||
              (walletBalance !== null && walletBalance < 0.001)
            }
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Swap ${swapDirection === "buy" ? "to" : "from"} ${outputToken?.symbol || "token"}`
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

