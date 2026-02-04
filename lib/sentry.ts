import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

let initialized = false

export function initSentry() {
  if (initialized || !SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    debug: false,
    beforeSend(event) {
      // Scrub sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data?.url) {
            try {
              const url = new URL(breadcrumb.data.url)
              url.searchParams.delete('api_key')
              url.searchParams.delete('token')
              breadcrumb.data.url = url.toString()
            } catch {
              // Not a valid URL, leave as-is
            }
          }
          return breadcrumb
        })
      }
      return event
    },
    ignoreErrors: [
      // Browser extensions
      'ResizeObserver loop',
      // Network errors that are expected
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      // User-initiated aborts
      'AbortError',
      // Phantom wallet noise
      'User rejected the request',
    ],
  })

  initialized = true
}

/**
 * Capture an error with optional context
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) {
    console.error('[Error tracking disabled]', error)
    return
  }

  if (!initialized) initSentry()

  if (context) {
    Sentry.withScope(scope => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureException(error)
    })
  } else {
    Sentry.captureException(error)
  }
}

/**
 * Set the current user for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (!SENTRY_DSN) return
  if (!initialized) initSentry()

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Add a breadcrumb for tracking user flow
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  if (!SENTRY_DSN) return
  if (!initialized) initSentry()

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  })
}
