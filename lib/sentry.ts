/**
 * Sentry Error Tracking Utilities
 *
 * This module provides error tracking functionality. When NEXT_PUBLIC_SENTRY_DSN
 * is configured and @sentry/nextjs is installed, errors are sent to Sentry.
 * Otherwise, errors are logged to the console.
 *
 * To enable Sentry:
 * 1. Install: pnpm add @sentry/nextjs
 * 2. Set NEXT_PUBLIC_SENTRY_DSN in .env.local
 * 3. Run: npx @sentry/wizard@latest -i nextjs
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

// Dynamically imported Sentry module (only loaded if DSN is configured)
let Sentry: typeof import('@sentry/nextjs') | null = null
let initialized = false
let initPromise: Promise<void> | null = null

async function loadSentry(): Promise<boolean> {
  if (Sentry) return true
  if (!SENTRY_DSN) return false

  try {
    Sentry = await import('@sentry/nextjs')
    return true
  } catch {
    // @sentry/nextjs not installed, fall back to console logging
    return false
  }
}

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return !!Sentry
  if (!SENTRY_DSN) return false

  if (!initPromise) {
    initPromise = (async () => {
      const loaded = await loadSentry()
      if (loaded && Sentry) {
        Sentry.init({
          dsn: SENTRY_DSN,
          environment: process.env.NODE_ENV,
          tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
          debug: false,
          beforeSend(event) {
            // Scrub sensitive data from breadcrumbs
            if (event.breadcrumbs) {
              event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
                if (breadcrumb.data?.url) {
                  try {
                    const url = new URL(breadcrumb.data.url as string)
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
            'ResizeObserver loop',
            'Failed to fetch',
            'NetworkError',
            'Load failed',
            'AbortError',
            'User rejected the request',
          ],
        })
      }
      initialized = true
    })()
  }

  await initPromise
  return !!Sentry
}

/**
 * Capture an error with optional context.
 * Falls back to console.error if Sentry is not configured/installed.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) {
    console.error('[Error]', error, context)
    return
  }

  ensureInitialized().then(hasSentry => {
    if (hasSentry && Sentry) {
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
    } else {
      console.error('[Error]', error, context)
    }
  })
}

/**
 * Set the current user for error tracking.
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (!SENTRY_DSN) return

  ensureInitialized().then(hasSentry => {
    if (hasSentry && Sentry) {
      Sentry.setUser(user ? { id: user.id, email: user.email, username: user.username } : null)
    }
  })
}

/**
 * Add a breadcrumb for tracking user flow.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  if (!SENTRY_DSN) return

  ensureInitialized().then(hasSentry => {
    if (hasSentry && Sentry) {
      Sentry.addBreadcrumb({ message, category, data, level: 'info' })
    }
  })
}
