import { ProductionTokenSwap } from "@/app/components/production-token-swap"

export default function TestProductionSwapPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Production Token Swap</h1>
      <div className="max-w-md mx-auto">
        <ProductionTokenSwap defaultInputToken="SOL" defaultOutputToken="BONK" />
      </div>
    </div>
  )
}

