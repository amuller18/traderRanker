'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/app/page-header'
import { captureError } from '@/lib/sentry'
import { analytics } from '@/lib/analytics'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error, { boundary: 'rankings', digest: error.digest })
    analytics.errorDisplayed('rankings', error.digest)
  }, [error])

  return (
    <div>
      <PageHeader />
      <div className="min-h-screen gradient-background">
        <div className="container py-10 px-4">
          <Card className="max-w-2xl mx-auto shadow-elevated">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Failed to Load Rankings</CardTitle>
              <CardDescription className="text-base">
                We encountered an error while loading the trader rankings. This could be due to a network issue or a
                temporary server problem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-mono text-muted-foreground">
                  {error.message || 'An unexpected error occurred'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={reset} size="lg" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button variant="outline" size="lg" onClick={() => (window.location.href = '/')}>
                  Return Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
