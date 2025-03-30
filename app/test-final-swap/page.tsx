import { FinalTokenSwap } from "@/app/components/final-token-swap"

export default function TestFinalSwapPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Token Swap</h1>
      <div className="max-w-md mx-auto">
        <FinalTokenSwap defaultInputToken="SOL" defaultOutputToken="BONK" />
      </div>
    </div>
  )
}

