import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Trophy, Copy, TrendingUp, Shield, Zap, Users, Star, Sparkles, Target, Activity, CheckCircle2 } from "lucide-react"
import { PageHeader } from "./page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
                  <span className="font-semibold">100% On-Chain Verified Data</span>
                </div>
                <div className="space-y-4">
                  <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl/none text-gradient">
                    Stop Losing Money.<br />Start Following Winners.
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground text-lg md:text-xl leading-relaxed">
                    Why guess when you can copy? Find the top 1% of Solana traders, see their exact moves,
                    and mirror their success—all verified on-chain.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/rankings">
                    <Button size="lg" className="px-8 text-base font-semibold shadow-elevated-lg hover:shadow-elevated-xl transition-all hover-lift">
                      Find Winning Traders <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-2 hover-lift">
                      Create Free Account
                    </Button>
                  </Link>
                </div>

                {/* Social Proof Stats */}
                <div className="flex flex-wrap gap-8 pt-6 border-t border-border/50">
                  <div className="flex flex-col">
                    <div className="text-3xl font-bold text-primary">10,000+</div>
                    <div className="text-sm text-muted-foreground">Traders Analyzed</div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-3xl font-bold text-primary">$50M+</div>
                    <div className="text-sm text-muted-foreground">Daily Volume Tracked</div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-3xl font-bold text-primary">24/7</div>
                    <div className="text-sm text-muted-foreground">Real-Time Updates</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center lg:justify-end">
                <div className="relative w-full max-w-[600px] animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
                  <div className="relative rounded-2xl overflow-hidden shadow-elevated-xl border glass-card">
                    <Image
                      src="/trading-dashboard.jpg"
                      alt="TraderRanker Dashboard showing top performing traders"
                      width={600}
                      height={600}
                      className="rounded-2xl object-cover"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="w-full py-16 md:py-24 bg-muted/30">
          <div className="container px-4 md:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-1">The Problem</Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
                95% of Traders Lose Money. The Top 1% Don&apos;t Share Their Secrets.
              </h2>
              <p className="text-muted-foreground text-lg">
                Until now. TraderRanker pulls every trade directly from the blockchain—no fake screenshots,
                no cherry-picked results. Just raw, verifiable performance data.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="text-destructive font-semibold mb-2">Without TraderRanker</div>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">✕</span>
                      Following random Twitter &quot;gurus&quot;
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">✕</span>
                      Trusting unverified PnL screenshots
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">✕</span>
                      Missing trades while you sleep
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">✕</span>
                      FOMO buying at the top
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5 md:scale-105 shadow-elevated-lg">
                <CardContent className="pt-6">
                  <div className="text-primary font-semibold mb-2">With TraderRanker</div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Follow verified top performers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>100% on-chain proof</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Real-time trade alerts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Enter with smart money</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-success/20 bg-success/5">
                <CardContent className="pt-6">
                  <div className="text-success font-semibold mb-2">Your Results</div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Star className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                      <span>Trade with confidence</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Star className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                      <span>Learn from the best</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Star className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                      <span>Build winning strategies</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Star className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                      <span>Join the top 5%</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 px-4 py-1">Features</Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
                Everything You Need to Trade Smarter
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Professional-grade tools that give you the same edge as institutional traders
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Trophy className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">Elite Trader Rankings</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      See who&apos;s actually making money. Ranked by real returns, not followers. Filter by strategy, timeframe, and risk level.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-chart-1/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <BarChart3 className="h-8 w-8 text-chart-1" />
                    </div>
                    <h3 className="text-xl font-bold">Deep Trade Analytics</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Every entry, exit, and position size. See exactly how top traders manage their portfolios and time the market.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-success/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Shield className="h-8 w-8 text-success" />
                    </div>
                    <h3 className="text-xl font-bold">Risk Intelligence</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Max drawdown, win rate, Sharpe ratio—all the metrics that separate gamblers from professionals.
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
                    <h3 className="text-xl font-bold">Real-Time Alerts</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Get notified the moment your tracked traders make a move. Never miss an opportunity again.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-warning/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Activity className="h-8 w-8 text-warning" />
                    </div>
                    <h3 className="text-xl font-bold">Strategy Backtesting</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Test any strategy against historical data before risking real capital. Know your edge before you trade.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-elevated hover:shadow-elevated-lg hover-lift transition-all group">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="p-3 bg-chart-5/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                      <Copy className="h-8 w-8 text-chart-5" />
                    </div>
                    <h3 className="text-xl font-bold">One-Click Copy Trading</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Automatically mirror trades from verified performers. Set your risk, pick your traders, and let it run.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <Link href="/rankings">
                <Button size="lg" className="text-base font-semibold hover-lift shadow-elevated">
                  Start Analyzing Traders <ArrowRight className="ml-2 h-5 w-5" />
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
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 flex flex-col justify-center space-y-6">
                <div className="inline-flex items-center rounded-full border glass px-4 py-1.5 text-sm w-fit shadow-elevated">
                  <Sparkles className="h-4 w-4 mr-2 text-chart-1 animate-pulse" />
                  <span className="font-semibold">Now Available</span>
                </div>
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl xl:text-5xl">
                    Why Trade Alone When You Can Copy the Best?
                  </h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Select verified traders with proven track records. Set your risk limits. Watch your portfolio
                    grow while you sleep. It&apos;s that simple.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-5 rounded-xl glass-card shadow-elevated hover-lift transition-all">
                    <div className="p-2 bg-primary/10 rounded-lg mt-1">
                      <Copy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Automatic Execution</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Trades execute in your wallet within seconds. No manual copying, no missed entries.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-xl glass-card shadow-elevated hover-lift transition-all">
                    <div className="p-2 bg-success/10 rounded-lg mt-1">
                      <Target className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">You Control the Risk</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Set position limits, stop-losses, and allocation caps. Your rules, their alpha.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 rounded-xl glass-card shadow-elevated hover-lift transition-all">
                    <div className="p-2 bg-chart-1/10 rounded-lg mt-1">
                      <Star className="h-5 w-5 text-chart-1" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Verified Performance Only</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Every trader is ranked by on-chain results. No fake gurus, just real profits.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Link href="/copy-trader">
                    <Button size="lg" className="px-8 text-base font-semibold shadow-elevated-lg hover:shadow-elevated-xl transition-all hover-lift">
                      Start Copy Trading <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/rankings">
                    <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-2 hover-lift">
                      Browse Top Traders
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Teaser */}
        <section className="w-full py-16 md:py-24 bg-background">
          <div className="container px-4 md:px-6">
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="outline" className="mb-4 px-4 py-1">Pricing</Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
                Start Free. Upgrade When You&apos;re Ready.
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Track 10 traders and access basic analytics completely free.
                Need more? Pro plans start at just $39/month.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/register">
                  <Button size="lg" className="px-8 text-base font-semibold shadow-elevated hover-lift">
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-2 hover-lift">
                    View All Plans
                  </Button>
                </Link>
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
                The Best Traders Are Already Here.<br />Where Are You?
              </h2>
              <p className="text-primary-foreground/90 text-lg md:text-xl max-w-2xl leading-relaxed">
                Every day you wait is another day of missed opportunities. Join thousands of traders
                who are already copying the top 1%.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/rankings">
                  <Button size="lg" variant="secondary" className="px-10 text-base font-semibold shadow-elevated-xl hover-lift">
                    Find Your First Trader <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="lg" variant="outline" className="px-10 text-base font-semibold border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary hover-lift">
                    Sign Up Free
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
          <Link href="/pricing" className="text-sm hover:text-primary transition-colors font-medium">
            Pricing
          </Link>
          <Link href="/terms" className="text-sm hover:text-primary transition-colors font-medium">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-sm hover:text-primary transition-colors font-medium">
            Privacy Policy
          </Link>
          <Link href="/contact" className="text-sm hover:text-primary transition-colors font-medium">
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  )
}
