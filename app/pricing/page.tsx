"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageLayout } from "@/app/components/page-layout"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Check, X, Zap, Crown, Rocket, HelpCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PlanFeature {
  name: string
  free: boolean | string
  pro: boolean | string
  enterprise: boolean | string
  tooltip?: string
}

const features: PlanFeature[] = [
  {
    name: "Trader Rankings Access",
    free: true,
    pro: true,
    enterprise: true,
    tooltip: "View top performing traders on the leaderboard"
  },
  {
    name: "Basic Trade Analytics",
    free: true,
    pro: true,
    enterprise: true,
    tooltip: "Analyze individual trades and performance"
  },
  {
    name: "Traders Tracked",
    free: "10",
    pro: "100",
    enterprise: "Unlimited",
    tooltip: "Number of traders you can track simultaneously"
  },
  {
    name: "Historical Data",
    free: "7 days",
    pro: "90 days",
    enterprise: "Unlimited",
    tooltip: "Access to historical trading data"
  },
  {
    name: "Advanced Backtesting",
    free: false,
    pro: true,
    enterprise: true,
    tooltip: "Test strategies against historical market data"
  },
  {
    name: "Copy Trading",
    free: false,
    pro: true,
    enterprise: true,
    tooltip: "Automatically mirror trades from top traders"
  },
  {
    name: "Real-time Alerts",
    free: false,
    pro: "50/day",
    enterprise: "Unlimited",
    tooltip: "Get notified instantly when traders make moves"
  },
  {
    name: "API Access",
    free: false,
    pro: "1,000 calls/day",
    enterprise: "Unlimited",
    tooltip: "Programmatic access to our trading data"
  },
  {
    name: "Custom Strategies",
    free: false,
    pro: "5",
    enterprise: "Unlimited",
    tooltip: "Create and save custom trading strategies"
  },
  {
    name: "Priority Support",
    free: false,
    pro: true,
    enterprise: true,
    tooltip: "Get faster response times from our support team"
  },
  {
    name: "Dedicated Account Manager",
    free: false,
    pro: false,
    enterprise: true,
    tooltip: "Personal point of contact for your account"
  },
  {
    name: "Custom Integrations",
    free: false,
    pro: false,
    enterprise: true,
    tooltip: "Build custom integrations with your existing tools"
  },
  {
    name: "White-label Options",
    free: false,
    pro: false,
    enterprise: true,
    tooltip: "Use TraderRanker with your own branding"
  },
]

type PlanKey = "free" | "pro" | "enterprise"

interface Plan {
  key: PlanKey
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  icon: React.ReactNode
  popular?: boolean
  features: string[]
  cta: string
  ctaVariant: "default" | "outline" | "secondary"
}

