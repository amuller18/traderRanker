import { getTokenInfo, getTokenSupply } from "@/lib/token-api"
import { fetchAllTradesFiltered } from "@/app/actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  AlertTriangle,
  Globe,
  Twitter,
  MessageCircle,
  Users,
  ChevronLeft,
  Search,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { TokenSwap } from "@/app/components/token-swap"
import { TransactionChart } from "@/app/components/transaction-chart"
import { TokenAuthorityInfo } from "@/app/components/token-authority-info"
import { HolderDistribution } from "@/app/components/holder-distribution"
import { TradesTable } from "@/app/trades/components/trades-table"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { SidebarContentAdjuster } from "./client-sidebar-adjuster"

export const dynamic = "force-dynamic"
export const revalidate = 0 // Don't cache this page

// Add this component for the token search
function TokenSearchBar() {
  return (
    <div className="relative w-full max-w-md mx-auto mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="text" placeholder="Search for tokens..." className="pl-10 pr-4 py-2 w-full" />
      </div>
      <div className="absolute mt-1 w-full bg-background border rounded-md shadow-lg z-10 hidden">
        <div className="p-2 hover:bg-muted cursor-pointer">
          <div className="font-medium">FLAPPY</div>
          <div className="text-xs text-muted-foreground">Flappy Token</div>
        </div>
        <div className="p-2 hover:bg-muted cursor-pointer">
          <div className="font-medium">BONK</div>
          <div className="text-xs text-muted-foreground">Bonk Token</div>
        </div>
        <div className="p-2 hover:bg-muted cursor-pointer">
          <div className="font-medium">JUP</div>
          <div className="text-xs text-muted-foreground">Jupiter Token</div>
        </div>
      </div>
    </div>
  )
}

interface TokenDetailPageProps {
  params: {
    token: string
  }
}

