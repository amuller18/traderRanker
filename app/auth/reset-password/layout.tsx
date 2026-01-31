import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reset Password | TraderRanker",
  description: "Reset your TraderRanker account password.",
}

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
