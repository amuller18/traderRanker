import { getTokenInfo, getTokenSupply } from "@/lib/token-api"
import { fetchAllTrades } from "@/app/actions/trader-actions"
import { isUsingMockData } from "@/lib/trader-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TokenInfo } from "@/lib/token-data"
import type { JSX } from "react"
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
  ArrowUpRight,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { TransactionChart } from "@/app/components/transaction-chart"
import { TokenAuthorityInfo } from "@/app/components/token-authority-info"
import { HolderDistribution } from "@/app/components/holder-distribution"
import { TradesTable } from "@/app/trades/components/trades-table"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { SidebarContentAdjuster } from "./client-sidebar-adjuster"
import { JupiterSwap } from "@/app/components/jupiter-swap"
import Big from 'big.js'
import { formatPrice, formatNumber, formatPercentage, formatDate } from "./utils/formatting"

export const dynamic = "force-dynamic"
export const revalidate = 0 // Don't cache this page

const getPriceChangeClass = (change: number | undefined): string => {
  if (!change) return 'text-muted-foreground';
  return change >= 0 ? 'text-green-500' : 'text-red-500';
};

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

export default async function TokenDetailPage({
  params,
}: {
  params: { token: string }
}) {
  const { token } = await Promise.resolve(params)
  const tokenAddress = token
  let usingMockData = true

  try {
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
  }

  // Fetch token data
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
    { next: { revalidate: 0 } }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch token data: ${response.statusText}`)
  }

  const data = await response.json()
  const tokenInfoArray = data.pairs || []
  const tokenInfo = tokenInfoArray[0] || null

  if (!tokenInfo) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Token Not Found</h1>
        <p>The requested token could not be found.</p>
      </div>
    )
  }

  // Calculate total liquidity across all pairs
  const totalLiquidity = tokenInfoArray.reduce((sum: number, pair: any) => {
    return sum + (Number(pair.liquidity?.usd) || 0)
  }, 0)

  // Fetch token supply
  const tokenSupply = await getTokenSupply(tokenAddress)

  // Fetch all trades for this token
  const trades = await fetchAllTrades()
  const filteredTrades = trades.filter(trade => trade.ca.toLowerCase() === tokenAddress.toLowerCase())

  // Calculate ROI stats using the market cap from tokenInfo
  const currentMc = Number(tokenInfo.marketCap) || 0
  const calculateRoi = (initialMc: number) => {
    if (!initialMc || !currentMc) return 0
    if (currentMc < 10000) {
      const rawRoi = ((currentMc - initialMc) / initialMc) * 100
      return Math.min(rawRoi, 1000)
    }
    return ((currentMc - initialMc) / initialMc) * 100
  }

  const highestRoi = filteredTrades.length > 0 
    ? Math.max(...filteredTrades.map(t => calculateRoi(Number(t.initial_mc)))) 
    : 0
  const lowestRoi = filteredTrades.length > 0 
    ? Math.min(...filteredTrades.map(t => calculateRoi(Number(t.initial_mc)))) 
    : 0
  const averageRoi = filteredTrades.length > 0 
    ? filteredTrades.reduce((sum, t) => sum + calculateRoi(Number(t.initial_mc)), 0) / filteredTrades.length 
    : 0
  const totalTraders = filteredTrades.length > 0 ? new Set(filteredTrades.map((t) => t.caller)).size : 0
  const firstTradeDate = filteredTrades.length > 0 ? new Date(Math.min(...filteredTrades.map((t) => new Date(t.date_called).getTime()))) : new Date()
  const lastTradeDate = filteredTrades.length > 0 ? new Date(Math.max(...filteredTrades.map((t) => new Date(t.date_called).getTime()))) : new Date()
  const firstTrader = filteredTrades.length > 0 ? filteredTrades.find(t => new Date(t.date_called).getTime() === Math.min(...filteredTrades.map(t => new Date(t.date_called).getTime())))?.caller : ""

  // Process token data
  const currentPrice = formatPrice(tokenInfo.priceUsd?.toString())
  const priceChange24h = formatPercentage(tokenInfo.priceChange?.h24?.toString())
  const marketCap = formatNumber(tokenInfo.marketCap?.toString() || "0")
  const fdv = formatNumber(tokenInfo.fdv?.toString() || "0")
  const volume24h = formatNumber(tokenInfo.volume?.h24?.toString())
  const liquidity = formatNumber(tokenInfo.liquidity?.usd?.toString())
  const pairCreatedAt = formatDate(tokenInfo.pairCreatedAt)

  // Debug log to check market cap values
  console.log('Market Cap Data:', {
    raw: tokenInfo.marketCap,
    formatted: marketCap,
    currentMc: currentMc
  })

  // Extract social links
  interface SocialLink {
    name: string
    url: string
    icon: JSX.Element
  }

  const getSocialLinks = (): SocialLink[] => {
    const links: SocialLink[] = []

    if (!tokenInfo) return links

    if (tokenInfo.info?.websites && tokenInfo.info.websites.length > 0) {
      const website = tokenInfo.info.websites[0]
      if (typeof website === 'object' && website.url) {
        links.push({
          name: website.label || "Website",
          url: website.url,
          icon: <Globe className="h-4 w-4" />,
        })
      }
    }

    if (tokenInfo.info?.socials && tokenInfo.info.socials.length > 0) {
      tokenInfo.info.socials.forEach((social: any) => {
        if (typeof social === "object" && social !== null) {
          if (social.type === "twitter" && social.url) {
            links.push({
              name: "Twitter",
              url: social.url,
              icon: <Twitter className="h-4 w-4" />,
            })
          } else if (social.type === "telegram" && social.url) {
            links.push({
              name: "Telegram",
              url: social.url,
              icon: <MessageCircle className="h-4 w-4" />,
            })
          } else if (social.type === "discord" && social.url) {
            links.push({
              name: "Discord",
              url: social.url,
              icon: <MessageCircle className="h-4 w-4" />,
            })
          }
        }
      })
    }

    return links
  }

  const socialLinks = getSocialLinks()

  // Prepare transaction data for the chart
  const prepareTransactionData = () => {
    const data: any = {}

    if (!tokenInfo) return data

    if (tokenInfo.txns) {
      if (tokenInfo.txns.m5) {
        data.m5 = {
          buys: tokenInfo.txns.m5.buys || 0,
          sells: tokenInfo.txns.m5.sells || 0,
          volume: tokenInfo.volume?.m5 || 0,
        }
      }

      if (tokenInfo.txns.h1) {
        data.h1 = {
          buys: tokenInfo.txns.h1.buys || 0,
          sells: tokenInfo.txns.h1.sells || 0,
          volume: tokenInfo.volume?.h1 || 0,
        }
      }

      if (tokenInfo.txns.h6) {
        data.h6 = {
          buys: tokenInfo.txns.h6.buys || 0,
          sells: tokenInfo.txns.h6.sells || 0,
          volume: tokenInfo.volume?.h6 || 0,
        }
      }

      if (tokenInfo.txns.h24) {
        data.h24 = {
          buys: tokenInfo.txns.h24.buys || 0,
          sells: tokenInfo.txns.h24.sells || 0,
          volume: tokenInfo.volume?.h24 || 0,
        }
      }
    }

    return data
  }

  const transactionData = prepareTransactionData()

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
                    {tokenInfo.baseToken?.name || "Unknown Token"} ({tokenInfo.baseToken?.symbol || "???"})
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
                    <div className="text-2xl font-bold">${currentPrice}</div>
                    <p className={`text-xs ${getPriceChangeClass(tokenInfo.priceChange?.h24)}`}>
                      {priceChange24h} (24h)
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
                    <div className="text-2xl font-bold">${marketCap}</div>
                    <p className="text-xs text-muted-foreground">FDV: ${fdv}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${volume24h}</div>
                    <p className="text-xs text-muted-foreground">
                      Total Liquidity: ${formatNumber(totalLiquidity.toString())}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Created</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pairCreatedAt}</div>
                    <p className="text-xs text-muted-foreground">
                      Supply: {formatNumber(tokenSupply.toString())}
                    </p>
                  </CardContent>
                </Card>
              </div>

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
                        <TransactionChart data={transactionData} tokenSymbol={tokenInfo.baseToken?.symbol || "TOKEN"} />
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
                              {tokenInfoArray.map((pair: TokenInfo, index: number) => (
                                <tr key={index} className="border-b">
                                  <td className="py-2 px-4">{pair.baseToken.symbol}/USD</td>
                                  <td className="py-2 px-4">
                                    {pair.dexId === "raydium" ? "Raydium" :
                                     pair.dexId === "orca" ? "Orca" :
                                     pair.dexId === "meteora" ? "Meteora" : "Jupiter"}
                                  </td>
                                  <td className="py-2 px-4">{formatPrice(pair.priceUsd?.toString())}</td>
                                  <td className={`py-2 px-4 ${getPriceChangeClass(pair.priceChange?.h24)}`}>
                                    {formatPercentage(pair.priceChange?.h24?.toString())}
                                  </td>
                                  <td className="py-2 px-4">${formatNumber(pair.volume?.h24?.toString())}</td>
                                  <td className="py-2 px-4">${formatNumber(pair.liquidity?.usd?.toString())}</td>
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
                          {formatPercentage(averageRoi.toString())}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Across {filteredTrades.length} trades by {totalTraders} traders
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Highest ROI</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-500">{formatPercentage(highestRoi.toString())}</div>
                        <p className="text-xs text-muted-foreground">Lowest: {formatPercentage(lowestRoi.toString())}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">First Trade</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{format(firstTradeDate, "MMM d, yyyy")}</div>
                        <p className="text-xs text-muted-foreground">
                          By {firstTrader || "Unknown"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{filteredTrades.length}</div>
                        <p className="text-xs text-muted-foreground">By {totalTraders} unique traders</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Trade History</CardTitle>
                      <CardDescription>All trades for {tokenInfo.baseToken?.symbol || "this token"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="p-3 text-left font-medium">Date</th>
                              <th className="p-3 text-left font-medium">Trader</th>
                              <th className="p-3 text-left font-medium">Initial MC</th>
                              <th className="p-3 text-left font-medium">Current MC</th>
                              <th className="p-3 text-left font-medium">ROI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTrades.map((trade, i) => {
                              const roi = calculateRoi(Number(trade.initial_mc))
                              return (
                                <tr key={i} className="border-b">
                                  <td className="p-3">{format(new Date(trade.date_called), "MMM d, yyyy HH:mm")}</td>
                                  <td className="p-3">
                                    <Link
                                      href={`/rankings/${encodeURIComponent(trade.caller)}`}
                                      className="hover:underline text-primary"
                                    >
                                      {trade.caller}
                                    </Link>
                                  </td>
                                  <td className="p-3">{formatNumber(trade.initial_mc.toString())}</td>
                                  <td className="p-3">{formatNumber(currentMc.toString())}</td>
                                  <td className={`p-3 ${roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                                    {roi === 0 ? 'N/A' : formatPercentage(roi.toString())}
                                  </td>
                                </tr>
                              )
                            })}
                            {filteredTrades.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-3 text-center text-muted-foreground">
                                  No trades found for this token
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
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
                <h2 className="text-xl font-bold">Swap {tokenInfo.baseToken?.symbol}</h2>
                <p className="text-sm text-muted-foreground">Trade {tokenInfo.baseToken?.symbol} on Trader Ranker</p>
              </SidebarHeader>
              <SidebarContent className="p-4">
                <JupiterSwap tokenAddress={tokenAddress} tokenSymbol={tokenInfo.baseToken?.symbol || "TOKEN"} />
              </SidebarContent>
            </div>
          </Sidebar>
        </div>
      </SidebarProvider>
    </div>
  )
}

