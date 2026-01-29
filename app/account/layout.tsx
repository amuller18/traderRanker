import { Metadata } from "next"

export const metadata: Metadata = {
  title: "My Account | TraderRanker",
  description: "Manage your TraderRanker account settings, profile, and subscription.",
}

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
