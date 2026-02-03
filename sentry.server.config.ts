import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Set environment
  environment: process.env.NODE_ENV,

  // Only enable when DSN is set
  enabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Filter out non-actionable errors
  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  // Optionally capture additional context
  beforeSend(event, hint) {
    // Filter out expected errors
    const error = hint.originalException;
    if (error instanceof Error) {
      // Don't report rate limit responses as errors
      if (error.message?.includes("rate limit")) {
        return null;
      }
    }
    return event;
  },
});