const plans: Plan[] = [
  {
    key: "free",
    name: "Free",
    description: "Perfect for getting started with trader analysis",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: <Zap className="h-6 w-6" />,
    features: [
      "Basic rankings access",
      "Track up to 10 traders",
      "7 days historical data",
      "Community support"
    ],
    cta: "Get Started",
    ctaVariant: "outline"
  },
  {
    key: "pro",
    name: "Pro",
    description: "For serious traders who want an edge",
    monthlyPrice: 49,
    yearlyPrice: 39,
    icon: <Rocket className="h-6 w-6" />,
    popular: true,
    features: [
      "Everything in Free",
      "Track up to 100 traders",
      "90 days historical data",
      "Advanced backtesting",
      "Copy trading",
      "50 real-time alerts/day",
      "API access (1,000 calls/day)",
      "Priority support"
    ],
    cta: "Start Free Trial",
    ctaVariant: "default"
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for teams and institutions",
    monthlyPrice: 199,
    yearlyPrice: 159,
    icon: <Crown className="h-6 w-6" />,
    features: [
      "Everything in Pro",
      "Unlimited traders",
      "Unlimited historical data",
      "Unlimited alerts & API calls",
      "Custom strategies",
      "Dedicated account manager",
      "Custom integrations",
      "White-label options",
      "SLA guarantee"
    ],
    cta: "Contact Sales",
    ctaVariant: "secondary"
  }
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-5 w-5 text-green-500" />
    ) : (
      <X className="h-5 w-5 text-muted-foreground/40" />
    )
  }
  return <span className="text-sm font-medium">{value}</span>
}

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  const handleSelectPlan = async (plan: Plan) => {
    // Free plan - redirect to signup or dashboard
    if (plan.key === "free") {
      if (isAuthenticated) {
        router.push("/rankings")
      } else {
        router.push("/auth/register")
      }
      return
    }

    // Enterprise plan - contact sales
    if (plan.key === "enterprise") {
      window.location.href = "mailto:sales@traderranker.com?subject=Enterprise%20Plan%20Inquiry"
      return
    }

    // Pro plan - start checkout
    if (!isAuthenticated) {
      toast.error("Please sign in to subscribe")
      router.push(`/auth/login?redirect=/pricing`)
      return
    }

    setLoadingPlan(plan.key)

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: plan.key,
          interval: isYearly ? "yearly" : "monthly",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session")
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Checkout error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to start checkout")
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <PageLayout
      title="Simple, Transparent Pricing"
      description="Choose the perfect plan to supercharge your trading analysis"
    >
      <div className="space-y-16 animate-fade-in">
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4">
          <Label
            htmlFor="billing-toggle"
            className={cn(
              "text-sm font-medium transition-colors",
              !isYearly ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isYearly}
            onCheckedChange={setIsYearly}
          />
          <Label
            htmlFor="billing-toggle"
            className={cn(
              "text-sm font-medium transition-colors",
              isYearly ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Yearly
          </Label>
          {isYearly && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              Save 20%
            </Badge>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "relative flex flex-col border shadow-elevated hover:shadow-elevated-lg transition-all duration-300 hover-lift",
                plan.popular && "border-primary ring-2 ring-primary/20 scale-105 z-10"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <div className={cn(
                  "mx-auto p-3 rounded-xl w-fit mb-4",
                  plan.popular ? "bg-primary/10" : "bg-muted"
                )}>
                  <div className={plan.popular ? "text-primary" : "text-muted-foreground"}>
                    {plan.icon}
                  </div>
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                {/* Price */}
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">
                      ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {isYearly && plan.monthlyPrice > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Billed annually (${plan.yearlyPrice * 12}/year)
                    </p>
                  )}
                </div>

                {/* Feature List */}
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  variant={plan.ctaVariant}
                  className={cn(
                    "w-full",
                    plan.popular && "bg-primary hover:bg-primary/90"
                  )}
                  size="lg"
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.key ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Compare All Features
          </h2>
          <Card className="overflow-hidden border shadow-elevated">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-semibold">Feature</th>
                    <th className="text-center p-4 font-semibold w-32">
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="h-5 w-5 text-muted-foreground" />
                        <span>Free</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold w-32 bg-primary/5">
                      <div className="flex flex-col items-center gap-1">
                        <Rocket className="h-5 w-5 text-primary" />
                        <span className="text-primary">Pro</span>
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold w-32">
                      <div className="flex flex-col items-center gap-1">
                        <Crown className="h-5 w-5 text-muted-foreground" />
                        <span>Enterprise</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <TooltipProvider>
                  <tbody>
                    {features.map((feature, index) => (
                      <tr
                        key={feature.name}
                        className={cn(
                          "border-b last:border-0 transition-colors hover:bg-muted/30",
                          index % 2 === 0 ? "bg-background" : "bg-muted/10"
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{feature.name}</span>
                            {feature.tooltip && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground/60" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{feature.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center">
                            <FeatureValue value={feature.free} />
                          </div>
                        </td>
                        <td className="p-4 text-center bg-primary/5">
                          <div className="flex justify-center">
                            <FeatureValue value={feature.pro} />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center">
                            <FeatureValue value={feature.enterprise} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TooltipProvider>
              </table>
            </div>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Can I switch plans later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we&apos;ll prorate any charges.
                </p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Is there a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Pro plans include a 14-day free trial. No credit card required to start. Cancel anytime during the trial period.
                </p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We accept all major credit cards, PayPal, and cryptocurrency payments (SOL, USDC). Enterprise plans support invoicing.
                </p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We offer a 30-day money-back guarantee for all paid plans. If you&apos;re not satisfied, contact us for a full refund.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-6 py-8">
          <h2 className="text-2xl font-bold">Ready to take your trading to the next level?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Join thousands of traders who are already using TraderRanker to find winning strategies and copy top performers.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              className="px-8"
              onClick={() => handleSelectPlan(plans[1])}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === "pro" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Start Free Trial"
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8"
              onClick={() => handleSelectPlan(plans[2])}
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
