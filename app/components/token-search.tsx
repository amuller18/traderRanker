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

export function TokenSearch({ className = "" }: TokenSearchProps) {
  const [tokenAddress, setTokenAddress] = useState("")
  const [isInvalid, setIsInvalid] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation - check if the address is at least 32 characters
    if (tokenAddress.trim().length < 32) {
      setIsInvalid(true)
      return
    }

    // Reset validation state
    setIsInvalid(false)
    setIsLoading(true)

    // Navigate to the token detail page
    router.push(`/token-analysis/${encodeURIComponent(tokenAddress.trim())}`)
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
            }}
            disabled={isLoading}
          />
        </div>
        {isInvalid && <p className="text-sm text-red-500">Please enter a valid Solana token address</p>}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Searching..." : "Search Token"}
        </Button>
      </div>
    </form>
  )
}

