import { SwapIntegration } from "./swap-integration"

export default function TokenAnalysisPage({ params }: { params: { token: string } }) {
  const tokenSymbol = params.token.toUpperCase()

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{tokenSymbol} Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {/* Token info and charts would go here */}
          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">{tokenSymbol} Information</h2>
            <p>Token analysis and charts would be displayed here.</p>
          </div>
        </div>

        <div>
          {/* Swap component */}
          <SwapIntegration tokenSymbol={tokenSymbol} />
        </div>
      </div>
    </div>
  )
}

