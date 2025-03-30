import { SimplifiedTokenSwap } from "@/app/components/simplified-token-swap"

export default function TestSimplifiedSwapPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Simplified Token Swap</h1>
      <div className="max-w-md mx-auto">
        <SimplifiedTokenSwap />
      </div>
    </div>
  )
}

