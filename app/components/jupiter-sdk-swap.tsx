"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import Script from "next/script"

export function JupiterSdkSwap() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [jupiterLoaded, setJupiterLoaded] = useState(false)

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

  // Test Jupiter swap using the SDK
  const testJupiterSwap = async () => {
    if (!walletConnected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    if (!jupiterLoaded) {
      toast({
        title: "Jupiter SDK not loaded",
        description: "Please wait for Jupiter SDK to load",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)
    addLog("Starting Jupiter SDK swap test...")

    try {
      // @ts-ignore - Access the global Jupiter object loaded via script
      const Jupiter = window.Jupiter

      if (!Jupiter) {
        throw new Error("Jupiter SDK not loaded")
      }

      addLog("Initializing Jupiter...")

      // Initialize Jupiter
      const jupiter = await Jupiter.load({
        connection: new window.solanaWeb3.Connection("https://api.mainnet-beta.solana.com"),
        cluster: "mainnet-beta",
        // @ts-ignore
        user: new window.solanaWeb3.PublicKey(publicKey),
      })

      addLog("Jupiter initialized successfully")

      // Define parameters for a small SOL to BONK swap
      const inputMint = "So11111111111111111111111111111111111111112" // SOL
      const outputMint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" // BONK
      const amount = 0.01 * 1e9 // 0.01 SOL in lamports

      // Get routes
      addLog("Getting routes...")
      const routes = await jupiter.computeRoutes({
        // @ts-ignore
        inputMint: new window.solanaWeb3.PublicKey(inputMint),
        // @ts-ignore
        outputMint: new window.solanaWeb3.PublicKey(outputMint),
        amount,
        slippageBps: 50,
      })

      if (!routes.routesInfos.length) {
        throw new Error("No routes found")
      }

      addLog(`Found ${routes.routesInfos.length} routes`)

      // Select the best route
      const bestRoute = routes.routesInfos[0]
      addLog(`Selected best route with output amount: ${bestRoute.outAmount}`)

      // Execute the swap
      addLog("Executing swap...")
      const { execute } = await jupiter.exchange({
        routeInfo: bestRoute,
      })

      // Execute the swap
      const result = await execute()

      if (result.error) {
        throw new Error(`Swap failed: ${result.error.message || JSON.stringify(result.error)}`)
      }

      addLog(`Swap executed successfully!`)
      addLog(`Signature: ${result.signature}`)

      toast({
        title: "Swap executed",
        description: `Transaction signature: ${result.signature.substring(0, 8)}...`,
      })
    } catch (error) {
      console.error("Error testing Jupiter SDK swap:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to test Jupiter SDK swap"
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
    <>
      <Script
        src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"
        onLoad={() => {
          console.log("Solana Web3.js loaded")
        }}
      />

      <Script
        src="https://unpkg.com/@jup-ag/core@latest/dist/index.umd.js"
        onLoad={() => {
          console.log("Jupiter SDK loaded")
          setJupiterLoaded(true)
        }}
        onError={() => {
          console.error("Failed to load Jupiter SDK")
          setError("Failed to load Jupiter SDK")
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Jupiter SDK Swap Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!walletConnected ? (
              <Button onClick={connectWallet} className="w-full">
                Connect Wallet
              </Button>
            ) : (
              <Button onClick={testJupiterSwap} disabled={loading || !jupiterLoaded} className="w-full">
                {loading ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </div>
                ) : !jupiterLoaded ? (
                  "Loading Jupiter SDK..."
                ) : (
                  "Test Jupiter Swap (0.01 SOL to BONK)"
                )}
              </Button>
            )}

            {error && <div className="text-sm text-red-500 mt-2">{error}</div>}

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

