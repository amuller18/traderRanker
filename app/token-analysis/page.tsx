import { TokenSearch } from "@/app/components/token-search"
import { PageLayout } from "@/app/components/page-layout"
import { getTokenInfo, getTokenSupply } from "@/lib/token-api"
import { fetchAllTrades } from "@/lib/api-client"
import { isUsingMockData } from "@/lib/trader-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TokenInfo } from "@/lib/token-data"
import type { JSX } from "react"
import { PageHeader } from "@/app/page-header";
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
import { TokenTradeHistory } from "@/app/token-analysis/components/token-trade-history"
import { Input } from "@/components/ui/input"
import { JupiterSwap } from "@/app/components/jupiter-swap"
import Big from 'big.js'

const formatPrice = (value: string | undefined): string => {
  if (!value) return "0.00"
  const num = Number(value)
  if (isNaN(num)) return "0.00"

  if (num < 0.000001) {
    return num.toExponential(2)
  }
  if (num < 0.01) {
    return num.toFixed(6)
  }
  if (num < 1) {
    return num.toFixed(4)
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatNumber = (value: string | undefined): string => {
  if (!value) return "0"
  const num = Number(value)
  if (isNaN(num)) return "0"

  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + 'B'
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M'
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + 'K'
  }
  return num.toFixed(2)
}

const formatPercentage = (value: string | undefined): string => {
  if (!value) return "0.00%"
  const num = Number(value)
  if (isNaN(num)) return "0.00%"
  return num.toFixed(2) + '%'
}

const formatDate = (timestamp: number | undefined): string => {
  if (!timestamp) return "Unknown"
  try {
    return format(new Date(timestamp * 1000), "MMM d, yyyy")
  } catch {
    return "Unknown"
  }
}

const getPriceChangeClass = (change: number | undefined): string => {
  if (!change) return 'text-muted-foreground';
  return change >= 0 ? 'text-green-500' : 'text-red-500';
};

interface TokenAnalysisPageProps {
  searchParams: Promise<{
    token?: string
  }>
}

export default async function TokenAnalysisPage(props: TokenAnalysisPageProps) {
  const searchParams = await props.searchParams
  const tokenParam = searchParams.token

  // If no token query param, show the token search page
  if (!tokenParam) {
    return (
      <PageLayout
        title="Token Analysis"
        description="Search for any token by contract address to view detailed performance metrics and trading history."
      >
        <div className="max-w-2xl mx-auto">
          <TokenSearch className="mb-8" />

          <div className="glass-card rounded-2xl shadow-elevated p-10 text-center animate-fade-in">
            <h2 className="text-2xl font-bold mb-3">Enter a Token Address</h2>
            <p className="text-muted-foreground text-lg">
              Enter a Solana token contract address above to view detailed analytics, trading history, and performance
              metrics.
            </p>
          </div>
        </div>
      </PageLayout>
    )
  }

  // Otherwise, show token detail page
  // Note: searchParams are already decoded by Next.js, no need to decode again
  const tokenAddress = tokenParam
  let usingMockData = true

  try {
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
  }

  // Fetch token data
  let response
  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        {
          next: { revalidate: 0 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://dexscreener.com/',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://dexscreener.com',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        }
      )

      if (response.ok) {
        break // Success, exit retry loop
      }

      if (response.status === 429) {
        // Rate limited, wait and retry
        console.log(`Rate limited by DexScreener, retrying in ${(retryCount + 1) * 1000}ms...`)
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000))
        retryCount++
        continue
      }

      // Other error, don't retry
      break

    } catch (error) {
      console.error(`Error fetching token data (attempt ${retryCount + 1}):`, error)
      retryCount++
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  if (!response || !response.ok) {
    return (
      
      <div className="container mx-auto p-4">
        <PageHeader/>
        <h1 className="text-2xl font-bold mb-4">Token Data Unavailable</h1>
        <p>The requested token data could not be fetched. This might be due to:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Rate limiting from the data provider</li>
          <li>Token not found in the database</li>
          <li>Temporary service outage</li>
        </ul>
        <p className="mt-4">Please try again in a few moments.</p>
      </div>
    )
  }

  const data = await response.json()
  const tokenInfoArray = data.pairs || []
  const tokenInfo = tokenInfoArray[0] || null

  if (!tokenInfo) {
    return (
      <div>
        <PageHeader/>
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Token Not Found</h1>
          <p>The requested token could not be found.</p>
        </div>
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

  // Calculate ROI stats using price from tokenInfo
  const currentTokenPrice = Number(tokenInfo.priceUsd) || 0
  const calculateRoi = (entryPrice: number) => {
    if (!entryPrice || !currentTokenPrice) return 0
    if (entryPrice === 0) return 0
    return ((currentTokenPrice - entryPrice) / entryPrice) * 100
  }

  const highestRoi = filteredTrades.length > 0
    ? Math.max(...filteredTrades.map(t => calculateRoi(Number(t.entry_price))))
    : 0
  const lowestRoi = filteredTrades.length > 0
    ? Math.min(...filteredTrades.map(t => calculateRoi(Number(t.entry_price))))
    : 0
  const averageRoi = filteredTrades.length > 0
    ? filteredTrades.reduce((sum, t) => sum + calculateRoi(Number(t.entry_price)), 0) / filteredTrades.length
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
      <PageHeader/>
      <SidebarProvider className="container py-10 px-4 ">
        <div className="relative">
          {/* Main Content */}
          <div className="container py-10 px-4 ">
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
              <div className="mb-8">
                <TokenSearch />
              </div>

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

                  <TokenTradeHistory
                    trades={filteredTrades}
                    tokenSymbol={tokenInfo.baseToken?.symbol || "this token"}
                    currentPrice={currentTokenPrice}
                  />
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