export default async function TokenDetailPage({ params }: TokenDetailPageProps) {
  const tokenAddress = decodeURIComponent(params.token)
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    // Continue with assumption of mock data
  }

  // Fetch token info from API
  const tokenInfoArray = await getTokenInfo(tokenAddress)

  // If no token info found, show not found page
  if (!tokenInfoArray || tokenInfoArray.length === 0) {
    notFound()
  }

  // Get the first token info (main pair)
  const tokenInfo = tokenInfoArray[0]

  // Fetch token supply (optional)
  const tokenSupply = await getTokenSupply(tokenAddress)

  // Fetch all trades for this token
  const trades = await fetchAllTradesFiltered({
    roiRange: [-10, 10],
    marketCapRange: [0, 1000000000],
    dateRange: [new Date(0), new Date()],
    searchTerm: tokenAddress,
  })

  // Format price with appropriate decimal places
  const formatPrice = (price: string) => {
    const numPrice = Number.parseFloat(price)
    if (numPrice === 0) return "$0.00"
    if (numPrice < 0.000001) return `$${numPrice.toExponential(2)}`
    if (numPrice < 0.01) return `$${numPrice.toFixed(6)}`
    if (numPrice < 1) return `$${numPrice.toFixed(4)}`
    if (numPrice < 1000) return `$${numPrice.toFixed(2)}`
    if (numPrice < 1000000) return `$${(numPrice / 1000).toFixed(2)}K`
    return `$${(numPrice / 1000000).toFixed(2)}M`
  }

  // Format large numbers
  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return "N/A"
    if (num === 0) return "0"
    if (num < 1000) return num.toString()
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`
    if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`
    return `${(num / 1000000000).toFixed(1)}B`
  }

  // Format percentage
  const formatPercentage = (percent: number | undefined) => {
    if (percent === undefined) return "N/A"
    return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`
  }

  // Get CSS class for price change
  const getPriceChangeClass = (change: number | undefined) => {
    if (change === undefined) return ""
    if (change > 0) return "text-green-500"
    if (change < 0) return "text-red-500"
    return ""
  }

  // Format date from timestamp
  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Unknown"
    return format(new Date(timestamp), "MMM d, yyyy")
  }

  // Extract social links
  const getSocialLinks = () => {
    const links = []

    // Add website if available
    if (tokenInfo.info?.websites && tokenInfo.info.websites.length > 0) {
      links.push({
        name: "Website",
        url: tokenInfo.info.websites[0],
        icon: <Globe className="h-4 w-4" />,
      })
    }

    // Check if socials exist and is an object
    if (tokenInfo.info?.socials && tokenInfo.info.socials.length > 0) {
      const socialData = tokenInfo.info.socials[0]

      // Handle the case where socials might be an object with properties
      if (typeof socialData === "object" && socialData !== null) {
        // Check for Twitter
        if ("twitter" in socialData && typeof socialData.twitter === "string") {
          links.push({
            name: "Twitter",
            url: socialData.twitter,
            icon: <Twitter className="h-4 w-4" />,
          })
        }

        // Check for Telegram
        if ("telegram" in socialData && typeof socialData.telegram === "string") {
          links.push({
            name: "Telegram",
            url: socialData.telegram,
            icon: <MessageCircle className="h-4 w-4" />,
          })
        }

        // Check for Discord
        if ("discord" in socialData && typeof socialData.discord === "string") {
          links.push({
            name: "Discord",
            url: socialData.discord,
            icon: <MessageCircle className="h-4 w-4" />,
          })
        }
      }
      // Handle the case where socials might be a string
      else if (typeof socialData === "string") {
        const url = socialData
        let name = "Social"
        let icon = <Globe className="h-4 w-4" />

        if (url.includes("twitter")) {
          name = "Twitter"
          icon = <Twitter className="h-4 w-4" />
        } else if (url.includes("telegram")) {
          name = "Telegram"
          icon = <MessageCircle className="h-4 w-4" />
        } else if (url.includes("discord")) {
          name = "Discord"
          icon = <MessageCircle className="h-4 w-4" />
        }

        links.push({ name, url, icon })
      }
    }

    return links
  }

  // Prepare transaction data for the chart
  const prepareTransactionData = () => {
    const data: any = {}

    // Process transactions data for different timeframes
    if (tokenInfo.transactions) {
      // Add all available timeframes
      if (tokenInfo.transactions.m5) {
        data.m5 = {
          buys: tokenInfo.transactions.m5.buys || 0,
          sells: tokenInfo.transactions.m5.sells || 0,
          volume: tokenInfo.volume?.m5 || 0,
        }
      }

      if (tokenInfo.transactions.h1) {
        data.h1 = {
          buys: tokenInfo.transactions.h1.buys || 0,
          sells: tokenInfo.transactions.h1.sells || 0,
          volume: tokenInfo.volume?.h1 || 0,
        }
      }

      if (tokenInfo.transactions.h6) {
        data.h6 = {
          buys: tokenInfo.transactions.h6.buys || 0,
          sells: tokenInfo.transactions.h6.sells || 0,
          volume: tokenInfo.volume?.h6 || 0,
        }
      }

      if (tokenInfo.transactions.h12) {
        data.h12 = {
          buys: tokenInfo.transactions.h12.buys || 0,
          sells: tokenInfo.transactions.h12.sells || 0,
          volume: tokenInfo.volume?.h12 || 0,
        }
      }

      // Always include h24 data
      data.h24 = {
        buys: tokenInfo.transactions.buys || 0,
        sells: tokenInfo.transactions.sells || 0,
        volume: tokenInfo.volume?.h24 || 0,
      }
    }

    return data
  }

  const socialLinks = getSocialLinks()
  const transactionData = prepareTransactionData()

  // Calculate some stats for the trading history tab
  const highestRoi = trades.length > 0 ? Math.max(...trades.map((t) => t.roi_at_high)) : 0
  const lowestRoi = trades.length > 0 ? Math.min(...trades.map((t) => t.roi_at_low)) : 0
  const averageRoi = trades.length > 0 ? trades.reduce((sum, t) => sum + t.roi, 0) / trades.length : 0
  const totalTraders = trades.length > 0 ? new Set(trades.map((t) => t.caller)).size : 0
  const firstTradeDate =
    trades.length > 0 ? new Date(Math.min(...trades.map((t) => new Date(t.date_called).getTime()))) : new Date()
  const lastTradeDate =
    trades.length > 0 ? new Date(Math.max(...trades.map((t) => new Date(t.date_called).getTime()))) : new Date()

  // Get DEX information
  const getDexInfo = () => {
    // Extract DEX name from the pair data if available
    let dexName = "Jupiter"
    if (tokenInfo.mintAddress && tokenInfo.mintAddress.includes("raydium")) {
      dexName = "Raydium"
    } else if (tokenInfo.mintAddress && tokenInfo.mintAddress.includes("orca")) {
      dexName = "Orca"
    }

    return {
      name: dexName,
      liquidity: formatNumber(tokenInfo.liquidity?.usd) || "Unknown",
      volume24h: formatNumber(tokenInfo.volume?.h24) || "Unknown",
      pairs: tokenInfoArray.length,
    }
  }

  const dexInfo = getDexInfo()

  return (
    <div className="min-h-screen">
      <SidebarProvider className="pt-16">
        <SidebarContentAdjuster />
        <div className="relative">
          {/* Main Content */}
          <div className="transition-all duration-300 ease-in-out">
            <div id="main-content" className="container py-8 transition-all duration-300 ease-in-out">
              <div className="mb-8 flex justify-between items-center">
                <Link href="/token-analysis">
                  <Button variant="ghost" className="gap-2 pl-0">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Token Analysis
                  </Button>
                </Link>
                <div className="flex items-center gap-2">
                  <a href={`https://solscan.io/token/${tokenAddress}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      View on Solscan <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>

              <DataSourceStatus usingMockData={usingMockData} />

              {/* Token Search Bar */}
              <TokenSearchBar />

              <div className="flex flex-col gap-2 mb-8">
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {tokenInfo.baseToken.name || "Unknown Token"} ({tokenInfo.baseToken.symbol || "???"})
                  </h1>
                </div>
                <p className="text-muted-foreground break-all">{tokenAddress}</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Price</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatPrice(tokenInfo.priceUsd)}</div>
                    <p className={`text-xs ${getPriceChangeClass(tokenInfo.priceChange?.h24)}`}>
                      {formatPercentage(tokenInfo.priceChange?.h24)} (24h)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Market Cap</CardTitle>
                    {tokenInfo.priceChange?.h24 && tokenInfo.priceChange.h24 >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${formatNumber(tokenInfo.marketInfo.marketCap)}</div>
                    <p className="text-xs text-muted-foreground">FDV: ${formatNumber(tokenInfo.marketInfo.fdv)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${formatNumber(tokenInfo.volume?.h24)}</div>
                    <p className="text-xs text-muted-foreground">
                      Liquidity: ${formatNumber(tokenInfo.liquidity?.usd)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Created</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatDate(tokenInfo.marketInfo.pairCreatedAt)}</div>
                    <p className="text-xs text-muted-foreground">Supply: {formatNumber(tokenSupply)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* DEX Information Card */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>DEX Information</CardTitle>
                  <CardDescription>Trading information from decentralized exchanges</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Primary DEX</p>
                      <p className="text-lg font-medium">{dexInfo.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Liquidity</p>
                      <p className="text-lg font-medium">${dexInfo.liquidity}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">24h Volume</p>
                      <p className="text-lg font-medium">${dexInfo.volume24h}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Trading Pairs</p>
                      <p className="text-lg font-medium">{dexInfo.pairs}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="overview" className="mb-8">
                <TabsList className="grid grid-cols-3 mb-8">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="trading">Trading History</TabsTrigger>
                  <TabsTrigger value="holders">Holders</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-8">
                  {/* Price Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Price History</CardTitle>
                      <CardDescription>Token price movement over time</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[500px]">
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://birdeye.so/tv-widget/${tokenAddress}?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=America%2FDenver&chartLeftToolbar=show&theme=dark`}
                        frameBorder="0"
                        className="rounded-md"
                      ></iframe>
                    </CardContent>
                  </Card>

                  {/* Token Authority Information */}
                  <TokenAuthorityInfo tokenAddress={tokenAddress} />

                  {/* Transaction Activity with Tabs */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Transaction Activity</CardTitle>
                      <CardDescription>Detailed transaction metrics across different timeframes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(transactionData).length > 0 ? (
                        <TransactionChart data={transactionData} tokenSymbol={tokenInfo.baseToken.symbol || "TOKEN"} />
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <AlertTriangle className="h-8 w-8" />
                            <p>No transaction data available</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {socialLinks.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Token Information</CardTitle>
                        <CardDescription>Official links and social media</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-4">
                          {socialLinks.map((link, index) => (
                            <a
                              key={index}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                            >
                              {link.icon}
                              <span>{link.name}</span>
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {tokenInfoArray.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Trading Pairs</CardTitle>
                        <CardDescription>All available trading pairs for this token</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-4">Pair</th>
                                <th className="text-left py-2 px-4">DEX</th>
                                <th className="text-left py-2 px-4">Price</th>
                                <th className="text-left py-2 px-4">24h Change</th>
                                <th className="text-left py-2 px-4">24h Volume</th>
                                <th className="text-left py-2 px-4">Liquidity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tokenInfoArray.map((pair, index) => (
                                <tr key={index} className="border-b">
                                  <td className="py-2 px-4">{pair.baseToken.symbol}/USD</td>
                                  <td className="py-2 px-4">
                                    {pair.mintAddress?.includes("raydium")
                                      ? "Raydium"
                                      : pair.mintAddress?.includes("orca")
                                        ? "Orca"
                                        : "Jupiter"}
                                  </td>
                                  <td className="py-2 px-4">{formatPrice(pair.priceUsd)}</td>
                                  <td className={`py-2 px-4 ${getPriceChangeClass(pair.priceChange?.h24)}`}>
                                    {formatPercentage(pair.priceChange?.h24)}
                                  </td>
                                  <td className="py-2 px-4">${formatNumber(pair.volume?.h24)}</td>
                                  <td className="py-2 px-4">${formatNumber(pair.liquidity?.usd)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="trading" className="space-y-8">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
                        {averageRoi >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${averageRoi >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {(averageRoi * 100).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Across {trades.length} trades by {totalTraders} traders
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Highest ROI</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold text-green-500`}>{(highestRoi * 100).toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">Lowest: {(lowestRoi * 100).toFixed(1)}%</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Traders</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{totalTraders}</div>
                        <p className="text-xs text-muted-foreground">Unique traders calling this token</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">First Called</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {trades.length > 0 ? format(firstTradeDate, "MMM d, yyyy") : "N/A"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {trades.length > 0 ? `Last: ${format(lastTradeDate, "MMM d, yyyy")}` : "No trades recorded"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Trader Distribution</CardTitle>
                      <CardDescription>Traders who called this token</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {trades.length > 0 ? (
                        <div className="space-y-4">
                          {Array.from(new Set(trades.map((t) => t.caller))).map((trader) => {
                            const traderTrades = trades.filter((t) => t.caller === trader)
                            const avgRoi = traderTrades.reduce((sum, t) => sum + t.roi, 0) / traderTrades.length

                            return (
                              <div key={trader} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <Link href={`/rankings/${encodeURIComponent(trader)}`} className="hover:underline">
                                    {trader}
                                  </Link>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm text-muted-foreground">{traderTrades.length} calls</span>
                                  <span className={avgRoi >= 0 ? "text-green-500" : "text-red-500"}>
                                    {(avgRoi * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[100px] text-muted-foreground">
                          <p>No trader data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Trade History</CardTitle>
                      <CardDescription>All trades for this token</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TradesTable trades={trades} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="holders" className="space-y-8">
                  <HolderDistribution tokenAddress={tokenAddress} />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Sidebar Trigger - Fixed to the right side */}
          <SidebarTrigger className="fixed right-0 top-1/2 transform -translate-y-1/2 z-40 bg-primary text-primary-foreground rounded-l-md p-2 shadow-md">
            <ChevronLeft className="h-5 w-5" />
          </SidebarTrigger>

          {/* Swap Sidebar - Now floating */}
          <Sidebar side="right" className="z-40" size="sm" floating={true}>
            <div className="flex flex-col w-full">
              <SidebarHeader className="border-b p-4 flex flex-col items-center text-center bg-background">
                <h2 className="text-xl font-bold">Swap {tokenInfo.baseToken.symbol}</h2>
                <p className="text-sm text-muted-foreground">Trade {tokenInfo.baseToken.symbol} on Trader Ranker</p>
              </SidebarHeader>
              <SidebarContent className="p-4">
                <TokenSwap tokenAddress={tokenAddress} tokenSymbol={tokenInfo.baseToken.symbol || "TOKEN"} />
              </SidebarContent>
            </div>
          </Sidebar>
        </div>
      </SidebarProvider>
    </div>
  )
}

