import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession, PLANS, PlanType, BillingInterval } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to subscribe' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { plan, interval } = body as { plan: PlanType; interval: BillingInterval }

    // Validate plan
    if (!plan || !PLANS[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      )
    }

    // Free plan doesn't need checkout
    if (plan === 'free') {
      return NextResponse.json(
        { error: 'Free plan does not require checkout' },
        { status: 400 }
      )
    }

    // Get price ID
    const priceId = PLANS[plan].priceId[interval]
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured for this plan. Please contact support.' },
        { status: 500 }
      )
    }

    // Get or create Stripe customer ID from user metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await createCheckoutSession({
      customerId: profile?.stripe_customer_id || undefined,
      priceId,
      userId: user.id,
      successUrl: `${origin}/account?subscription=success`,
      cancelUrl: `${origin}/pricing?subscription=cancelled`,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
