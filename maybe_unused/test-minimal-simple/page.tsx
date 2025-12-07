"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function TestMinimalSimplePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testSimple = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/test-minimal-dynamo-simple")
      const data = await response.json()

      setResult(data)

      if (!data.success) {
        setError(data.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Simple Minimal DynamoDB Test</h1>

      <div className="mb-6">
        <p className="text-muted-foreground mb-4">
          This page tests the minimal DynamoDB client with a simple scan operation. Click the button below to run the
          test.
        </p>

        <Button onClick={testSimple} disabled={isLoading} className="flex items-center gap-2">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Run Simple Test
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 rounded mb-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-red-800">Error:</h2>
            <p className="text-red-700 whitespace-pre-wrap">{error}</p>
            {result?.stack && (
              <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-[200px] p-2 bg-red-50 rounded">
                {result.stack}
              </pre>
            )}
          </div>
        </div>
      )}

      {result && !error && (
        <div className="p-4 bg-green-100 border border-green-400 rounded mb-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-green-800">Success!</h2>
            <p className="text-green-700">{`Found ${result.count} items in the table`}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Test Result:</h2>
          <div className="p-4 bg-gray-50 border rounded-lg overflow-auto max-h-[500px]">
            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <Link href="/test-minimal-dynamo">
          <Button variant="outline">Full Test</Button>
        </Link>
        <Link href="/rankings">
          <Button variant="outline">View Rankings</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  )
}

