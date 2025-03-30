import { fetchTraderStats, fetchTraderTrades } from "@/app/actions/trader-actions"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { mockTraderStats } from "@/lib/mock-data"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function TestMinimalDynamoPage() {
  let errorMessage = null
  let traders = []
  let trades = []

  try {
    console.log("Testing minimal DynamoDB connection")

    // Check if we have the required environment variables
    const hasEnvVars = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION

    if (!hasEnvVars) {
      errorMessage = "AWS credentials not found in environment variables"
    } else {
      // Try to fetch data
      traders = await fetchTraderStats()

      // If we have traders, try to fetch trades for the first trader
      if (traders.length > 0) {
        trades = await fetchTraderTrades(traders[0].caller)
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Error testing minimal DynamoDB:", errorMessage)
  }

  // Check if we're using mock data by comparing with the first mock trader
  const usingMockData = traders.length > 0 && traders[0].caller === mockTraderStats[0].caller

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Minimal DynamoDB Connection Test</h1>
      <p className="text-muted-foreground mb-6">
        This page tests the minimal DynamoDB client that avoids any filesystem operations.
      </p>

      {errorMessage ? (
        <div className="p-4 bg-red-100 border border-red-400 rounded mb-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-red-800">Error:</h2>
            <p className="text-red-700">{errorMessage}</p>
          </div>
        </div>
      ) : usingMockData ? (
        <div className="p-4 bg-yellow-100 border border-yellow-400 rounded mb-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-yellow-800">Using Mock Data</h2>
            <p className="text-yellow-700">
              The application connected to DynamoDB but is using mock data. This could be because:
              <ul className="list-disc ml-5 mt-2">
                <li>The table names don't match your DynamoDB tables</li>
                <li>The tables exist but are empty</li>
                <li>The AWS credentials don't have permission to scan the tables</li>
                <li>The data format in DynamoDB doesn't match the expected format</li>
              </ul>
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-green-100 border border-green-400 rounded mb-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-green-800">Connection Successful!</h2>
            <p className="text-green-700">
              {`Retrieved ${traders.length} traders from DynamoDB using the minimal client`}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Environment Variables:</h2>
        <ul className="list-disc pl-5">
          <li>AWS_REGION: {process.env.AWS_REGION ? "Set" : "Not set"}</li>
          <li>AWS_ACCESS_KEY_ID: {process.env.AWS_ACCESS_KEY_ID ? "Set" : "Not set"}</li>
          <li>AWS_SECRET_ACCESS_KEY: {process.env.AWS_SECRET_ACCESS_KEY ? "Set" : "Not set"}</li>
          <li>
            DYNAMODB_TRADERS_TABLE: {process.env.DYNAMODB_TRADERS_TABLE || "Not set (using default 'CallerStatistics')"}
          </li>
          <li>DYNAMODB_TRADES_TABLE: {process.env.DYNAMODB_TRADES_TABLE || "Not set (using default 'Trades')"}</li>
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Trader Data Preview:</h2>
        <div className="p-4 bg-gray-50 border rounded-lg overflow-auto max-h-[300px]">
          {traders.length > 0 ? (
            <pre className="text-sm">{JSON.stringify(traders.slice(0, 3), null, 2)}</pre>
          ) : (
            <p className="text-gray-500">No trader data available.</p>
          )}
        </div>
      </div>

      {trades.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Trade Data Preview:</h2>
          <div className="p-4 bg-gray-50 border rounded-lg overflow-auto max-h-[300px]">
            <pre className="text-sm">{JSON.stringify(trades.slice(0, 3), null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <Link href="/test-minimal-dynamo">
          <Button>Refresh Test</Button>
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

