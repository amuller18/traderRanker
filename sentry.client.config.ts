import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // Adjust this value in production for lower volume
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture Replay for 10% of all sessions in production
  replaysSessionSampleRate: 0.1,

  // Capture 100% of sessions with an error
  replaysOnErrorSampleRate: 1.0,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Filter out common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors that are expected
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // User-caused errors
    "ResizeObserver loop",
    "Non-Error promise rejection",
  ],

  // Set environment
  environment: process.env.NODE_ENV,

  // Only enable in production or when DSN is set
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  integrations: [
    Sentry.replayIntegration({
      // Additional SDK configuration for replay
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
