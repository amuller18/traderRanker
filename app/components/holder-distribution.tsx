"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Loader2, Users, AlertTriangle, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface HolderDistributionProps {
  tokenAddress: string
}

interface HolderStats {
  totalHolders: number
  topHolderPercentage: number
  top10HolderPercentage: number
  distributionData: Array<{
    name: string
    value: number
    color: string
  }>
}

interface Holder {
  owner: string
  owner_supply: number
  owner_supply_percentage: number
  address?: string
  amount?: string
  decimals?: number
  uiAmount?: number
  uiAmountString?: string
}

export function HolderDistribution({ tokenAddress }: HolderDistributionProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topHolders, setTopHolders] = useState<Holder[]>([])
  const [stats, setStats] = useState<HolderStats | null>(null)
  const [totalHolders, setTotalHolders] = useState<number>(0)
  const [retryCount, setRetryCount] = useState(0)
  const [chartView, setChartView] = useState<"grouped" | "individual">("grouped")

  useEffect(() => {
    let isMounted = true
    let abortController: AbortController | null = null

    const fetchData = async () => {
      // Cancel any existing request
      if (abortController) {
        abortController.abort()
      }

      // Create new AbortController for this request
      abortController = new AbortController()
      const signal = abortController.signal

      if (!isMounted) return

      try {
        setLoading(true)
        setError(null)

        // Add timeout to the fetch request
        const timeoutId = setTimeout(() => {
          if (abortController) {
            abortController.abort()
          }
        }, 30000) // 30 second timeout

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/token-holders?address=${encodeURIComponent(tokenAddress)}&t=${Date.now()}`,
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
          let errorMessage = errorData.error || `Failed to fetch holder data: ${response.status}`
          
          // Handle specific error cases
          if (response.status === 429) {
            errorMessage = "Rate limit exceeded. Please try again in a few moments."
          } else if (response.status === 503) {
            errorMessage = "Service temporarily unavailable. Please try again later."
          }
          
          console.error("API Error:", errorMessage)
          throw new Error(errorMessage)
        }

        const data = await response.json()

        if (!isMounted) return

        if (data.error) {
          console.error("Data Error:", data.error)
          throw new Error(data.error)
        }

        if (!isMounted) return

        if (!data.topHolders || !data.stats) {
          console.error("Invalid data format:", data)
          throw new Error("Invalid data format received from server")
        }

        setTopHolders(data.topHolders)
        setStats(data.stats)
        setTotalHolders(data.totalHolders || 0)
      } catch (err) {
        if (!isMounted) return

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            console.log('Request was aborted')
            return
          }
          console.error("Error fetching holder data:", err)
          setError(err.message)
        } else {
          console.error("Unknown error:", err)
          setError("Failed to fetch holder data")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
      if (abortController) {
        abortController.abort()
      }
    }
  }, [tokenAddress, retryCount])

  // Format percentage for display
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Format wallet address for display
  const formatWalletAddress = (address: string) => {
    if (address.startsWith("Others")) return address
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`
  }

  // Format token amount
  const formatTokenAmount = (amount: number) => {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`
    return amount.toFixed(2)
  }

  // Prepare data for individual holders pie chart
  const prepareIndividualHoldersData = () => {
    if (!topHolders || topHolders.length === 0) return []

    // Use only top 15 holders for readability, combine the rest as "Others"
    const maxDisplayHolders = 15

    if (topHolders.length <= maxDisplayHolders) {
      return topHolders.map((holder, index) => ({
        name: formatWalletAddress(holder.owner),
        value: holder.owner_supply_percentage,
        color: getHolderColor(index, topHolders.length),
      }))
    }

    // Take top holders and combine the rest
    const displayHolders = topHolders.slice(0, maxDisplayHolders)
    const otherHolders = topHolders.slice(maxDisplayHolders)

    const otherPercentage = otherHolders.reduce((sum, holder) => sum + holder.owner_supply_percentage, 0)

    return [
      ...displayHolders.map((holder, index) => ({
        name: formatWalletAddress(holder.owner),
        value: holder.owner_supply_percentage,
        color: getHolderColor(index, maxDisplayHolders),
      })),
      {
        name: `Others (${otherHolders.length} holders)`,
        value: otherPercentage,
        color: "#94a3b8", // slate-400
      },
    ]
  }

  // Generate colors for holders
  const getHolderColor = (index: number, total: number) => {
    // Color palette for holders
    const colors = [
      "#ef4444", // red-500
      "#f97316", // orange-500
      "#f59e0b", // amber-500
      "#eab308", // yellow-500
      "#84cc16", // lime-500
      "#22c55e", // green-500
      "#10b981", // emerald-500
      "#14b8a6", // teal-500
      "#06b6d4", // cyan-500
      "#0ea5e9", // sky-500
      "#3b82f6", // blue-500
      "#6366f1", // indigo-500
      "#8b5cf6", // violet-500
      "#a855f7", // purple-500
      "#d946ef", // fuchsia-500
      "#ec4899", // pink-500
      "#f43f5e", // rose-500
    ]

    return colors[index % colors.length]
  }

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded p-2 shadow-md">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm">{`${payload[0].value.toFixed(2)}%`}</p>
        </div>
      )
    }
    return null
  }

  // Get concentration risk assessment
  const getConcentrationRisk = () => {
    if (!stats) return ""

    if (stats.topHolderPercentage > 20) {
      return "High concentration risk. The top holder controls a significant portion of the supply."
    } else if (stats.top10HolderPercentage > 70) {
      return "Moderate concentration risk. The top 10 holders control a majority of the supply."
    } else {
      return "Good distribution. No single holder controls a large portion of the supply."
    }
  }

  // Handle retry
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1)
  }

  // Get chart data based on view mode
  const getChartData = () => {
    if (chartView === "individual") {
      return prepareIndividualHoldersData()
    }
    return stats?.distributionData || []
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Holder Distribution</CardTitle>
          <CardDescription>Analysis of token holder concentration</CardDescription>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={handleRetry} className="flex items-center gap-1">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col justify-center items-center py-8 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Fetching holder data from Solana blockchain...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-red-500 gap-4">
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-8 w-8" />
              <p className="text-center">{error}</p>
            </div>
            <Button onClick={handleRetry} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : !stats || topHolders.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-8 w-8" />
              <p>No holder data available</p>
              <Button onClick={handleRetry} variant="outline" size="sm" className="mt-2">
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-[350px] flex flex-col justify-center">
              <Tabs
                value={chartView}
                onValueChange={(v) => setChartView(v as "grouped" | "individual")}
                className="mb-4"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="grouped">Grouped View</TabsTrigger>
                  <TabsTrigger value="individual">Individual Holders</TabsTrigger>
                </TabsList>
              </Tabs>

              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getChartData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      chartView === "individual" ? name : `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={chartView === "individual" ? false : true}
                  >
                    {getChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  {chartView === "grouped" && <Legend />}
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Statistics */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-medium">Total Holders: {totalHolders.toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Top Holder</div>
                    <div className="text-xl font-bold text-red-500">{formatPercentage(stats.topHolderPercentage)}</div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Top 10 Holders</div>
                    <div className="text-xl font-bold text-orange-500">
                      {formatPercentage(stats.top10HolderPercentage)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  <strong>Concentration Analysis:</strong> {getConcentrationRisk()}
                </p>
              </div>
            </div>

            {/* Top Holders Table */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-medium mb-2">Top Holders</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topHolders.map((holder, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <a
                            href={`https://solscan.io/account/${holder.owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-blue-500"
                          >
                            {formatWalletAddress(holder.owner)}
                          </a>
                        </TableCell>
                        <TableCell className="text-right">{formatTokenAmount(holder.owner_supply)}</TableCell>
                        <TableCell className="text-right">{formatPercentage(holder.owner_supply_percentage)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

