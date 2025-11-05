import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Bell, Calendar, CheckCircle, Shield, Sparkles, Target, TrendingUp, Users, Zap, Star, DollarSign, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "../page-header"

export default function CopyTraderPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <PageHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-primary/5 via-blue-500/10 to-background relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] [mask-image:radial-gradient(white,transparent_70%)]" />
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />

          <div className="container px-4 md:px-6 relative">
            <div className="flex justify-start mb-8">
              <Link href="/">
                <Button variant="ghost" className="gap-2 hover:bg-background/80">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>

            <div className="text-center mb-12 max-w-3xl mx-auto">
              <div className="inline-flex items-center rounded-full border bg-background/80 backdrop-blur-sm px-4 py-2 text-sm mb-6 mx-auto">
                <Calendar className="h-4 w-4 mr-2 text-primary" />
                <span className="font-medium">Launching Soon - Join the Waitlist</span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Copy Trading Made Simple
              </h1>
              <p className="text-muted-foreground text-lg md:text-xl leading-relaxed mb-8">
                Automatically mirror the trades of elite Solana traders. No manual execution, no constant monitoring—just smart, automated trading.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <div className="flex max-w-md gap-2 flex-1 sm:flex-none">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 h-12 text-base border-2"
                  />
                  <Button size="lg" className="h-12 px-6 font-semibold">
                    Join Waitlist
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap justify-center gap-8 pt-4">
                <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold">500+</div>
                  <div className="text-sm text-muted-foreground">Early Sign-ups</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold">50+</div>
                  <div className="text-sm text-muted-foreground">Verified Traders</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold">Q1 2025</div>
                  <div className="text-sm text-muted-foreground">Expected Launch</div>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-4xl">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-primary/20">
                  <Image
                    src="/copy-trading-dashboard.jpg"
                    alt="Copy Trading Dashboard"
                    width={1000}
                    height={500}
                    className="rounded-2xl object-cover w-full"
                  />
                  {/* Coming Soon Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center">
                    <div className="bg-background/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl text-center max-w-md border-2 border-primary/20">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                        <Sparkles className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="text-3xl font-bold mb-3">Coming Soon</h2>
                      <p className="text-muted-foreground mb-6">
                        We're building the most powerful copy trading platform for Solana. Be the first to know when we launch.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
                Powerful Features for Smart Trading
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Everything you need to copy trade successfully, all in one platform
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="p-3 bg-primary/10 rounded-lg w-fit mb-3">
                    <Copy className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Automated Trading</CardTitle>
                  <CardDescription>Set it and forget it</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Our system executes trades in your wallet automatically based on your selected traders' actions. No manual intervention required.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="p-3 bg-blue-500/10 rounded-lg w-fit mb-3">
                    <Shield className="h-7 w-7 text-blue-500" />
                  </div>
                  <CardTitle className="text-xl">Risk Management</CardTitle>
                  <CardDescription>Trade with confidence</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Configure position sizes, stop-losses, and take-profit levels. Our system ensures your trading stays within your risk tolerance.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="p-3 bg-green-500/10 rounded-lg w-fit mb-3">
                    <Bell className="h-7 w-7 text-green-500" />
                  </div>
                  <CardTitle className="text-xl">Real-time Alerts</CardTitle>
                  <CardDescription>Stay informed instantly</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Get instant notifications when trades execute, profit targets hit, or stop-losses trigger. Full transparency at all times.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="p-3 bg-purple-500/10 rounded-lg w-fit mb-3">
                    <Target className="h-7 w-7 text-purple-500" />
                  </div>
                  <CardTitle className="text-xl">Precision Copying</CardTitle>
                  <CardDescription>Mirror trades accurately</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Advanced algorithms ensure trades are copied with minimal slippage and optimal execution timing for best results.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="p-3 bg-orange-500/10 rounded-lg w-fit mb-3">
                    <Users className="h-7 w-7 text-orange-500" />
                  </div>
                  <CardTitle className="text-xl">Verified Traders</CardTitle>
                  <CardDescription>Copy the best performers</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Choose from curated traders with proven track records, transparent metrics, and verified on-chain performance history.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="p-3 bg-pink-500/10 rounded-lg w-fit mb-3">
                    <Zap className="h-7 w-7 text-pink-500" />
                  </div>
                  <CardTitle className="text-xl">Lightning Fast</CardTitle>
                  <CardDescription>Execute at optimal speed</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Built on Solana for ultra-fast trade execution. Minimize latency and maximize your opportunity to capture profits.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <Link href="/rankings">
                <Button size="lg" variant="outline" className="text-base font-semibold border-2">
                  View Top Traders <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/30">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
                How It Works
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Get started with copy trading in four simple steps
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center mb-6 text-2xl font-bold shadow-lg">
                  1
                </div>
                <div className="p-4 bg-background rounded-xl border-2 h-full">
                  <h3 className="font-bold text-lg mb-3">Select Traders</h3>
                  <p className="text-sm text-muted-foreground">
                    Browse our curated list of top-performing traders. View their stats, track records, and trading styles.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-500/70 text-white flex items-center justify-center mb-6 text-2xl font-bold shadow-lg">
                  2
                </div>
                <div className="p-4 bg-background rounded-xl border-2 h-full">
                  <h3 className="font-bold text-lg mb-3">Set Parameters</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your risk settings, position sizes, stop-losses, and allocation per trader to match your strategy.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-500/70 text-white flex items-center justify-center mb-6 text-2xl font-bold shadow-lg">
                  3
                </div>
                <div className="p-4 bg-background rounded-xl border-2 h-full">
                  <h3 className="font-bold text-lg mb-3">Connect Wallet</h3>
                  <p className="text-sm text-muted-foreground">
                    Securely connect your Solana wallet. Your funds stay in your custody—we never hold your assets.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-500/70 text-white flex items-center justify-center mb-6 text-2xl font-bold shadow-lg">
                  4
                </div>
                <div className="p-4 bg-background rounded-xl border-2 h-full">
                  <h3 className="font-bold text-lg mb-3">Start Copying</h3>
                  <p className="text-sm text-muted-foreground">
                    Activate copy trading and watch as our system automatically replicates your selected traders' moves.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-6">
                  Why Choose Our Copy Trading Platform?
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="p-2 bg-green-500/10 rounded-lg h-fit">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-2">Non-Custodial & Secure</h3>
                      <p className="text-muted-foreground">
                        Your funds always stay in your wallet. We use secure smart contracts for trade execution—no third-party custody.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg h-fit">
                      <TrendingUp className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-2">Transparent Performance</h3>
                      <p className="text-muted-foreground">
                        All trader metrics are verified on-chain. See real-time P&L, win rates, and historical performance before copying.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="p-2 bg-purple-500/10 rounded-lg h-fit">
                      <DollarSign className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-2">Low Fees</h3>
                      <p className="text-muted-foreground">
                        Pay only a small performance fee when you profit. No hidden charges, no subscription fees—completely transparent pricing.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="p-2 bg-orange-500/10 rounded-lg h-fit">
                      <Star className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-2">Expert Support</h3>
                      <p className="text-muted-foreground">
                        Our team is here to help you succeed. Get assistance with setup, strategy selection, and ongoing optimization.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[500px]">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background p-8">
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                          <Copy className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Join the Waitlist</h3>
                        <p className="text-muted-foreground mb-6">
                          Get early access and exclusive launch benefits
                        </p>
                      </div>

                      <div className="space-y-4">
                        <Input
                          type="text"
                          placeholder="Your name"
                          className="h-12 border-2"
                        />
                        <Input
                          type="email"
                          placeholder="Your email"
                          className="h-12 border-2"
                        />
                        <Button size="lg" className="w-full h-12 font-semibold text-base">
                          Get Early Access <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground text-center">
                          Early subscribers get priority access + 3 months of reduced fees
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full py-16 md:py-24 bg-gradient-to-r from-primary to-blue-600">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
              <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl xl:text-5xl text-primary-foreground">
                Ready to Copy the Best?
              </h2>
              <p className="text-primary-foreground/90 text-lg md:text-xl max-w-2xl">
                Join our waitlist today and be among the first to access automated copy trading on Solana.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" variant="secondary" className="px-10 text-base font-semibold shadow-xl hover:shadow-2xl">
                  Join Waitlist Now <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Link href="/rankings">
                  <Button size="lg" variant="outline" className="px-10 text-base font-semibold border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                    Explore Top Traders
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
            <Copy className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-lg">TraderRanker</span>
        </div>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TraderRanker. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-6">
          <Link href="/" className="text-sm hover:text-primary transition-colors font-medium">
            Home
          </Link>
          <Link href="/rankings" className="text-sm hover:text-primary transition-colors font-medium">
            Rankings
          </Link>
          <Link href="#" className="text-sm hover:text-primary transition-colors font-medium">
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  )
}

