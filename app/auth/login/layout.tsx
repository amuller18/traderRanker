import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In | TraderRanker",
  description: "Sign in to your TraderRanker account to access trading analytics and copy trading features.",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
