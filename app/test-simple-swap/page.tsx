import { SimpleSwap } from "@/app/components/simple-swap"

export default function TestSimpleSwapPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Simple Jupiter Swap Test</h1>
      <p className="text-muted-foreground mb-6">
        This page tests the Jupiter swap functionality with minimal code to isolate the issue.
      </p>

      <div className="max-w-md mx-auto">
        <SimpleSwap />
      </div>
    </div>
  )
}

