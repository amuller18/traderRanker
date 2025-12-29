"use client"

import { useState } from "react"
import { PageLayout } from "@/app/components/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Send,
  Loader2,
  CheckCircle2,
  MessageCircle,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Link as LinkIcon
} from "lucide-react"
import Link from "next/link"

export default function SubmitPage() {
  const [telegramLink, setTelegramLink] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const validateTelegramLink = (link: string) => {
    // Accept various Telegram link formats
    const patterns = [
      /^https?:\/\/(t\.me|telegram\.me)\/[a-zA-Z0-9_]+/,
      /^@[a-zA-Z0-9_]+$/,
      /^[a-zA-Z0-9_]+$/
    ]
    return patterns.some(pattern => pattern.test(link.trim()))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!telegramLink.trim()) {
      toast.error("Telegram link is required", {
        description: "Please enter a valid Telegram group or channel link",
      })
      return
    }

    if (!validateTelegramLink(telegramLink)) {
      toast.error("Invalid Telegram link", {
        description: "Please enter a valid Telegram link (e.g., t.me/groupname or @groupname)",
      })
      return
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Invalid email", {
        description: "Please enter a valid email address",
      })
      return
    }

    setIsSubmitting(true)

    // Simulate API call - replace with actual submission logic
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setIsSubmitting(false)
    setIsSubmitted(true)

    toast.success("Submission received!", {
      description: "We'll review and backtest your group soon.",
      duration: 5000,
    })
  }

  const handleSubmitAnother = () => {
    setIsSubmitted(false)
    setTelegramLink("")
    setEmail("")
    setNotes("")
  }

  return (
    <PageLayout
      title="Submit a Telegram Group"
      description="Know a trading group worth tracking? Submit it here and we'll backtest their calls"
    >
      <div className="max-w-4xl mx-auto">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Main Form Card */}
          <div className="lg:col-span-3">
            <Card className="shadow-elevated-lg glass-card overflow-hidden animate-fade-in">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Submit Group for Review</CardTitle>
                    <CardDescription>
                      Help us discover new trading alpha
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isSubmitted ? (
                  <div className="py-12 text-center space-y-6 animate-scale-in">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold">Submission Received!</h3>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        We'll review and backtest this group. If it meets our criteria,
                        it will appear in the rankings.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={handleSubmitAnother}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Submit Another
                      </Button>
                      <Link href="/rankings">
                        <Button className="gap-2 w-full sm:w-auto">
                          View Rankings
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Telegram Link Field */}
                    <div className="space-y-2">
                      <Label htmlFor="telegram-link" className="text-base font-medium">
                        Telegram Group/Channel Link <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="telegram-link"
                          type="text"
                          placeholder="t.me/groupname or @groupname"
                          value={telegramLink}
                          onChange={(e) => setTelegramLink(e.target.value)}
                          disabled={isSubmitting}
                          className="pl-10 h-12 text-base border-2 focus:border-primary transition-colors"
                          required
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enter the Telegram group or channel link (e.g., t.me/example or @example)
                      </p>
                    </div>

                    {/* Email Field (Optional) */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-base font-medium">
                        Your Email <span className="text-muted-foreground text-sm">(optional)</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting}
                        className="h-12 text-base border-2 focus:border-primary transition-colors"
                      />
                      <p className="text-sm text-muted-foreground">
                        We'll notify you when the group is added to our rankings
                      </p>
                    </div>

                    {/* Notes Field (Optional) */}
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-base font-medium">
                        Additional Notes <span className="text-muted-foreground text-sm">(optional)</span>
                      </Label>
                      <Textarea
                        id="notes"
                        placeholder="Any additional context about this group..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isSubmitting}
                        className="min-h-[100px] text-base border-2 focus:border-primary transition-colors resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      className="w-full h-14 text-lg font-semibold shadow-elevated-lg hover:shadow-elevated-xl transition-all duration-200 gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5" />
                          Submit Group
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Info Sidebar */}
          <div className="lg:col-span-2 space-y-6">
            {/* How It Works */}
            <Card className="shadow-elevated glass-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Submit a Group</p>
                    <p className="text-sm text-muted-foreground">
                      Share a Telegram group that makes trading calls
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    2
                  </div>
                  <div>
                    <p className="font-medium">We Backtest</p>
                    <p className="text-sm text-muted-foreground">
                      Our system analyzes historical calls and performance
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Results Published</p>
                    <p className="text-sm text-muted-foreground">
                      Verified groups appear in our rankings
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="shadow-elevated glass-card animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">50+</p>
                    <p className="text-sm text-muted-foreground">Groups Tracked</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                    <p className="text-2xl font-bold">10k+</p>
                    <p className="text-sm text-muted-foreground">Calls Analyzed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA Card */}
            <Card className="shadow-elevated glass-card border-primary/20 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Want to see existing rankings?
                </p>
                <Link href="/rankings">
                  <Button variant="outline" className="w-full gap-2">
                    View Trader Rankings
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
