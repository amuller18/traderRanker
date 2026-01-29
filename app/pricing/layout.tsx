import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pricing | TraderRanker",
  description: "Simple, transparent pricing for TraderRanker. Choose the perfect plan to supercharge your Solana trading analysis.",
  openGraph: {
    title: "Pricing | TraderRanker",
    description: "Simple, transparent pricing for TraderRanker. Choose the perfect plan to supercharge your Solana trading analysis.",
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
