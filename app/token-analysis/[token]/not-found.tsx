import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
      <h1 className="text-4xl font-bold">Token Not Found</h1>
      <p className="text-muted-foreground">
        We couldn't find the token you're looking for. The token may not exist or may not have any trading pairs.
      </p>
      <Link href="/token-analysis">
        <Button>Return to Token Analysis</Button>
      </Link>
    </div>
  )
}

