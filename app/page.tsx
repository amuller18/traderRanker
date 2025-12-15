import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Trophy, Copy, TrendingUp, Shield, Zap, Users, Star, Sparkles, Target, Activity } from "lucide-react"
import { PageHeader } from "./page-header"
import { Card, CardContent } from "@/components/ui/card"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <PageHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-40 gradient-background relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px] [mask-image:radial-gradient(white,transparent_85%)]" />
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-[500px] h-[500px] bg-chart-2/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "5s" }} />

          <div className="container px-4 md:px-6 relative">

            <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="flex flex-col justify-center space-y-6 animate-fade-in">
                <div className="inline-flex items-center rounded-full border glass px-4 py-1.5 text-sm w-fit shadow-elevated">
                  <Sparkles className="h-4 w-4 mr-2 text-primary animate-pulse" />
                  <span className="font-semibold">Powered by On-Chain Data</span>
                </div>
                <div className="space-y-4">
                  <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl/none text-gradient">
                    Discover & Follow Top Solana Traders
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground text-lg md:text-xl leading-relaxed">
                    Analyze real-time on-chain data to identify elite traders. Track performance, assess risk management,
                    and benchmark your trading strategy against the best.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/rankings">
                    <Button size="lg" className="px-8 text-base font-semibold shadow-elevated-lg hover:shadow-elevated-xl transition-all hover-lift">
                      View Top Rankings <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/copy-trader">
                    <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-2 hover-lift">
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
                <div className="relative w-full max-w-[600px] animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
                  <div className="relative aspect-square rounded-2xl overflow-hidden shadow-elevated-xl border glass-card">
                    <Image
                      src="/trading-dashboard.jpg"
                      alt="TraderRanker Dashboard"
                      width={600}
                      height={600}
                      className="rounded-2xl object-cover"
                      priority
                    />
                    {/* Floating stat cards */}
                    <div className="absolute -bottom-4 -left-4 glass-card rounded-xl shadow-elevated-lg p-4 border-2 border-warning/30 animate-scale-in" style={{ animationDelay: "0.4s" }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning/10 rounded-lg">
                          <Trophy className="h-6 w-6 text-warning" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Elite Trader</div>
                          <div className="font-bold text-lg">Top 5%</div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -top-4 -right-4 glass-card rounded-xl shadow-elevated-lg p-4 border-2 border-success/30 animate-scale-in" style={{ animationDelay: "0.6s" }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-success/10 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-success" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Total Returns</div>
                          <div className="font-bold text-lg text-success">+243%</div>
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
              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <BarChart3 className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">Real-Time Analytics</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Track performance metrics updated in real-time from on-chain data. Monitor profits, win rates, and risk-adjusted returns.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-chart-1/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Shield className="h-8 w-8 text-chart-1" />
                    </div>
                    <h3 className="text-xl font-bold">Risk Management</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Comprehensive risk metrics including max drawdown, Sharpe ratio, and portfolio volatility analysis.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-success/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Trophy className="h-8 w-8 text-success" />
                    </div>
                    <h3 className="text-xl font-bold">Leaderboards</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Compete with top traders and see how your strategy ranks. Filter by timeframe, asset, and trading style.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-chart-4/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Zap className="h-8 w-8 text-chart-4" />
                    </div>
                    <h3 className="text-xl font-bold">Instant Insights</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Get actionable insights on trader strategies, position sizing, and market timing patterns.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-warning/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Users className="h-8 w-8 text-warning" />
                    </div>
                    <h3 className="text-xl font-bold">Community Driven</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Join a community of serious traders. Share strategies, learn from the best, and grow together.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-chart-5/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Activity className="h-8 w-8 text-chart-5" />
                    </div>
                    <h3 className="text-xl font-bold">Backtesting Tools</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Test strategies against historical data. Validate your approach before risking real capital.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <Link href="/rankings">
                <Button size="lg" variant="outline" className="text-base font-semibold border-2 hover-lift shadow-elevated">
                  Explore All Features <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Copy Trading CTA Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 gradient-background" id="copy-trader">
          <div className="container px-4 md:px-6">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="order-2 lg:order-1 flex justify-center">
                <div className="relative w-full max-w-[550px]">
                  <div className="relative rounded-2xl overflow-hidden shadow-elevated-xl border glass-card">
                    <Image
                      src="/copy-trading.jpg"
                      alt="Copy Trading Feature"
                      width={550}
                      height={450}
                      className="rounded-2xl object-cover"
                    />
                    {/* Overlay badge */}
                    <div className="absolute -bottom-4 -right-4 glass-card rounded-xl shadow-elevated-lg p-5 border-2 border-chart-1/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-chart-1/10 rounded-lg">
                          <Copy className="h-6 w-6 text-chart-1" />
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
                <div className="inline-flex items-center rounded-full border glass px-4 py-1.5 text-sm w-fit shadow-elevated">
                  <Sparkles className="h-4 w-4 mr-2 text-chart-1 animate-pulse" />
                  <span className="font-semibold">Coming Soon</span>
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
                  <div className="flex items-start gap-4 p-5 rounded-xl glass-card shadow-elevated hover-lift transition-all">
                    <div className="p-2 bg-primary/10 rounded-lg mt-1">
                      <Copy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Automated Execution</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Trades execute automatically in your wallet based on your selected traders. No manual intervention needed.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-xl glass-card shadow-elevated hover-lift transition-all">
                    <div className="p-2 bg-success/10 rounded-lg mt-1">
                      <Target className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Smart Risk Controls</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Configure position limits, stop-losses, and take-profit levels to protect your capital.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-xl glass-card shadow-elevated hover-lift transition-all">
                    <div className="p-2 bg-chart-1/10 rounded-lg mt-1">
                      <Star className="h-5 w-5 text-chart-1" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Verified Traders Only</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Choose from curated traders with proven track records and transparent performance data.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Link href="/copy-trader">
                    <Button size="lg" className="px-8 text-base font-semibold shadow-elevated-lg hover:shadow-elevated-xl transition-all hover-lift">
                      Get Early Access <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/rankings">
                    <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-2 hover-lift">
                      View Top Traders
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="w-full py-16 md:py-24 gradient-primary relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px]" />
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl xl:text-5xl text-primary-foreground animate-fade-in">
                Ready to Elevate Your Trading?
              </h2>
              <p className="text-primary-foreground/90 text-lg md:text-xl max-w-2xl leading-relaxed">
                Join thousands of traders using TraderRanker to discover opportunities, analyze performance, and learn from the best.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/rankings">
                  <Button size="lg" variant="secondary" className="px-10 text-base font-semibold shadow-elevated-xl hover-lift">
                    Start Exploring Now <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/copy-trader">
                  <Button size="lg" variant="outline" className="px-10 text-base font-semibold border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary hover-lift">
                    Join Waitlist
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-4 sm:flex-row py-10 w-full shrink-0 items-center px-4 md:px-6 border-t bg-muted/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
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

