// Favorites types and utilities

export type FavoriteType = 'trader' | 'token'

export interface Favorite {
  id: string
  user_id: string
  type: FavoriteType
  item_id: string // wallet address for traders, token address for tokens
  name?: string // optional display name
  notes?: string // user notes
  created_at: string
}

export interface FavoriteTrader extends Favorite {
  type: 'trader'
  // Additional trader-specific fields can be added here
}

export interface FavoriteToken extends Favorite {
  type: 'token'
  symbol?: string
  // Additional token-specific fields can be added here
}

// Helper to check if an item is favorited
export function isFavorited(favorites: Favorite[], itemId: string, type: FavoriteType): boolean {
  return favorites.some(f => f.item_id === itemId && f.type === type)
}

// Helper to get favorite by item ID
export function getFavorite(favorites: Favorite[], itemId: string, type: FavoriteType): Favorite | undefined {
  return favorites.find(f => f.item_id === itemId && f.type === type)
}

// Helper to filter favorites by type
export function filterByType(favorites: Favorite[], type: FavoriteType): Favorite[] {
  return favorites.filter(f => f.type === type)
}
