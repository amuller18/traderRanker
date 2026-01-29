import { Metadata } from "next"
import { PageHeader } from "@/app/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Privacy Policy | TraderRanker",
  description: "Privacy Policy for TraderRanker - Learn how we collect, use, and protect your personal information.",
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader />
      <main className="flex-1 container py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <Card className="mb-8">
            <CardContent className="prose prose-neutral dark:prose-invert max-w-none pt-6">
              <h2 className="text-2xl font-semibold mt-0">1. Introduction</h2>
              <p>
                TraderRanker (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you use our trading analytics platform.
              </p>

              <h2 className="text-2xl font-semibold">2. Information We Collect</h2>

              <h3 className="text-xl font-semibold">2.1 Information You Provide</h3>
              <ul>
                <li><strong>Account Information:</strong> Email address, username, and password when you register</li>
                <li><strong>Profile Information:</strong> Display name, avatar, and preferences</li>
                <li><strong>Wallet Information:</strong> Public wallet addresses you choose to connect</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through Stripe</li>
                <li><strong>Communications:</strong> Information you provide when contacting support</li>
              </ul>

              <h3 className="text-xl font-semibold">2.2 Information Collected Automatically</h3>
              <ul>
                <li><strong>Usage Data:</strong> Pages visited, features used, and time spent on the platform</li>
                <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
                <li><strong>Cookies:</strong> Session cookies and preference cookies</li>
              </ul>

              <h3 className="text-xl font-semibold">2.3 Blockchain Data</h3>
              <p>
                We analyze publicly available blockchain data from the Solana network, including:
              </p>
              <ul>
                <li>Transaction history and trading patterns</li>
                <li>Wallet balances and token holdings</li>
                <li>Smart contract interactions</li>
              </ul>
              <p>
                This data is publicly available on the blockchain and is not considered personal information.
              </p>

              <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
              <p>We use the collected information to:</p>
              <ul>
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and manage subscriptions</li>
                <li>Send important updates and security alerts</li>
                <li>Respond to your inquiries and support requests</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>

              <h2 className="text-2xl font-semibold">4. Information Sharing</h2>
              <p>We do not sell your personal information. We may share information with:</p>
              <ul>
                <li><strong>Service Providers:</strong> Third parties that help us operate our platform (e.g., Stripe for payments, Supabase for authentication)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              </ul>

              <h2 className="text-2xl font-semibold">5. Data Security</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your information, including:
              </p>
              <ul>
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments</li>
                <li>Access controls and authentication</li>
                <li>Secure password hashing</li>
              </ul>
              <p>
                However, no method of transmission over the Internet is 100% secure. We cannot guarantee
                absolute security of your data.
              </p>

              <h2 className="text-2xl font-semibold">6. Your Rights and Choices</h2>
              <p>Depending on your location, you may have the right to:</p>
              <ul>
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update inaccurate or incomplete data</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Portability:</strong> Receive your data in a portable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              </ul>
              <p>
                To exercise these rights, please contact us at privacy@traderranker.com.
              </p>

              <h2 className="text-2xl font-semibold">7. Cookies and Tracking</h2>
              <p>We use cookies and similar technologies to:</p>
              <ul>
                <li>Keep you logged in</li>
                <li>Remember your preferences</li>
                <li>Understand how you use our platform</li>
                <li>Improve our services</li>
              </ul>
              <p>
                You can control cookies through your browser settings. Disabling cookies may affect
                functionality of the Service.
              </p>

              <h2 className="text-2xl font-semibold">8. Data Retention</h2>
              <p>
                We retain your information for as long as your account is active or as needed to provide
                services. We may retain certain information as required by law or for legitimate business purposes.
              </p>

              <h2 className="text-2xl font-semibold">9. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your own.
                We ensure appropriate safeguards are in place to protect your information in accordance
                with applicable data protection laws.
              </p>

              <h2 className="text-2xl font-semibold">10. Children&apos;s Privacy</h2>
              <p>
                Our Service is not intended for users under 18 years of age. We do not knowingly collect
                information from children. If you believe we have collected information from a minor,
                please contact us immediately.
              </p>

              <h2 className="text-2xl font-semibold">11. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant
                changes by email or through the Service. Your continued use of the Service after changes
                constitutes acceptance of the updated policy.
              </p>

              <h2 className="text-2xl font-semibold">12. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul>
                <li>Email: privacy@traderranker.com</li>
                <li>Website: traderranker.com/contact</li>
              </ul>

              <h2 className="text-2xl font-semibold">13. California Privacy Rights</h2>
              <p>
                California residents have additional rights under the CCPA, including the right to know
                what personal information we collect and the right to request deletion. To exercise these
                rights, contact us at privacy@traderranker.com.
              </p>

              <h2 className="text-2xl font-semibold">14. European Privacy Rights</h2>
              <p>
                If you are in the European Economic Area, you have rights under the GDPR including access,
                rectification, erasure, restriction, portability, and objection. Our legal basis for
                processing includes consent, contract performance, and legitimate interests.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
