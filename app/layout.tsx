import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { WalletProvider } from "@/lib/wallet-context"
import { DisplayPreferenceProvider } from "@/lib/display-preference-context"
import { FavoritesProvider } from "@/lib/favorites-context"
import { Toaster } from "@/components/ui/sonner"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { CookieConsent } from "@/components/cookie-consent"

export const metadata: Metadata = {
  title: "TraderRanker - Solana Trading Performance Analytics",
  description: "Track and analyze on-chain trading performance on Solana",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <DisplayPreferenceProvider>
              <WalletProvider>
                <FavoritesProvider>
                  {children}
                  <Toaster />
                  <CookieConsent />
                  <Analytics />
                  <SpeedInsights />
                </FavoritesProvider>
              </WalletProvider>
            </DisplayPreferenceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}