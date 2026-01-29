import { Metadata } from "next"
import { PageHeader } from "@/app/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Terms of Service | TraderRanker",
  description: "Terms of Service for TraderRanker - Read our terms and conditions for using our trading analytics platform.",
}

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader />
      <main className="flex-1 container py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <Card className="mb-8">
            <CardContent className="prose prose-neutral dark:prose-invert max-w-none pt-6">
              <h2 className="text-2xl font-semibold mt-0">1. Acceptance of Terms</h2>
              <p>
                By accessing or using TraderRanker (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use the Service.
              </p>

              <h2 className="text-2xl font-semibold">2. Description of Service</h2>
              <p>
                TraderRanker provides on-chain trading analytics, trader rankings, and copy trading functionality
                for the Solana blockchain. The Service includes:
              </p>
              <ul>
                <li>Trader performance analytics and rankings</li>
                <li>Token analysis tools</li>
                <li>Copy trading features</li>
                <li>Backtesting capabilities</li>
                <li>Watchlist and tracking functionality</li>
              </ul>

              <h2 className="text-2xl font-semibold">3. User Accounts</h2>
              <p>
                To access certain features of the Service, you must create an account. You are responsible for:
              </p>
              <ul>
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
              </ul>

              <h2 className="text-2xl font-semibold">4. Wallet Connection</h2>
              <p>
                The Service allows you to connect cryptocurrency wallets (such as Phantom). By connecting your wallet:
              </p>
              <ul>
                <li>You confirm you are the legitimate owner of the wallet</li>
                <li>You understand that blockchain transactions are irreversible</li>
                <li>You accept full responsibility for any transactions initiated through the Service</li>
              </ul>

              <h2 className="text-2xl font-semibold">5. Risk Disclosure</h2>
              <p className="font-semibold text-destructive">
                IMPORTANT: Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor.
              </p>
              <ul>
                <li>Past performance of traders does not guarantee future results</li>
                <li>Copy trading does not eliminate the risk of loss</li>
                <li>You should never trade with money you cannot afford to lose</li>
                <li>The Service does not provide financial, investment, or trading advice</li>
              </ul>

              <h2 className="text-2xl font-semibold">6. Subscription and Payments</h2>
              <p>
                Certain features require a paid subscription. By subscribing:
              </p>
              <ul>
                <li>You authorize us to charge your payment method on a recurring basis</li>
                <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
                <li>Refunds are available within 30 days of purchase as per our refund policy</li>
                <li>Prices may change with 30 days notice</li>
              </ul>

              <h2 className="text-2xl font-semibold">7. Prohibited Conduct</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Use the Service for any illegal purpose</li>
                <li>Attempt to manipulate rankings or analytics</li>
                <li>Scrape, copy, or redistribute our data without permission</li>
                <li>Interfere with the proper functioning of the Service</li>
                <li>Impersonate other users or traders</li>
                <li>Use automated systems to access the Service without permission</li>
              </ul>

              <h2 className="text-2xl font-semibold">8. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by TraderRanker
                and are protected by international copyright, trademark, and other intellectual property laws.
              </p>

              <h2 className="text-2xl font-semibold">9. Disclaimer of Warranties</h2>
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
                ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
              </p>

              <h2 className="text-2xl font-semibold">10. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRADERRANKER SHALL NOT BE LIABLE FOR ANY INDIRECT,
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
                LOSS OF PROFITS, DATA, OR OTHER INTANGIBLE LOSSES.
              </p>

              <h2 className="text-2xl font-semibold">11. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless TraderRanker and its officers, directors, employees,
                and agents from any claims, damages, losses, or expenses arising from your use of the Service
                or violation of these Terms.
              </p>

              <h2 className="text-2xl font-semibold">12. Modifications to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will provide notice of significant
                changes via email or through the Service. Continued use of the Service after changes constitutes
                acceptance of the modified Terms.
              </p>

              <h2 className="text-2xl font-semibold">13. Termination</h2>
              <p>
                We may terminate or suspend your account and access to the Service immediately, without prior
                notice, for any reason, including breach of these Terms.
              </p>

              <h2 className="text-2xl font-semibold">14. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction
                in which TraderRanker operates, without regard to its conflict of law provisions.
              </p>

              <h2 className="text-2xl font-semibold">15. Contact Information</h2>
              <p>
                For questions about these Terms, please contact us at:
              </p>
              <ul>
                <li>Email: legal@traderranker.com</li>
                <li>Website: traderranker.com/contact</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
