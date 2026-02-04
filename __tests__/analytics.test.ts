/**
 * Unit tests for @/lib/analytics.ts
 *
 * Tests cover:
 * 1. trackEvent calls track() with correct arguments
 * 2. trackEvent swallows errors when track() throws
 * 3. Each analytics helper calls trackEvent with the right event name and properties
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so the mock fn is available when the factory (hoisted to top) runs
const { mockTrack } = vi.hoisted(() => ({
  mockTrack: vi.fn(),
}))

vi.mock('@vercel/analytics', () => ({
  track: mockTrack,
}))

import { trackEvent, analytics } from '@/lib/analytics'

describe('analytics', () => {
  beforeEach(() => {
    mockTrack.mockReset()
  })

  // ==========================================================================
  // trackEvent
  // ==========================================================================

  describe('trackEvent', () => {
    it('should call track() with event name only', () => {
      trackEvent('test_event')

      expect(mockTrack).toHaveBeenCalledOnce()
      expect(mockTrack).toHaveBeenCalledWith('test_event', undefined)
    })

    it('should call track() with event name and properties', () => {
      trackEvent('test_event', { key: 'value', count: 42, active: true })

      expect(mockTrack).toHaveBeenCalledOnce()
      expect(mockTrack).toHaveBeenCalledWith('test_event', {
        key: 'value',
        count: 42,
        active: true,
      })
    })

    it('should swallow errors when track() throws', () => {
      mockTrack.mockImplementation(() => {
        throw new Error('Analytics not available')
      })

      // Should not throw
      expect(() => trackEvent('test_event')).not.toThrow()
    })

    it('should swallow errors and not propagate them', () => {
      mockTrack.mockImplementation(() => {
        throw new TypeError('Cannot read properties of undefined')
      })

      expect(() => trackEvent('broken_event', { foo: 'bar' })).not.toThrow()
    })
  })

  // ==========================================================================
  // analytics helpers
  // ==========================================================================

  describe('analytics helpers', () => {
    // --- Authentication events ---

    describe('login', () => {
      it('should track login with email method', () => {
        analytics.login('email')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('login', { method: 'email' })
      })

      it('should track login with wallet method', () => {
        analytics.login('wallet')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('login', { method: 'wallet' })
      })
    })

    describe('register', () => {
      it('should track register with email method', () => {
        analytics.register('email')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('register', { method: 'email' })
      })

      it('should track register with wallet method', () => {
        analytics.register('wallet')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('register', { method: 'wallet' })
      })
    })

    describe('logout', () => {
      it('should track logout with no properties', () => {
        analytics.logout()

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('logout', undefined)
      })
    })

    describe('walletConnected', () => {
      it('should track wallet_connected event', () => {
        analytics.walletConnected()

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('wallet_connected', undefined)
      })
    })

    describe('walletLinked', () => {
      it('should track wallet_linked event', () => {
        analytics.walletLinked()

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('wallet_linked', undefined)
      })
    })

    // --- Navigation / page engagement ---

    describe('pageView', () => {
      it('should track page_view with page name', () => {
        analytics.pageView('/dashboard')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('page_view', { page: '/dashboard' })
      })
    })

    // --- Feature usage ---

    describe('backtestRun', () => {
      it('should track backtest_run with trader_count', () => {
        analytics.backtestRun(5)

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('backtest_run', { trader_count: 5 })
      })
    })

    describe('traderViewed', () => {
      it('should track trader_viewed with trader_id', () => {
        analytics.traderViewed('trader-abc-123')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('trader_viewed', { trader_id: 'trader-abc-123' })
      })
    })

    describe('tokenAnalyzed', () => {
      it('should track token_analyzed with token_address', () => {
        analytics.tokenAnalyzed('So11111111111111111111111111111111111111112')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('token_analyzed', {
          token_address: 'So11111111111111111111111111111111111111112',
        })
      })
    })

    // --- Favorites ---

    describe('favoriteAdded', () => {
      it('should track favorite_added with type trader', () => {
        analytics.favoriteAdded('trader')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('favorite_added', { type: 'trader' })
      })

      it('should track favorite_added with type token', () => {
        analytics.favoriteAdded('token')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('favorite_added', { type: 'token' })
      })
    })

    describe('favoriteRemoved', () => {
      it('should track favorite_removed with type trader', () => {
        analytics.favoriteRemoved('trader')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('favorite_removed', { type: 'trader' })
      })

      it('should track favorite_removed with type token', () => {
        analytics.favoriteRemoved('token')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('favorite_removed', { type: 'token' })
      })
    })

    // --- Pricing / conversion ---

    describe('pricingViewed', () => {
      it('should track pricing_viewed with no properties', () => {
        analytics.pricingViewed()

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('pricing_viewed', undefined)
      })
    })

    describe('checkoutStarted', () => {
      it('should track checkout_started with plan name', () => {
        analytics.checkoutStarted('pro_monthly')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('checkout_started', { plan: 'pro_monthly' })
      })
    })

    // --- Filters & search ---

    describe('filterApplied', () => {
      it('should track filter_applied with filter_type', () => {
        analytics.filterApplied('time_range')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('filter_applied', { filter_type: 'time_range' })
      })
    })

    describe('searchPerformed', () => {
      it('should track search_performed with section', () => {
        analytics.searchPerformed('traders')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('search_performed', { section: 'traders' })
      })
    })

    // --- Copy trading ---

    describe('copyTraderWaitlistJoined', () => {
      it('should track copy_trader_waitlist_joined with no properties', () => {
        analytics.copyTraderWaitlistJoined()

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('copy_trader_waitlist_joined', undefined)
      })
    })

    // --- Errors ---

    describe('errorDisplayed', () => {
      it('should track error_displayed with page and error digest', () => {
        analytics.errorDisplayed('/backtest', 'abc123')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('error_displayed', {
          page: '/backtest',
          error_digest: 'abc123',
        })
      })

      it('should default error_digest to "unknown" when not provided', () => {
        analytics.errorDisplayed('/dashboard')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('error_displayed', {
          page: '/dashboard',
          error_digest: 'unknown',
        })
      })

      it('should default error_digest to "unknown" when empty string', () => {
        analytics.errorDisplayed('/home', '')

        expect(mockTrack).toHaveBeenCalledOnce()
        expect(mockTrack).toHaveBeenCalledWith('error_displayed', {
          page: '/home',
          error_digest: 'unknown',
        })
      })
    })
  })
})
