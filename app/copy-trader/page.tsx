import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Bell, Calendar, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function CopyTraderPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2 pl-0">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2 mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Copy Trader</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Automatically replicate the trades of top-performing Solana traders with our advanced copy trading system.
        </p>
      </div>

      <div className="flex justify-center mb-12">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="bg-background p-6 rounded-lg shadow-lg text-center max-w-md">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
              <p className="text-muted-foreground mb-4">
                We're working hard to bring you our Copy Trader feature. Sign up to be notified when it launches.
              </p>
              <div className="flex gap-2 mb-4">
                <Input type="email" placeholder="Enter your email" className="flex-1" />
                <Button>Notify Me</Button>
              </div>
            </div>
          </div>
          <Image
            src="/copy-trading-dashboard.jpg"
            alt="Copy Trading Dashboard"
            width={800}
            height={400}
            className="rounded-lg shadow-xl object-cover"
          />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3 mb-12">
        <Card>
          <CardHeader>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
              <Copy className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Automated Trading</CardTitle>
            <CardDescription>Set up once and let the system work for you</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Our system automatically executes trades in your wallet based on the actions of your selected traders. No
              need to constantly monitor the market or execute trades manually.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Real-time Notifications</CardTitle>
            <CardDescription>Stay informed about all trading activities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Receive instant notifications when trades are executed, when profit targets are hit, or when stop-losses
              are triggered. Stay in control of your portfolio at all times.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Risk Management</CardTitle>
            <CardDescription>Trade with confidence and security</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Set your risk parameters including position sizes, stop-losses, and take-profit levels. Our system ensures
              your trading stays within your comfort zone.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted p-8 rounded-lg mb-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">How It Will Work</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our Copy Trader feature is designed to be simple, secure, and effective.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="font-medium mb-2">Select Traders</h3>
            <p className="text-sm text-muted-foreground">
              Choose from our curated list of top-performing traders with verified track records.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="font-medium mb-2">Set Parameters</h3>
            <p className="text-sm text-muted-foreground">
              Configure your risk settings, position sizes, and allocation per trader.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="font-medium mb-2">Connect Wallet</h3>
            <p className="text-sm text-muted-foreground">
              Securely connect your Solana wallet to enable automated trading.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4">
              4
            </div>
            <h3 className="font-medium mb-2">Start Copying</h3>
            <p className="text-sm text-muted-foreground">
              Activate the system and start automatically copying trades from your selected traders.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold mb-4">Be the First to Know</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
          Sign up to be notified when our Copy Trader feature launches. Early subscribers will get priority access and
          special benefits.
        </p>
        <div className="flex max-w-md mx-auto gap-2">
          <Input type="email" placeholder="Enter your email" className="flex-1" />
          <Button>Join Waitlist</Button>
        </div>
      </div>
    </div>
  )
}

