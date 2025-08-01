"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, ShieldAlert, ShieldCheck, Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TokenAuthorityInfoProps {
  tokenAddress: string
}

interface AuthorityInfo {
  address: string | null
  disabled: boolean
}

interface TokenAuthorities {
  mint_authority: AuthorityInfo
  freeze_authority: AuthorityInfo
}

export function TokenAuthorityInfo({ tokenAddress }: TokenAuthorityInfoProps) {
  const [authorities, setAuthorities] = useState<TokenAuthorities | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    let abortController: AbortController | null = null

    async function fetchTokenAuthorities() {
      // Cancel any existing request
      if (abortController) {
        abortController.abort()
      }

      // Create new AbortController for this request
      abortController = new AbortController()
      const signal = abortController.signal

      if (!isMounted) return

      setLoading(true)
      setError(null)

      try {
        // Add timeout to the fetch request
        const timeoutId = setTimeout(() => {
          if (abortController) {
            abortController.abort()
          }
        }, 30000) // 30 second timeout

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/token-authorities?address=${encodeURIComponent(tokenAddress)}`,
          { 
            signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          }
        )

        clearTimeout(timeoutId)

        if (!isMounted) return

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          let errorMessage = errorData.error || `Failed to fetch token authorities: ${response.status}`
          
          // Handle specific error cases
          if (response.status === 429) {
            errorMessage = "Rate limit exceeded. Please try again in a few moments."
          } else if (response.status === 503) {
            errorMessage = "Service temporarily unavailable. Please try again later."
          }
          
          throw new Error(errorMessage)
        }

        const data = await response.json()
        if (!isMounted) return

        if (data.error) {
          throw new Error(data.error)
        }

        setAuthorities(data)
      } catch (err) {
        if (!isMounted) return

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            console.log('Request was aborted')
            return
          }
          console.error("Error fetching token authorities:", err)
          setError(err.message)
        } else {
          console.error("Unknown error:", err)
          setError("Failed to fetch token authorities")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchTokenAuthorities()

    return () => {
      isMounted = false
      if (abortController) {
        abortController.abort()
      }
    }
  }, [tokenAddress, retryCount])

  // Handle retry
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1)
  }

  // Helper function to format address for display
  const formatAddress = (address: string | null) => {
    if (!address) return "None"
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`
  }

  // Helper function to get Solscan URL for an address
  const getSolscanUrl = (address: string) => {
    return `https://solscan.io/account/${address}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Authorities</CardTitle>
        <CardDescription>Mint and freeze authority information</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-4 text-red-500 gap-4">
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              <p className="text-center">{error}</p>
            </div>
            <Button onClick={handleRetry} variant="outline" size="sm" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : authorities ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Mint Authority</span>
                  {authorities.mint_authority.disabled ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Disabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <ShieldAlert className="h-3 w-3 mr-1" /> Enabled
                    </Badge>
                  )}
                </div>
                {authorities.mint_authority.address && (
                  <a
                    href={getSolscanUrl(authorities.mint_authority.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center text-sm"
                  >
                    {formatAddress(authorities.mint_authority.address)}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {authorities.mint_authority.disabled
                  ? "The mint authority is disabled, meaning no new tokens can be minted."
                  : "The mint authority is enabled, meaning the authority can mint new tokens."}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Freeze Authority</span>
                  {authorities.freeze_authority.disabled ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Disabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <ShieldAlert className="h-3 w-3 mr-1" /> Enabled
                    </Badge>
                  )}
                </div>
                {authorities.freeze_authority.address && (
                  <a
                    href={getSolscanUrl(authorities.freeze_authority.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center text-sm"
                  >
                    {formatAddress(authorities.freeze_authority.address)}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {authorities.freeze_authority.disabled
                  ? "The freeze authority is disabled, meaning accounts cannot be frozen."
                  : "The freeze authority is enabled, meaning the authority can freeze token accounts."}
              </p>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Security Note:</strong> Tokens with enabled mint or freeze authorities may pose higher risks as
                the authority holders can mint new tokens (potentially causing inflation) or freeze user accounts.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground py-2">No authority information available</div>
        )}
      </CardContent>
    </Card>
  )
}

