import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Account | TraderRanker",
  description: "Join TraderRanker to discover top Solana traders, analyze performance, and copy winning strategies.",
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
