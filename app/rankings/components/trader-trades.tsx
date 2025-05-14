"use client"

import { useState, useEffect, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { Trade } from "@/lib/trader-data"
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { formatMarketCap, formatROI } from "@/lib/utils"
import type { TokenInfo } from "@/lib/token-data"

interface TraderTradesProps {
  trades: Trade[]
  currentPage: number
  totalPages: number
  totalTrades: number
}

export function TraderTrades({ trades, currentPage, totalPages, totalTrades }: TraderTradesProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tokenInfos, setTokenInfos] = useState<Record<string, number>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({})
  const fetchedTokensRef = useRef<Set<string>>(new Set())

  const getPerformanceClass = (roi: number) => {
    if (roi > 0) return "text-green-500"
    if (roi < 0) return "text-red-500"
    return "text-muted-foreground"
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`?${params.toString()}`)
  }

  // Update ROI for a single trade
  const updateTradeRoi = async (trade: Trade) => {
    if (fetchedTokensRef.current.has(trade.ca)) return
    
    setLoadingStates(prev => ({ ...prev, [trade.ca]: true }))
    setErrorStates(prev => ({ ...prev, [trade.ca]: false }))
    
    try {
      console.log('Fetching token info for:', trade.ca)
      const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/token-info?address=${encodeURIComponent(trade.ca)}`
      console.log('Request URL:', url)
      
      const response = await fetch(url)
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        console.error('Error response:', response.status, response.statusText)
        if (response.status === 404) {
          setErrorStates(prev => ({ ...prev, [trade.ca]: true }))
          return
        }
        throw new Error(`Failed to fetch token info: ${response.status} ${response.statusText}`)
      }
      
      const tokenInfo: TokenInfo = await response.json()
      console.log('Received token info:', tokenInfo)
      
      const fdv = tokenInfo?.marketInfo?.fdv
      console.log('FDV value:', fdv)
      
      if (typeof fdv === 'number' && !isNaN(fdv)) {
        setTokenInfos(prev => ({
          ...prev,
          [trade.ca]: fdv
        }))
        fetchedTokensRef.current.add(trade.ca)
      } else {
        console.warn('Invalid FDV value:', fdv)
        setErrorStates(prev => ({ ...prev, [trade.ca]: true }))
      }
    } catch (error) {
      console.error(`Error fetching token info for ${trade.ca}:`, error)
      setErrorStates(prev => ({ ...prev, [trade.ca]: true }))
    } finally {
      setLoadingStates(prev => ({ ...prev, [trade.ca]: false }))
    }
  }

  // Update ROI for all trades
  useEffect(() => {
    const updates = trades.reduce((acc, trade) => {
      if (!tokenInfos[trade.ca] && !loadingStates[trade.ca] && !fetchedTokensRef.current.has(trade.ca)) {
        acc.push(trade)
      }
      return acc
    }, [] as Trade[])

    const processUpdates = async () => {
      await Promise.all(updates.map(trade => updateTradeRoi(trade)))
    }

    if (updates.length > 0) {
      processUpdates()
    }
  }, [trades])

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium w-[120px]">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Token</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Initial MC</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Current MC</th>
                <th className="px-4 py-3 text-left text-sm font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const currentMc = tokenInfos[trade.ca] || trade.current_mc
                const roi = ((currentMc - trade.initial_mc) / trade.initial_mc) * 100
                const isLoading = loadingStates[trade.ca]
                const hasError = errorStates[trade.ca]

                return (
                  <tr key={`${trade.caller}_${trade.ca}_${trade.date_called}`} className="border-b">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{format(new Date(trade.date_called), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/token-analysis/${trade.ca}`} className="text-primary hover:underline">
                        {trade.ca}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatMarketCap(trade.initial_mc)}</td>
                    <td className="px-4 py-3 text-sm">
                      {isLoading ? (
                        <span className="animate-pulse text-muted-foreground">•••</span>
                      ) : hasError ? (
                        <span className="text-muted-foreground">N/A</span>
                      ) : (
                        formatMarketCap(currentMc)
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm ${getPerformanceClass(roi)}`}>
                      {isLoading ? (
                        <span className="animate-pulse text-muted-foreground">•••%</span>
                      ) : hasError ? (
                        <span className="text-muted-foreground">N/A</span>
                      ) : (
                        `${roi.toFixed(1)}%`
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

