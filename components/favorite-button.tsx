"use client"

import { useState } from "react"
import { Heart, Star, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFavorites } from "@/lib/favorites-context"
import { useAuth } from "@/lib/auth-context"
import { FavoriteType } from "@/lib/favorites"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FavoriteButtonProps {
  type: FavoriteType
  itemId: string
  name?: string
  symbol?: string
  variant?: "icon" | "button"
  size?: "sm" | "default" | "lg"
  className?: string
}

export function FavoriteButton({
  type,
  itemId,
  name,
  symbol,
  variant = "icon",
  size = "default",
  className,
}: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth()
  const { isFavorited, toggleFavorite } = useFavorites()
  const [isLoading, setIsLoading] = useState(false)

  const favorited = isFavorited(itemId, type)
  const Icon = type === "trader" ? Star : Heart

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isAuthenticated) {
      return
    }

    setIsLoading(true)
    try {
      await toggleFavorite(type, itemId, name, symbol)
    } finally {
      setIsLoading(false)
    }
  }

  const iconSizes = {
    sm: "h-4 w-4",
    default: "h-5 w-5",
    lg: "h-6 w-6",
  }

  const buttonSizes = {
    sm: "h-8 px-3 text-xs",
    default: "h-9 px-4 text-sm",
    lg: "h-10 px-6 text-base",
  }

  const label = favorited
    ? type === "trader"
      ? "Remove from tracked"
      : "Remove from watchlist"
    : type === "trader"
    ? "Track this trader"
    : "Add to watchlist"

  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick}
              disabled={isLoading || !isAuthenticated}
              className={cn(
                "transition-all",
                favorited && "text-yellow-500 hover:text-yellow-600",
                !isAuthenticated && "opacity-50",
                className
              )}
            >
              {isLoading ? (
                <Loader2 className={cn(iconSizes[size], "animate-spin")} />
              ) : (
                <Icon
                  className={cn(
                    iconSizes[size],
                    favorited && "fill-current"
                  )}
                />
              )}
              <span className="sr-only">{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isAuthenticated ? label : "Sign in to track"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant={favorited ? "default" : "outline"}
      size={size}
      onClick={handleClick}
      disabled={isLoading || !isAuthenticated}
      className={cn(
        buttonSizes[size],
        favorited && "bg-yellow-500 hover:bg-yellow-600 text-white",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className={cn(iconSizes[size], "mr-2 animate-spin")} />
      ) : (
        <Icon
          className={cn(
            iconSizes[size],
            "mr-2",
            favorited && "fill-current"
          )}
        />
      )}
      {favorited
        ? type === "trader"
          ? "Tracking"
          : "Watching"
        : type === "trader"
        ? "Track"
        : "Watch"}
    </Button>
  )
}
