import { JupiterSdkSwap } from "@/app/components/jupiter-sdk-swap"

export default function TestJupiterSdkPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Jupiter SDK Swap Test</h1>
      <p className="text-muted-foreground mb-6">
        This page tests the Jupiter swap functionality using the Jupiter SDK.
      </p>

      <div className="max-w-md mx-auto">
        <JupiterSdkSwap />
      </div>
    </div>
  )
}

