import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complete Your Profile | TraderRanker",
  description: "Set up your TraderRanker profile to start tracking and following top Solana traders.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
