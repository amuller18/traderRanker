import { AlertTriangle, CheckCircle } from "lucide-react"

interface DataSourceStatusProps {
  usingMockData: boolean
}

export function DataSourceStatus({ usingMockData }: DataSourceStatusProps) {
  if (usingMockData) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
        <div>
          <h3 className="font-medium text-yellow-800">Using Mock Data</h3>
          <p className="text-yellow-700 text-sm">
            This page is currently displaying mock data. In a production environment, this would be connected to
            DynamoDB. Check the environment variables to ensure proper configuration.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6 flex items-start gap-3">
      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
      <div>
        <h3 className="font-medium text-green-800">Using Real Data from DynamoDB</h3>
        <p className="text-green-700 text-sm">
          This page is displaying real data from DynamoDB using the minimal client implementation.
        </p>
      </div>
    </div>
  )
}

