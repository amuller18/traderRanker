"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface TokenSearchProps {
  className?: string
}

// Solana addresses are base58 encoded and typically 32-44 characters
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function TokenSearch({ className = "" }: TokenSearchProps) {
  const [tokenAddress, setTokenAddress] = useState("")
  const [isInvalid, setIsInvalid] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedAddress = tokenAddress.trim()

    // Validate Solana address format
    if (!trimmedAddress) {
      setIsInvalid(true)
      setErrorMessage("Please enter a token address")
      return
    }

    if (!SOLANA_ADDRESS_REGEX.test(trimmedAddress)) {
      setIsInvalid(true)
      setErrorMessage("Invalid Solana address format (must be 32-44 base58 characters)")
      return
    }

    // Reset validation state
    setIsInvalid(false)
    setErrorMessage("")
    setIsLoading(true)

    // Navigate to the token detail page
    router.push(`/token-analysis?token=${encodeURIComponent(trimmedAddress)}`)
  }

  return (
    <form onSubmit={handleSearch} className={`${className}`}>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter Solana token contract address..."
            className={`pl-10 ${isInvalid ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            value={tokenAddress}
            onChange={(e) => {
              setTokenAddress(e.target.value)
              setIsInvalid(false)
              setErrorMessage("")
            }}
            disabled={isLoading}
          />
        </div>
        {isInvalid && <p className="text-sm text-red-500">{errorMessage}</p>}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Searching..." : "Search Token"}
        </Button>
      </div>
    </form>
  )
}

