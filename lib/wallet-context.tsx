"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Define the Phantom wallet type
type PhantomEvent = "connect" | "disconnect" | "accountChanged"

interface PhantomProvider {
  connect: () => Promise<{ publicKey: { toString: () => string } }>
  disconnect: () => Promise<void>
  on: (event: PhantomEvent, callback: () => void) => void
  isPhantom: boolean
  publicKey: { toString: () => string } | null
  isConnected: boolean | null
  signTransaction: (transaction: any) => Promise<any>
  signAllTransactions: (transactions: any[]) => Promise<any[]>
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>
}

interface WalletContextType {
  wallet: PhantomProvider | null
  publicKey: string | null
  connected: boolean
  connecting: boolean
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
}

// Create the wallet context
const WalletContext = createContext<WalletContextType>({
  wallet: null,
  publicKey: null,
  connected: false,
  connecting: false,
  connectWallet: async () => {},
  disconnectWallet: async () => {},
})

// Hook to use the wallet context
export const useWallet = () => useContext(WalletContext)

// Provider component
export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<PhantomProvider | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Check if Phantom is available
  useEffect(() => {
    const checkForPhantom = async () => {
      try {
        // Check if window is defined (browser environment)
        if (typeof window !== "undefined") {
          // @ts-ignore
          const phantom = window.phantom?.solana

          if (phantom?.isPhantom) {
            setWallet(phantom)

            // Check if already connected
            if (phantom.isConnected && phantom.publicKey) {
              setPublicKey(phantom.publicKey.toString())
              setConnected(true)
            }

            // Listen for connection events
            phantom.on("connect", () => {
              if (phantom.publicKey) {
                setPublicKey(phantom.publicKey.toString())
                setConnected(true)
              }
            })

            // Listen for disconnect events
            phantom.on("disconnect", () => {
              setPublicKey(null)
              setConnected(false)
            })

            // Listen for account change events
            phantom.on("accountChanged", () => {
              if (phantom.publicKey) {
                setPublicKey(phantom.publicKey.toString())
              } else {
                setPublicKey(null)
                setConnected(false)
              }
            })
          }
        }
      } catch (error) {
        console.error("Error checking for Phantom wallet:", error)
      }
    }

    checkForPhantom()
  }, [])

  // Connect to Phantom wallet
  const connectWallet = async () => {
    try {
      if (wallet) {
        setConnecting(true)
        const { publicKey } = await wallet.connect()
        setPublicKey(publicKey.toString())
        setConnected(true)
        setConnecting(false)
      } else {
        window.open("https://phantom.app/", "_blank")
      }
    } catch (error) {
      console.error("Error connecting to Phantom wallet:", error)
      setConnecting(false)
    }
  }

  // Disconnect from Phantom wallet
  const disconnectWallet = async () => {
    try {
      if (wallet) {
        await wallet.disconnect()
        setPublicKey(null)
        setConnected(false)
      }
    } catch (error) {
      console.error("Error disconnecting from Phantom wallet:", error)
    }
  }

  return (
    <WalletContext.Provider
      value={{
        wallet,
        publicKey,
        connected,
        connecting,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

