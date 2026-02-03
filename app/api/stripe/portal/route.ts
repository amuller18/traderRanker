import { NextRequest, NextResponse } from 'next/server'
import { createPortalSession } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Apply rate limiting to billing portal
  const rateLimitResponse = await rateLimit(request, 'stripe-portal', RateLimitPresets.auth)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to access the billing portal' },
        { status: 401 }
      )
    }

    // Get Stripe customer ID from user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing information found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await createPortalSession({
      customerId: profile.stripe_customer_id,
      returnUrl: `${origin}/account`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Portal session error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
