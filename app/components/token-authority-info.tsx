"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react"

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

  useEffect(() => {
    async function fetchTokenAuthorities() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/token-authorities?address=${encodeURIComponent(tokenAddress)}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch token authorities: ${response.status}`)
        }

        const data = await response.json()
        setAuthorities(data)
      } catch (err) {
        console.error("Error fetching token authorities:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch token authorities")
      } finally {
        setLoading(false)
      }
    }

    fetchTokenAuthorities()
  }, [tokenAddress])

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
          <div className="text-red-500 py-2">{error}</div>
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

