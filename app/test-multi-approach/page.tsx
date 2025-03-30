import { MultiApproachSwap } from "@/app/components/multi-approach-swap"

export default function TestMultiApproachPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Multi-Approach Jupiter Swap Test</h1>
      <p className="text-muted-foreground mb-6">
        This page tests multiple approaches to sign and send a Jupiter swap transaction.
      </p>

      <div className="max-w-md mx-auto">
        <MultiApproachSwap />
      </div>
    </div>
  )
}

