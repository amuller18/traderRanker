import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Us | TraderRanker",
  description: "Get in touch with TraderRanker. We're here to help with questions, support, or enterprise inquiries.",
  openGraph: {
    title: "Contact Us | TraderRanker",
    description: "Get in touch with TraderRanker. We're here to help with questions, support, or enterprise inquiries.",
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
