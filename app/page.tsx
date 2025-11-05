import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Trophy, Copy, TrendingUp, Shield, Zap, Users, Star, Sparkles, Target, Activity } from "lucide-react"
import { isUsingMockData } from "@/lib/trader-data"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { PageHeader } from "./page-header"
import { Card, CardContent } from "@/components/ui/card"

export const dynamic = "force-dynamic"
export const revalidate = 300 // Cache for 5 minutes

export default async function LandingPage() {
  let usingMockData = true

  try {
    // Check if we're using mock data
    usingMockData = await isUsingMockData()
  } catch (error) {
    console.error("Error checking if using mock data:", error)
    // Continue with assumption of mock data
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <PageHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-40 bg-gradient-to-br from-primary/5 via-primary/10 to-background relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] [mask-image:radial-gradient(white,transparent_70%)]" />
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

          <div className="container px-4 md:px-6 relative">
            <DataSourceStatus usingMockData={usingMockData} />

            <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="flex flex-col justify-center space-y-6">
                <div className="inline-flex items-center rounded-full border bg-background/80 backdrop-blur-sm px-3 py-1 text-sm w-fit">
                  <Sparkles className="h-4 w-4 mr-2 text-primary" />
                  <span className="font-medium">Powered by On-Chain Data</span>
                </div>
                <div className="space-y-4">
                  <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl/none bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Discover & Follow Top Solana Traders
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground text-lg md:text-xl leading-relaxed">
                    Analyze real-time on-chain data to identify elite traders. Track performance, assess risk management,
                    and benchmark your trading strategy against the best.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/rankings">
                    <Button size="lg" className="px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow">
                      View Top Rankings <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/copy-trader">
                    <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-2">
                      Start Copy Trading
                    </Button>
                  </Link>
                </div>

                {/* Social Proof Stats */}
                <div className="flex flex-wrap gap-6 pt-4">
                  <div className="flex flex-col">
                    <div className="text-3xl font-bold">10K+</div>
                    <div className="text-sm text-muted-foreground">Traders Tracked</div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-3xl font-bold">$50M+</div>
                    <div className="text-sm text-muted-foreground">Volume Analyzed</div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-3xl font-bold">99.9%</div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center lg:justify-end">
                <div className="relative w-full max-w-[600px]">
                  <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl border bg-gradient-to-br from-primary/5 to-background">
                    <Image
                      src="/trading-dashboard.jpg"
                      alt="TraderRanker Dashboard"
                      width={600}
                      height={600}
                      className="rounded-2xl object-cover"
                      priority
                    />
                    {/* Floating stat cards */}
                    <div className="absolute -bottom-4 -left-4 bg-background/95 backdrop-blur-sm rounded-xl shadow-xl p-4 border-2 border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                          <Trophy className="h-6 w-6 text-yellow-500" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Elite Trader</div>
                          <div className="font-bold text-lg">Top 5%</div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -top-4 -right-4 bg-background/95 backdrop-blur-sm rounded-xl shadow-xl p-4 border-2 border-green-500/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Total Returns</div>
                          <div className="font-bold text-lg text-green-500">+243%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
                Why Choose TraderRanker?
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Advanced analytics and transparent metrics to help you make informed trading decisions
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg w-fit">
                      <BarChart3 className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">Real-Time Analytics</h3>
                    <p className="text-muted-foreground">
                      Track performance metrics updated in real-time from on-chain data. Monitor profits, win rates, and risk-adjusted returns.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg w-fit">
                      <Shield className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold">Risk Management</h3>
                    <p className="text-muted-foreground">
                      Comprehensive risk metrics including max drawdown, Sharpe ratio, and portfolio volatility analysis.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-green-500/10 rounded-lg w-fit">
                      <Trophy className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold">Leaderboards</h3>
                    <p className="text-muted-foreground">
                      Compete with top traders and see how your strategy ranks. Filter by timeframe, asset, and trading style.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg w-fit">
                      <Zap className="h-8 w-8 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-bold">Instant Insights</h3>
                    <p className="text-muted-foreground">
                      Get actionable insights on trader strategies, position sizing, and market timing patterns.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-lg w-fit">
                      <Users className="h-8 w-8 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-bold">Community Driven</h3>
                    <p className="text-muted-foreground">
                      Join a community of serious traders. Share strategies, learn from the best, and grow together.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-pink-500/10 rounded-lg w-fit">
                      <Activity className="h-8 w-8 text-pink-500" />
                    </div>
                    <h3 className="text-xl font-bold">Backtesting Tools</h3>
                    <p className="text-muted-foreground">
                      Test strategies against historical data. Validate your approach before risking real capital.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <Link href="/rankings">
                <Button size="lg" variant="outline" className="text-base font-semibold border-2">
                  Explore All Features <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Copy Trading CTA Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-primary/10 via-blue-500/5 to-background" id="copy-trader">
          <div className="container px-4 md:px-6">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="order-2 lg:order-1 flex justify-center">
                <div className="relative w-full max-w-[550px]">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-primary/20">
                    <Image
                      src="/copy-trading.jpg"
                      alt="Copy Trading Feature"
                      width={550}
                      height={450}
                      className="rounded-2xl object-cover"
                    />
                    {/* Overlay badge */}
                    <div className="absolute -bottom-4 -right-4 bg-background/95 backdrop-blur-sm rounded-xl shadow-xl p-5 border-2 border-blue-500/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Copy className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Auto-Sync</div>
                          <div className="font-bold text-lg">Copy Trades</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 flex flex-col justify-center space-y-6">
                <div className="inline-flex items-center rounded-full border bg-background/80 backdrop-blur-sm px-3 py-1 text-sm w-fit">
                  <Sparkles className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="font-medium">Coming Soon</span>
                </div>
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl xl:text-5xl">
                    Automatically Copy Top Traders
                  </h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Mirror the trades of elite performers in real-time. Set your risk parameters, select your traders,
                    and let our advanced system handle the execution.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-background/50 border">
                    <div className="p-2 bg-primary/10 rounded-lg mt-1">
                      <Copy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Automated Execution</h3>
                      <p className="text-muted-foreground">
                        Trades execute automatically in your wallet based on your selected traders. No manual intervention needed.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-background/50 border">
                    <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                      <Target className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Smart Risk Controls</h3>
                      <p className="text-muted-foreground">
                        Configure position limits, stop-losses, and take-profit levels to protect your capital.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-background/50 border">
                    <div className="p-2 bg-blue-500/10 rounded-lg mt-1">
                      <Star className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Verified Traders Only</h3>
                      <p className="text-muted-foreground">
                        Choose from curated traders with proven track records and transparent performance data.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Link href="/copy-trader">
                    <Button size="lg" className="px-8 text-base font-semibold shadow-lg">
                      Get Early Access <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/rankings">
                    <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-2">
                      View Top Traders
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="w-full py-16 md:py-24 bg-gradient-to-r from-primary to-primary/80">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl xl:text-5xl text-primary-foreground">
                Ready to Elevate Your Trading?
              </h2>
              <p className="text-primary-foreground/90 text-lg md:text-xl max-w-2xl">
                Join thousands of traders using TraderRanker to discover opportunities, analyze performance, and learn from the best.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/rankings">
                  <Button size="lg" variant="secondary" className="px-10 text-base font-semibold shadow-xl hover:shadow-2xl">
                    Start Exploring Now <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/copy-trader">
                  <Button size="lg" variant="outline" className="px-10 text-base font-semibold border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                    Join Waitlist
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-4 sm:flex-row py-8 w-full shrink-0 items-center px-4 md:px-6 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-lg">TraderRanker</span>
        </div>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TraderRanker. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-6">
          <Link href="#" className="text-sm hover:text-primary transition-colors font-medium">
            Terms of Service
          </Link>
          <Link href="#" className="text-sm hover:text-primary transition-colors font-medium">
            Privacy Policy
          </Link>
          <Link href="#" className="text-sm hover:text-primary transition-colors font-medium">
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  )
}

