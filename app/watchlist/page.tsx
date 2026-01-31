"use client"

import { useState } from "react"
import Link from "next/link"
import { PageLayout } from "@/app/components/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFavorites } from "@/lib/favorites-context"
import { useAuth } from "@/lib/auth-context"
import { FavoriteButton } from "@/components/favorite-button"
import { Star, Heart, User, Coins, ExternalLink, Trash2, Clock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function WatchlistPage() {
  const { isAuthenticated } = useAuth()
  const { traders, tokens, isLoading, removeFavorite } = useFavorites()
  const [activeTab, setActiveTab] = useState<string>("traders")
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = async (type: 'trader' | 'token', itemId: string) => {
    setRemovingId(itemId)
    try {
      await removeFavorite(type, itemId)
    } finally {
      setRemovingId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <PageLayout
        title="Your Watchlist"
        description="Track your favorite traders and tokens"
      >
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Sign in to access your watchlist</CardTitle>
            <CardDescription>
              Track traders and tokens to build your personalized watchlist
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/auth/login?redirect=/watchlist">
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Your Watchlist"
      description="Track your favorite traders and tokens in one place"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="traders" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Traders ({traders.length})
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Tokens ({tokens.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="traders" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border shadow-sm">
                  <CardContent className="pt-6">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-4" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : traders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No traders tracked yet</h3>
                <p className="text-muted-foreground text-center mb-4 max-w-sm">
                  Start tracking traders to monitor their performance and get notified of their trades.
                </p>
                <Button asChild>
                  <Link href="/rankings">
                    Browse Top Traders <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {traders.map((trader) => (
                <Card
                  key={trader.id}
                  className={cn(
                    "border shadow-sm hover:shadow-md transition-all group",
                    removingId === trader.item_id && "opacity-50"
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {trader.name || truncateAddress(trader.item_id)}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono">
                            {truncateAddress(trader.item_id)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove('trader', trader.item_id)}
                        disabled={removingId === trader.item_id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                      <Clock className="h-3 w-3" />
                      Added {formatDate(trader.created_at)}
                    </div>

                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/rankings?trader=${trader.item_id}`}>
                          View Profile
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <a
                          href={`https://solscan.io/account/${trader.item_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border shadow-sm">
                  <CardContent className="pt-6">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-4" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Coins className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No tokens in watchlist</h3>
                <p className="text-muted-foreground text-center mb-4 max-w-sm">
                  Add tokens to your watchlist to track their price movements and trading activity.
                </p>
                <Button asChild>
                  <Link href="/token-analysis">
                    Explore Tokens <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tokens.map((token) => (
                <Card
                  key={token.id}
                  className={cn(
                    "border shadow-sm hover:shadow-md transition-all group",
                    removingId === token.item_id && "opacity-50"
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-chart-1/10 rounded-lg">
                          <Coins className="h-5 w-5 text-chart-1" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {token.name || token.symbol || truncateAddress(token.item_id)}
                            </h3>
                            {token.symbol && (
                              <Badge variant="secondary" className="text-xs">
                                {token.symbol}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {truncateAddress(token.item_id)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove('token', token.item_id)}
                        disabled={removingId === token.item_id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                      <Clock className="h-3 w-3" />
                      Added {formatDate(token.created_at)}
                    </div>

                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/token-analysis?token=${token.item_id}`}>
                          View Analysis
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <a
                          href={`https://solscan.io/token/${token.item_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
