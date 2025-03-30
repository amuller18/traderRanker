import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Trophy, Copy, TrendingUp } from "lucide-react"
import { isUsingMockData } from "@/lib/trader-data"
import { DataSourceStatus } from "@/app/components/data-source-status"
import { PageHeader } from "./page-header"

export const dynamic = "force-dynamic"
export const revalidate = 0 // Don't cache this page

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
        <section className="w-full py-6 md:py-12 lg:py-16 bg-gradient-to-b from-muted/50 to-muted">
          <div className="container px-4 md:px-6">
            <DataSourceStatus usingMockData={usingMockData} />

            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Discover Top Solana Traders Based on Real Performance
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    TraderRanker analyzes on-chain trading data to rank traders by profit, risk management, and
                    consistency. Find the best traders or see how you stack up.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/rankings">
                    <Button className="px-8">
                      Check Your Rank <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="#how-it-works">
                    <Button variant="outline" className="px-8">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-[500px] aspect-square">
                  <Image
                    src="/trading-dashboard.jpg"
                    alt="TraderRanker Dashboard"
                    width={500}
                    height={500}
                    className="rounded-lg shadow-xl object-cover"
                    priority
                  />
                  <div className="absolute -bottom-6 -left-6 bg-background rounded-lg shadow-lg p-4 border">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <span className="font-bold">Top 5% Trader</span>
                    </div>
                  </div>
                  <div className="absolute -top-6 -right-6 bg-background rounded-lg shadow-lg p-4 border">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-green-500" />
                      <span className="font-bold">+243% ROI</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Copy Trader Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background" id="copy-trader">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Coming Soon</div>
                  <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                    Automatically Copy Top Traders
                  </h2>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Our Copy Trader feature allows you to automatically replicate the trades of top-performing traders
                    on Solana. Set your risk parameters, choose your traders, and let the system do the rest.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-1">
                      <Copy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Automated Trading</h3>
                      <p className="text-muted-foreground">
                        Set up your wallet once and let our system automatically execute trades based on your selected
                        traders' actions.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-1">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Risk Management</h3>
                      <p className="text-muted-foreground">
                        Configure position sizes, stop-losses, and take-profit levels to match your risk tolerance.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-1">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Curated Traders</h3>
                      <p className="text-muted-foreground">
                        Choose from a list of verified traders with proven track records and transparent performance
                        metrics.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Link href="/copy-trader">
                    <Button className="gap-2">
                      Learn More About Copy Trading <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="relative w-full max-w-[500px]">
                  <Image
                    src="/copy-trading.jpg"
                    alt="Copy Trading Feature"
                    width={500}
                    height={400}
                    className="rounded-lg shadow-xl object-cover"
                  />
                  <div className="absolute -bottom-6 -right-6 bg-background rounded-lg shadow-lg p-4 border">
                    <div className="flex items-center gap-2">
                      <Copy className="h-5 w-5 text-blue-500" />
                      <span className="font-bold">Copy Top Traders</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rest of the page content remains the same */}
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-bold">TraderRanker</span>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} TraderRanker. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            Privacy Policy
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  )
}

