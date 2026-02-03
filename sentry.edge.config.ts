import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Set environment
  environment: process.env.NODE_ENV,

  // Only enable when DSN is set
  enabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
});
