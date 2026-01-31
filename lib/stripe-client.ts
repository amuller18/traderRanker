import { loadStripe, Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
      return null
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

// Helper to redirect to checkout
export async function redirectToCheckout(sessionId: string) {
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Stripe failed to load')
  }

  const { error } = await stripe.redirectToCheckout({ sessionId })
  if (error) {
    throw error
  }
}
