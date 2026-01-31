"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Favorite, FavoriteType, isFavorited as checkIsFavorited, filterByType } from '@/lib/favorites'
import { toast } from 'sonner'

interface FavoritesContextType {
  favorites: Favorite[]
  traders: Favorite[]
  tokens: Favorite[]
  isLoading: boolean
  isFavorited: (itemId: string, type: FavoriteType) => boolean
  addFavorite: (type: FavoriteType, itemId: string, name?: string, symbol?: string, notes?: string) => Promise<void>
  removeFavorite: (type: FavoriteType, itemId: string) => Promise<void>
  toggleFavorite: (type: FavoriteType, itemId: string, name?: string, symbol?: string) => Promise<void>
  refreshFavorites: () => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined)

interface FavoritesProviderProps {
  children: ReactNode
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const { isAuthenticated } = useAuth()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      setFavorites([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/favorites')
      if (response.ok) {
        const data = await response.json()
        setFavorites(data.favorites || [])
      }
    } catch (error) {
      console.error('Failed to fetch favorites:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const traders = filterByType(favorites, 'trader')
  const tokens = filterByType(favorites, 'token')

  const isFavorited = useCallback((itemId: string, type: FavoriteType): boolean => {
    return checkIsFavorited(favorites, itemId, type)
  }, [favorites])

  const addFavorite = useCallback(async (
    type: FavoriteType,
    itemId: string,
    name?: string,
    symbol?: string,
    notes?: string
  ) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to add favorites')
      return
    }

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, item_id: itemId, name, symbol, notes }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add favorite')
      }

      const data = await response.json()
      setFavorites(prev => [data.favorite, ...prev])
      toast.success(`Added to ${type === 'trader' ? 'tracked traders' : 'watchlist'}`)
    } catch (error) {
      console.error('Failed to add favorite:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add favorite')
      throw error
    }
  }, [isAuthenticated])

  const removeFavorite = useCallback(async (type: FavoriteType, itemId: string) => {
    if (!isAuthenticated) return

    try {
      const response = await fetch(
        `/api/favorites?type=${type}&item_id=${encodeURIComponent(itemId)}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove favorite')
      }

      setFavorites(prev => prev.filter(f => !(f.type === type && f.item_id === itemId)))
      toast.success(`Removed from ${type === 'trader' ? 'tracked traders' : 'watchlist'}`)
    } catch (error) {
      console.error('Failed to remove favorite:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove favorite')
      throw error
    }
  }, [isAuthenticated])

  const toggleFavorite = useCallback(async (
    type: FavoriteType,
    itemId: string,
    name?: string,
    symbol?: string
  ) => {
    if (isFavorited(itemId, type)) {
      await removeFavorite(type, itemId)
    } else {
      await addFavorite(type, itemId, name, symbol)
    }
  }, [isFavorited, addFavorite, removeFavorite])

  const refreshFavorites = useCallback(async () => {
    await fetchFavorites()
  }, [fetchFavorites])

  const value: FavoritesContextType = {
    favorites,
    traders,
    tokens,
    isLoading,
    isFavorited,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    refreshFavorites,
  }

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider')
  }
  return context
}
