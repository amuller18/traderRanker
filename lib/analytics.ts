import { track } from '@vercel/analytics'

/**
 * Track custom analytics events.
 * Wraps Vercel Analytics track() with a consistent interface.
 * No-ops gracefully if analytics is not loaded.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
) {
  try {
    track(name, properties)
  } catch {
    // Analytics not available — no-op in dev or if blocked
  }
}

// Pre-defined event helpers for consistent naming

export const analytics = {
  // Authentication events
  login: (method: 'email' | 'wallet') =>
    trackEvent('login', { method }),

  register: (method: 'email' | 'wallet') =>
    trackEvent('register', { method }),

  logout: () =>
    trackEvent('logout'),

  walletConnected: () =>
    trackEvent('wallet_connected'),

  walletLinked: () =>
    trackEvent('wallet_linked'),

  // Navigation / page engagement
  pageView: (page: string) =>
    trackEvent('page_view', { page }),

  // Feature usage
  backtestRun: (traderCount: number) =>
    trackEvent('backtest_run', { trader_count: traderCount }),

  traderViewed: (traderId: string) =>
    trackEvent('trader_viewed', { trader_id: traderId }),

  tokenAnalyzed: (tokenAddress: string) =>
    trackEvent('token_analyzed', { token_address: tokenAddress }),

  // Favorites
  favoriteAdded: (type: 'trader' | 'token') =>
    trackEvent('favorite_added', { type }),

  favoriteRemoved: (type: 'trader' | 'token') =>
    trackEvent('favorite_removed', { type }),

  // Pricing / conversion
  pricingViewed: () =>
    trackEvent('pricing_viewed'),

  checkoutStarted: (plan: string) =>
    trackEvent('checkout_started', { plan }),

  // Filters & search
  filterApplied: (filterType: string) =>
    trackEvent('filter_applied', { filter_type: filterType }),

  searchPerformed: (section: string) =>
    trackEvent('search_performed', { section }),

  // Copy trading
  copyTraderWaitlistJoined: () =>
    trackEvent('copy_trader_waitlist_joined'),

  // Errors (user-facing)
  errorDisplayed: (page: string, errorDigest?: string) =>
    trackEvent('error_displayed', { page, error_digest: errorDigest || 'unknown' }),
}
