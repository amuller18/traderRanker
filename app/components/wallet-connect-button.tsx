"use client"

import type React from "react"

import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

interface WalletConnectButtonProps {
  className?: string
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { publicKey, wallet, disconnect, connecting } = useWallet()
  const { setVisible } = useWalletModal()
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Ensure component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button className={className} disabled>
        Loading...
      </Button>
    )
  }

  const handleClick = () => {
    if (publicKey) {
      disconnect()
    } else {
      setVisible(true)
    }
  }

  const copyAddress = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <Button
      onClick={handleClick}
      className={className}
      variant={publicKey ? "outline" : "default"}
      disabled={connecting}
    >
      {connecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting
        </>
      ) : publicKey ? (
        <div className="flex items-center">
          <span>{formatAddress(publicKey.toString())}</span>
          <Button variant="ghost" size="sm" className="ml-2 h-auto p-0" onClick={copyAddress}>
            {copied ? "✓" : "📋"}
          </Button>
        </div>
      ) : (
        "Connect Wallet"
      )}
    </Button>
  )
}

