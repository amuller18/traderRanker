import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Trophy, Copy, TrendingUp, Shield, Zap, Users, Target, Activity, Sparkles, ChevronRight } from "lucide-react"
import { PageHeader } from "./page-header"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <PageHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full py-20 md:py-28 lg:py-36 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_80%_80%_at_50%_20%,black,transparent)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse-glow opacity-40" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-chart-2/20 rounded-full blur-[100px] opacity-30" />
          <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-chart-4/20 rounded-full blur-[80px] opacity-30" />

          <div className="container relative px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="flex flex-col justify-center space-y-8">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm w-fit animate-fade-in">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-primary font-medium">Live On-Chain Analytics</span>
                </div>

                {/* Headline */}
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl animate-fade-in" style={{ animationDelay: "0.1s" }}>
                    Discover Elite
                    <span className="block text-gradient">Solana Traders</span>
                  </h1>
                  <p className="max-w-[540px] text-muted-foreground text-lg leading-relaxed animate-fade-in" style={{ animationDelay: "0.2s" }}>
                    Real-time on-chain intelligence to identify top performers. Track strategies,
                    analyze risk metrics, and benchmark against the best traders.
                  </p>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                  <Link href="/rankings">
                    <Button size="lg" className="w-full sm:w-auto px-6 shadow-glow hover:shadow-glow-lg transition-all duration-300">
                      View Rankings
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/copy-trader">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto px-6 border-border/60 hover:bg-accent/50 transition-all">
                      Copy Trading
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-8 pt-4 animate-fade-in" style={{ animationDelay: "0.4s" }}>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold tracking-tight">10K+</div>
                    <div className="text-sm text-muted-foreground">Traders Tracked</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold tracking-tight">$50M+</div>
                    <div className="text-sm text-muted-foreground">Volume Analyzed</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold tracking-tight text-success">99.9%</div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                  </div>
                </div>
              </div>

              {/* Hero visual */}
              <div className="relative lg:ml-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="relative max-w-[560px] mx-auto">
                  {/* Main card */}
                  <div className="relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm shadow-elevated-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-4/5" />
                    <Image
                      src="/trading-dashboard.jpg"
                      alt="TraderRanker Dashboard"
                      width={560}
                      height={400}
                      className="rounded-2xl object-cover relative"
                      priority
                    />
                  </div>

                  {/* Floating stat card - top */}
                  <div className="absolute -top-6 -right-6 md:-top-8 md:-right-8 glass-card rounded-xl shadow-elevated-lg p-4 animate-float border-border/40" style={{ animationDelay: "1s" }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <TrendingUp className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Top Return</div>
                        <div className="text-lg font-bold text-success">+243%</div>
                      </div>
                    </div>
                  </div>

                  {/* Floating stat card - bottom */}
                  <div className="absolute -bottom-6 -left-6 md:-bottom-8 md:-left-8 glass-card rounded-xl shadow-elevated-lg p-4 animate-float" style={{ animationDelay: "1.5s" }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10">
                        <Trophy className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Elite Status</div>
                        <div className="text-lg font-bold">Top 5%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-20 md:py-28 border-t border-border/40 bg-gradient-to-b from-background to-accent/20">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Built for Serious Traders
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Professional-grade analytics and transparent metrics for data-driven decisions
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: BarChart3,
                  title: "Real-Time Analytics",
                  description: "Track performance metrics updated in real-time from on-chain data. Monitor profits, win rates, and risk-adjusted returns.",
                  color: "primary"
                },
                {
                  icon: Shield,
                  title: "Risk Management",
                  description: "Comprehensive risk metrics including max drawdown, Sharpe ratio, and portfolio volatility analysis.",
                  color: "chart-1"
                },
                {
                  icon: Trophy,
                  title: "Leaderboards",
                  description: "Compete with top traders and see how your strategy ranks. Filter by timeframe, asset, and trading style.",
                  color: "success"
                },
                {
                  icon: Zap,
                  title: "Instant Insights",
                  description: "Get actionable insights on trader strategies, position sizing, and market timing patterns.",
                  color: "chart-4"
                },
                {
                  icon: Users,
                  title: "Community Driven",
                  description: "Join a community of serious traders. Share strategies, learn from the best, and grow together.",
                  color: "warning"
                },
                {
                  icon: Activity,
                  title: "Backtesting Tools",
                  description: "Test strategies against historical data. Validate your approach before risking real capital.",
                  color: "chart-5"
                }
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="group relative p-6 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 hover:border-border/60 transition-all duration-300 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative space-y-4">
                    <div className={`inline-flex p-2.5 rounded-lg bg-${feature.color}/10 text-${feature.color} group-hover:scale-110 transition-transform`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Copy Trading Section */}
        <section className="w-full py-20 md:py-28 border-t border-border/40" id="copy-trader">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="order-2 lg:order-1">
                <div className="relative max-w-[500px] mx-auto lg:mx-0">
                  <div className="relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm shadow-elevated-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 via-transparent to-primary/5" />
                    <Image
                      src="/copy-trading.jpg"
                      alt="Copy Trading Feature"
                      width={500}
                      height={380}
                      className="rounded-2xl object-cover relative"
                    />
                  </div>

                  {/* Floating card */}
                  <div className="absolute -bottom-6 -right-6 md:-bottom-8 md:-right-8 glass-card rounded-xl shadow-elevated-lg p-4 animate-float border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-chart-1/10">
                        <Copy className="h-5 w-5 text-chart-1" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Auto-Execute</div>
                        <div className="text-lg font-bold">Copy Trades</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-chart-1/20 bg-chart-1/5 px-4 py-1.5 text-sm w-fit">
                  <Sparkles className="h-4 w-4 text-chart-1" />
                  <span className="text-chart-1 font-medium">Coming Soon</span>
                </div>

                <div className="space-y-4">
                  <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                    Copy Top Traders
                    <span className="block text-muted-foreground text-2xl md:text-3xl font-normal mt-1">Automatically</span>
                  </h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Mirror the trades of elite performers in real-time. Set your risk parameters,
                    select your traders, and let our system handle execution.
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      icon: Copy,
                      title: "Automated Execution",
                      description: "Trades execute automatically in your wallet based on selected traders.",
                      color: "primary"
                    },
                    {
                      icon: Target,
                      title: "Smart Risk Controls",
                      description: "Configure position limits, stop-losses, and take-profit levels.",
                      color: "success"
                    },
                    {
                      icon: Shield,
                      title: "Verified Traders Only",
                      description: "Choose from curated traders with proven track records.",
                      color: "chart-1"
                    }
                  ].map((item) => (
                    <div key={item.title} className="flex gap-4 p-4 rounded-xl bg-card/30 border border-border/40 hover:bg-card/50 transition-colors">
                      <div className={`p-2 rounded-lg bg-${item.color}/10 h-fit`}>
                        <item.icon className={`h-4 w-4 text-${item.color}`} />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link href="/copy-trader">
                    <Button size="lg" className="w-full sm:w-auto px-6 shadow-glow hover:shadow-glow-lg transition-all">
                      Get Early Access
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/rankings">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto px-6 border-border/60 hover:bg-accent/50">
                      View Top Traders
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-20 md:py-24 border-t border-border/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 rounded-full blur-[100px] opacity-50" />

          <div className="container relative px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Ready to Trade Smarter?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Join thousands of traders using TraderRanker to discover opportunities and learn from the best.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/rankings">
                  <Button size="lg" className="px-8 shadow-glow hover:shadow-glow-lg transition-all">
                    Start Exploring
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/copy-trader">
                  <Button size="lg" variant="outline" className="px-8 border-border/60 hover:bg-accent/50">
                    Join Waitlist
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold">TraderRanker</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} TraderRanker. All rights reserved.
            </p>
            <nav className="flex gap-6">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
