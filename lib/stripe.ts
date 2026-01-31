import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

// Price IDs for each plan - these should be created in Stripe Dashboard
// and the IDs added to environment variables
export const PLANS = {
  free: {
    name: 'Free',
    description: 'Perfect for getting started with trader analysis',
    priceId: {
      monthly: null, // Free plan doesn't need a price ID
      yearly: null,
    },
    features: [
      'Basic rankings access',
      'Track up to 10 traders',
      '7 days historical data',
      'Community support',
    ],
    limits: {
      tradersTracked: 10,
      historicalDays: 7,
      alertsPerDay: 0,
      apiCallsPerDay: 0,
      customStrategies: 0,
    },
  },
  pro: {
    name: 'Pro',
    description: 'For serious traders who want an edge',
    priceId: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
    features: [
      'Everything in Free',
      'Track up to 100 traders',
      '90 days historical data',
      'Advanced backtesting',
      'Copy trading',
      '50 real-time alerts/day',
      'API access (1,000 calls/day)',
      'Priority support',
    ],
    limits: {
      tradersTracked: 100,
      historicalDays: 90,
      alertsPerDay: 50,
      apiCallsPerDay: 1000,
      customStrategies: 5,
    },
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Custom solutions for teams and institutions',
    priceId: {
      monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    },
    features: [
      'Everything in Pro',
      'Unlimited traders',
      'Unlimited historical data',
      'Unlimited alerts & API calls',
      'Custom strategies',
      'Dedicated account manager',
      'Custom integrations',
      'White-label options',
      'SLA guarantee',
    ],
    limits: {
      tradersTracked: Infinity,
      historicalDays: Infinity,
      alertsPerDay: Infinity,
      apiCallsPerDay: Infinity,
      customStrategies: Infinity,
    },
  },
} as const

export type PlanType = keyof typeof PLANS
export type BillingInterval = 'monthly' | 'yearly'

// Helper to get plan from price ID
export function getPlanFromPriceId(priceId: string): PlanType | null {
  for (const [planKey, plan] of Object.entries(PLANS)) {
    if (plan.priceId.monthly === priceId || plan.priceId.yearly === priceId) {
      return planKey as PlanType
    }
  }
  return null
}

// Helper to create a checkout session
export async function createCheckoutSession({
  customerId,
  priceId,
  userId,
  successUrl,
  cancelUrl,
}: {
  customerId?: string
  priceId: string
  userId: string
  successUrl: string
  cancelUrl: string
}) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
    allow_promotion_codes: true,
  })

  return session
}

// Helper to create a customer portal session
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

// Helper to get subscription details
export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId)
}

// Helper to cancel subscription
export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

// Helper to reactivate cancelled subscription
export async function reactivateSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
}
