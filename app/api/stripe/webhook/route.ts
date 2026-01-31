import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Use service role for webhook to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId) {
    console.error('No userId in checkout session metadata')
    return
  }

  // Update user profile with Stripe customer ID
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update profile after checkout:', error)
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  const priceId = subscription.items.data[0]?.price.id
  const plan = getPlanFromPriceId(priceId) || 'free'
  const status = subscription.status

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_plan: plan,
      subscription_status: status,
      stripe_subscription_id: subscription.id,
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update subscription:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_plan: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      subscription_period_end: null,
      cancel_at_period_end: false,
    })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update profile after subscription deletion:', error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Log successful payment for audit purposes
  console.log('Payment succeeded for invoice:', invoice.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Could send email notification to user about failed payment
  console.log('Payment failed for invoice:', invoice.id)

  const customerId = invoice.customer as string

  // Find user by customer ID and update status
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    await supabaseAdmin
      .from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('id', profile.id)
  }
}
