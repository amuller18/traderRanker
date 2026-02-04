"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { captureError } from "@/lib/sentry"
import { analytics } from "@/lib/analytics"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error, { boundary: 'global', digest: error.digest })
    analytics.errorDisplayed('global', error.digest)
  }, [error])

  return (
    <html lang="en">
      <body className="font-sans">
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center space-y-6 max-w-md">
            <div className="p-4 bg-destructive/10 rounded-full w-fit mx-auto">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Something went wrong</h1>
              <p className="text-muted-foreground">
                We apologize for the inconvenience. An unexpected error has occurred.
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground font-mono">
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button onClick={reset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button variant="outline" onClick={() => window.location.href = "/"}>
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </div>

            <p className="text-sm text-muted-foreground pt-4">
              If this problem persists, please{" "}
              <a href="/contact" className="text-primary hover:underline">
                contact support
              </a>
              .
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
