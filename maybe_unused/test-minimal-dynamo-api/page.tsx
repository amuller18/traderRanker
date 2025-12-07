"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function TestMinimalDynamoApiPage() {
  const [tableName, setTableName] = useState("CallerStatistics")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testScan = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/test-minimal-dynamo?table=${encodeURIComponent(tableName)}`)
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
      <h1 className="text-2xl font-bold mb-4">Minimal DynamoDB API Test</h1>

      <div className="mb-6">
        <p className="text-muted-foreground mb-4">
          This page tests the minimal DynamoDB scan operation directly using an API route. Enter the name of the table
          you want to scan and click "Test Scan".
        </p>

        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Enter table name"
              disabled={isLoading}
            />
          </div>
          <Button onClick={testScan} disabled={isLoading} className="flex items-center gap-2">
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Test Scan
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 rounded mb-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-red-800">Error:</h2>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {result && !error && (
        <div className="p-4 bg-green-100 border border-green-400 rounded mb-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-green-800">Success!</h2>
            <p className="text-green-700">{`Found ${result.count} items in table "${tableName}"`}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Scan Result:</h2>
          <div className="p-4 bg-gray-50 border rounded-lg overflow-auto max-h-[500px]">
            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <Link href="/test-minimal-dynamo">
          <Button variant="outline">Test Minimal DynamoDB</Button>
        </Link>
        <Link href="/rankings">
          <Button variant="outline">View Rankings</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">About This Implementation</h2>
        <p className="text-blue-700 mb-4">This implementation completely avoids any filesystem operations by:</p>
        <ul className="list-disc ml-5 text-blue-700">
          <li>Using direct fetch API calls to AWS instead of the full SDK</li>
          <li>Manually signing requests using AWS Signature V4</li>
          <li>Avoiding any credential providers that might use the filesystem</li>
          <li>Using Web Crypto API for cryptographic operations</li>
        </ul>
      </div>
    </div>
  )
}

