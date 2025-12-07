"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, ExternalLink, Loader2, Wallet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function TestTransactionPage() {
  const { toast } = useToast()
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)

  // Check if Phantom wallet is available
  const getProvider = () => {
    if (typeof window === "undefined") {
      return null
    }

    if ("phantom" in window) {
      // @ts-ignore
      const provider = window.phantom?.solana

      if (provider?.isPhantom) {
        console.log("Phantom wallet provider found")
        return provider
      }
    }

    console.log("Phantom wallet not found")
    return null
  }

  // Connect wallet function
  const connectWallet = async () => {
    setConnecting(true)
    setError(null)

    try {
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found. Please install Phantom wallet extension")
      }

      // Connect to wallet
      try {
        const { publicKey } = await provider.connect()
        console.log("Wallet connected successfully:", publicKey.toString())
        setPublicKey(publicKey.toString())
        setWalletConnected(true)

        toast({
          title: "Wallet connected",
          description: "Your wallet has been connected successfully",
        })
      } catch (connectError) {
        console.error("Error connecting to wallet:", connectError)
        throw new Error("Failed to connect to wallet. Please check your Phantom extension and try again.")
      }
    } catch (error) {
      console.error("Error in connectWallet:", error)
      setError(error instanceof Error ? error.message : "Failed to connect wallet. Please try again.")
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      })
    } finally {
      setConnecting(false)
    }
  }

  // Disconnect wallet function
  const disconnectWallet = async () => {
    try {
      const provider = getProvider()
      if (provider) {
        await provider.disconnect()
        setPublicKey(null)
        setWalletConnected(false)

        toast({
          title: "Wallet disconnected",
          description: "Your wallet has been disconnected",
        })
      }
    } catch (error) {
      console.error("Error disconnecting wallet:", error)
      toast({
        title: "Error disconnecting",
        description: "There was an error disconnecting your wallet",
        variant: "destructive",
      })
    }
  }

  // Test Jupiter API transaction
  const testJupiterTransaction = async () => {
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
    setTxSignature(null)

    try {
      const provider = getProvider()
      if (!provider) {
        throw new Error("Phantom wallet not found")
      }

      // Step 1: Get a quote from Jupiter API
      // SOL to USDC swap
      const inputMint = "So11111111111111111111111111111111111111112" // SOL
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC
      const inputAmount = "1000000" // 0.001 SOL in lamports

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: inputAmount,
        slippageBps: "50", // 0.5% slippage
      })

      console.log("Getting quote from Jupiter API...")
      const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?${params.toString()}`)

      if (!quoteResponse.ok) {
        throw new Error(`Failed to get quote: ${quoteResponse.status}`)
      }

      const quoteData = await quoteResponse.json()
      console.log("Quote received:", quoteData)

      // Step 2: Get swap transaction
      console.log("Getting swap transaction from Jupiter API...")
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
      console.log("Swap transaction received:", swapData)

      // Step 3: Get the transaction data
      const { swapTransaction } = swapData
      console.log("Transaction data:", swapTransaction.slice(0, 50) + "...")

      // Step 4: Sign and send transaction
      console.log("Sending transaction to wallet for signing...")

      // IMPORTANT: The transaction from Jupiter is already serialized and encoded in base64
      // We need to pass it directly to the wallet without additional processing
      const signResult = await provider.signAndSendTransaction(swapTransaction)

      console.log("Transaction signed and sent:", signResult)
      setTxSignature(signResult.signature)

      toast({
        title: "Transaction sent",
        description: `Transaction signature: ${signResult.signature.substring(0, 8)}...`,
      })
    } catch (error) {
      console.error("Error testing Jupiter transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to send transaction")
      toast({
        title: "Transaction failed",
        description: error instanceof Error ? error.message : "Failed to send transaction",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Test Transaction Page</h1>
      <p className="text-muted-foreground mb-6">
        This page allows you to test transactions with the Phantom wallet to debug any issues.
      </p>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Wallet Connection</CardTitle>
            <CardDescription>Connect your Phantom wallet to test transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {walletConnected ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 text-green-800 rounded-md flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Wallet Connected</p>
                    <p className="text-sm text-green-700 break-all">{publicKey}</p>
                  </div>
                </div>
                <Button onClick={disconnectWallet} variant="outline" className="w-full">
                  Disconnect Wallet
                </Button>
              </div>
            ) : (
              <Button onClick={connectWallet} disabled={connecting} className="w-full" size="lg">
                {connecting ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Connect Phantom Wallet
                  </div>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Jupiter Swap Transaction</CardTitle>
            <CardDescription>Test a swap transaction using Jupiter API (0.001 SOL to USDC)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                onClick={testJupiterTransaction}
                disabled={!walletConnected || loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  "Test Jupiter Swap Transaction"
                )}
              </Button>

              <p className="text-sm text-muted-foreground">
                This will create a test swap transaction for 0.001 SOL to USDC using Jupiter API. No confirmation will
                be requested - it will execute immediately if you approve the transaction.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual SOL Transfer</CardTitle>
            <CardDescription>Use Phantom's built-in send feature</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm">
                For simple SOL transfers, it's recommended to use Phantom's built-in send feature:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Open your Phantom wallet extension</li>
                <li>Click on SOL in your assets list</li>
                <li>Click the "Send" button</li>
                <li>Enter the recipient address and amount</li>
                <li>Confirm the transaction</li>
              </ol>
              <div className="flex justify-center mt-4">
                <a
                  href="https://phantom.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary hover:underline"
                >
                  Open Phantom Website
                  <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Error</h3>
              <p className="text-red-700 whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        </div>
      )}

      {txSignature && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-800">Transaction Sent Successfully</h3>
              <p className="text-green-700">Transaction Signature:</p>
              <p className="font-mono text-sm break-all">{txSignature}</p>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm mt-2 inline-block"
              >
                View on Solana Explorer
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

