/**
 * Unit tests for lib/stripe-client.ts
 *
 * Tests cover:
 * 1. getStripe returns null when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing
 * 2. getStripe calls loadStripe with the correct key
 * 3. getStripe caches the promise (same promise on second call)
 * 4. redirectToCheckout throws when stripe fails to load
 * 5. redirectToCheckout calls stripe.redirectToCheckout with sessionId
 * 6. redirectToCheckout throws the Stripe error when redirectToCheckout returns one
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @stripe/stripe-js
// ---------------------------------------------------------------------------

const mockLoadStripe = vi.fn()

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: (...args: unknown[]) => mockLoadStripe(...args),
}))

// ---------------------------------------------------------------------------
// We dynamically import the module in each describe block so that the
// module-level `stripePromise` singleton is reset between groups.
// ---------------------------------------------------------------------------

let stripeClient: typeof import('@/lib/stripe-client')

beforeEach(() => {
  mockLoadStripe.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.resetModules()
})

// ===========================================================================
// 1. getStripe – missing key
// ===========================================================================

describe('getStripe', () => {
  describe('when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set', () => {
    beforeEach(async () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      stripeClient = await import('@/lib/stripe-client')
    })

    it('should return null', () => {
      const result = stripeClient.getStripe()

      expect(result).toBeNull()
    })

    it('should log an error message', () => {
      stripeClient.getStripe()

      expect(console.error).toHaveBeenCalledWith(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set'
      )
    })

    it('should NOT call loadStripe', () => {
      stripeClient.getStripe()

      expect(mockLoadStripe).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 2. getStripe – key is present
  // =========================================================================

  describe('when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set', () => {
    const TEST_KEY = 'pk_test_abc123'

    beforeEach(async () => {
      vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', TEST_KEY)
      mockLoadStripe.mockResolvedValue({ redirectToCheckout: vi.fn() })
      stripeClient = await import('@/lib/stripe-client')
    })

    it('should call loadStripe with the correct key', () => {
      stripeClient.getStripe()

      expect(mockLoadStripe).toHaveBeenCalledWith(TEST_KEY)
    })

    it('should return a promise (not null)', () => {
      const result = stripeClient.getStripe()

      expect(result).not.toBeNull()
      expect(result).toBeInstanceOf(Promise)
    })

    // =======================================================================
    // 3. getStripe – caching behavior
    // =======================================================================

    it('should return the same promise on second call (cached)', () => {
      const first = stripeClient.getStripe()
      const second = stripeClient.getStripe()

      expect(first).toBe(second)
    })

    it('should only call loadStripe once even when called multiple times', () => {
      stripeClient.getStripe()
      stripeClient.getStripe()
      stripeClient.getStripe()

      expect(mockLoadStripe).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// 4. redirectToCheckout – stripe fails to load
// ===========================================================================

describe('redirectToCheckout', () => {
  describe('when stripe fails to load (getStripe returns null)', () => {
    beforeEach(async () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      stripeClient = await import('@/lib/stripe-client')
    })

    it('should throw "Stripe failed to load"', async () => {
      await expect(
        stripeClient.redirectToCheckout('sess_123')
      ).rejects.toThrow('Stripe failed to load')
    })
  })

  describe('when stripe loads but loadStripe resolves to null', () => {
    beforeEach(async () => {
      vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_xyz')
      mockLoadStripe.mockResolvedValue(null)
      stripeClient = await import('@/lib/stripe-client')
    })

    it('should throw "Stripe failed to load"', async () => {
      await expect(
        stripeClient.redirectToCheckout('sess_456')
      ).rejects.toThrow('Stripe failed to load')
    })
  })

  // =========================================================================
  // 5. redirectToCheckout – successful call
  // =========================================================================

  describe('when stripe loads successfully', () => {
    const mockRedirectToCheckout = vi.fn()
    const mockStripe = { redirectToCheckout: mockRedirectToCheckout }

    beforeEach(async () => {
      vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_good')
      mockLoadStripe.mockResolvedValue(mockStripe)
      mockRedirectToCheckout.mockReset()
      stripeClient = await import('@/lib/stripe-client')
    })

    it('should call stripe.redirectToCheckout with the sessionId', async () => {
      mockRedirectToCheckout.mockResolvedValue({ error: null })

      await stripeClient.redirectToCheckout('sess_abc')

      expect(mockRedirectToCheckout).toHaveBeenCalledWith({
        sessionId: 'sess_abc',
      })
    })

    it('should not throw when redirectToCheckout succeeds (no error)', async () => {
      mockRedirectToCheckout.mockResolvedValue({ error: null })

      await expect(
        stripeClient.redirectToCheckout('sess_ok')
      ).resolves.toBeUndefined()
    })

    // =======================================================================
    // 6. redirectToCheckout – Stripe returns an error
    // =======================================================================

    it('should throw the Stripe error when redirectToCheckout returns an error', async () => {
      const stripeError = new Error('Your card was declined.')
      mockRedirectToCheckout.mockResolvedValue({ error: stripeError })

      await expect(
        stripeClient.redirectToCheckout('sess_fail')
      ).rejects.toThrow('Your card was declined.')
    })

    it('should throw the exact error object returned by Stripe', async () => {
      const stripeError = { type: 'card_error', message: 'Insufficient funds' }
      mockRedirectToCheckout.mockResolvedValue({ error: stripeError })

      await expect(
        stripeClient.redirectToCheckout('sess_card')
      ).rejects.toEqual(stripeError)
    })
  })
})
