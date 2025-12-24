import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/app/page-header";


export default function NotFound() {
  return (
    <div className="min-h-screen">
      <PageHeader />
      <div className="container flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
        <h1 className="text-4xl font-bold">Trader Not Found</h1>
        <p className="text-muted-foreground">We couldn't find the trader you're looking for.</p>
        <Link href="/rankings" prefetch={false}>
          <Button>Return to Rankings</Button>
        </Link>
      </div>
    </div>
  )
}

