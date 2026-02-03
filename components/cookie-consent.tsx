"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Cookie, X } from "lucide-react"
import Link from "next/link"

const COOKIE_CONSENT_KEY = "tr_cookie_consent"
const COOKIE_CONSENT_VERSION = "1"

type ConsentState = {
  essential: boolean
  analytics: boolean
  marketing: boolean
  version: string
  timestamp: number
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [consent, setConsent] = useState<ConsentState>({
    essential: true,
    analytics: false,
    marketing: false,
    version: COOKIE_CONSENT_VERSION,
    timestamp: Date.now(),
  })

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.version === COOKIE_CONSENT_VERSION) {
          setConsent(parsed)
          return
        }
      } catch {
        // Invalid stored consent, show banner
      }
    }
    // No valid consent found, show banner after a short delay
    const timer = setTimeout(() => setShowBanner(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  const saveConsent = (newConsent: ConsentState) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(newConsent))
    setConsent(newConsent)
    setShowBanner(false)

    // Dispatch event for analytics scripts to listen to
    window.dispatchEvent(new CustomEvent("cookieConsentUpdate", { detail: newConsent }))
  }

  const acceptAll = () => {
    saveConsent({
      essential: true,
      analytics: true,
      marketing: true,
      version: COOKIE_CONSENT_VERSION,
      timestamp: Date.now(),
    })
  }

  const acceptEssential = () => {
    saveConsent({
      essential: true,
      analytics: false,
      marketing: false,
      version: COOKIE_CONSENT_VERSION,
      timestamp: Date.now(),
    })
  }

  const savePreferences = () => {
    saveConsent({
      ...consent,
      version: COOKIE_CONSENT_VERSION,
      timestamp: Date.now(),
    })
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <Card className="mx-auto max-w-4xl p-4 md:p-6 shadow-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-start gap-4">
          <div className="hidden sm:block p-2 bg-primary/10 rounded-full">
            <Cookie className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Cookie Preferences</h3>
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your browsing experience, analyze site traffic, and personalize content.
                  You can choose which cookies you allow.{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Learn more
                  </Link>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={acceptEssential}
                aria-label="Close cookie banner"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {showDetails && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Essential Cookies</p>
                    <p className="text-xs text-muted-foreground">Required for the website to function properly</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Always active</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Analytics Cookies</p>
                    <p className="text-xs text-muted-foreground">Help us understand how visitors interact with our website</p>
                  </div>
                  <Button
                    variant={consent.analytics ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConsent({ ...consent, analytics: !consent.analytics })}
                  >
                    {consent.analytics ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Marketing Cookies</p>
                    <p className="text-xs text-muted-foreground">Used to deliver personalized advertisements</p>
                  </div>
                  <Button
                    variant={consent.marketing ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConsent({ ...consent, marketing: !consent.marketing })}
                  >
                    {consent.marketing ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "Hide Details" : "Customize"}
              </Button>
              {showDetails ? (
                <Button size="sm" onClick={savePreferences}>
                  Save Preferences
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={acceptEssential}>
                    Essential Only
                  </Button>
                  <Button size="sm" onClick={acceptAll}>
                    Accept All
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Hook to check consent status
export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (stored) {
      try {
        setConsent(JSON.parse(stored))
      } catch {
        setConsent(null)
      }
    }

    const handleUpdate = (event: CustomEvent<ConsentState>) => {
      setConsent(event.detail)
    }

    window.addEventListener("cookieConsentUpdate", handleUpdate as EventListener)
    return () => window.removeEventListener("cookieConsentUpdate", handleUpdate as EventListener)
  }, [])

  return consent
}
