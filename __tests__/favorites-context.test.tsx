import { vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// ----------------------------------------------------------------
// Mock sonner toast
// ----------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

// ----------------------------------------------------------------
// Mock @/lib/auth-context
// ----------------------------------------------------------------
let mockIsAuthenticated = false

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { id: 'test-user-id', email: 'test@test.com', username: 'testuser' } : null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    linkWallet: vi.fn(),
    unlinkWallet: vi.fn(),
    updateProfile: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Import after mocking
import { FavoritesProvider, useFavorites } from '@/lib/favorites-context'
import { toast } from 'sonner'

// ----------------------------------------------------------------
// Helper types and data
// ----------------------------------------------------------------
const mockTraderFavorite = {
  id: 'fav-1',
  user_id: 'test-user-id',
  type: 'trader' as const,
  item_id: 'wallet-abc',
  name: 'Top Trader',
  created_at: '2025-01-01T00:00:00Z',
}

const mockTokenFavorite = {
  id: 'fav-2',
  user_id: 'test-user-id',
  type: 'token' as const,
  item_id: 'token-xyz',
  name: 'Sol Token',
  symbol: 'SOL',
  created_at: '2025-01-02T00:00:00Z',
}

const mockFavorites = [mockTraderFavorite, mockTokenFavorite]

// Wrapper
function wrapper({ children }: { children: React.ReactNode }) {
  return <FavoritesProvider>{children}</FavoritesProvider>
}

describe('FavoritesProvider and useFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = false

    // Default fetch mock: return empty favorites
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ favorites: [] }),
    }) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ----------------------------------------------------------------
  // useFavorites outside provider
  // ----------------------------------------------------------------
  describe('useFavorites outside provider', () => {
    it('should throw when used outside FavoritesProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useFavorites())
      }).toThrow('useFavorites must be used within a FavoritesProvider')

      consoleSpy.mockRestore()
    })
  })

  // ----------------------------------------------------------------
  // Unauthenticated state
  // ----------------------------------------------------------------
  describe('unauthenticated state', () => {
    it('should have empty favorites when not authenticated', async () => {
      mockIsAuthenticated = false

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.favorites).toEqual([])
      expect(result.current.traders).toEqual([])
      expect(result.current.tokens).toEqual([])
    })

    it('should not fetch favorites when not authenticated', async () => {
      mockIsAuthenticated = false

      renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled()
      })
    })

    it('should show error toast when trying to add favorite while unauthenticated', async () => {
      mockIsAuthenticated = false

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await act(async () => {
        await result.current.addFavorite('trader', 'wallet-123', 'Trader Name')
      })

      expect(toast.error).toHaveBeenCalledWith('Please sign in to add favorites')
    })

    it('should not remove favorite when not authenticated', async () => {
      mockIsAuthenticated = false

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await act(async () => {
        await result.current.removeFavorite('trader', 'wallet-123')
      })

      // fetch should not be called for DELETE
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  // Authenticated state - fetching
  // ----------------------------------------------------------------
  describe('authenticated state - fetching', () => {
    beforeEach(() => {
      mockIsAuthenticated = true
    })

    it('should fetch favorites on mount when authenticated', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/favorites')
      expect(result.current.favorites).toHaveLength(2)
    })

    it('should separate traders and tokens', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      expect(result.current.traders).toHaveLength(1)
      expect(result.current.traders[0].item_id).toBe('wallet-abc')
      expect(result.current.tokens).toHaveLength(1)
      expect(result.current.tokens[0].item_id).toBe('token-xyz')
    })

    it('should handle fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.favorites).toEqual([])

      consoleSpy.mockRestore()
    })

    it('should handle non-ok response gracefully', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.favorites).toEqual([])
    })
  })

  // ----------------------------------------------------------------
  // isFavorited
  // ----------------------------------------------------------------
  describe('isFavorited', () => {
    beforeEach(() => {
      mockIsAuthenticated = true
    })

    it('should return true for a favorited item', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      expect(result.current.isFavorited('wallet-abc', 'trader')).toBe(true)
      expect(result.current.isFavorited('token-xyz', 'token')).toBe(true)
    })

    it('should return false for a non-favorited item', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      expect(result.current.isFavorited('unknown-id', 'trader')).toBe(false)
      expect(result.current.isFavorited('wallet-abc', 'token')).toBe(false) // wrong type
    })
  })

  // ----------------------------------------------------------------
  // addFavorite
  // ----------------------------------------------------------------
  describe('addFavorite', () => {
    beforeEach(() => {
      mockIsAuthenticated = true
    })

    it('should add a trader favorite and update state', async () => {
      // Initial fetch returns empty
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newFavorite = {
        id: 'fav-new',
        user_id: 'test-user-id',
        type: 'trader',
        item_id: 'new-wallet',
        name: 'New Trader',
        created_at: '2025-01-03T00:00:00Z',
      }

      // Mock the POST response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorite: newFavorite }),
      })

      await act(async () => {
        await result.current.addFavorite('trader', 'new-wallet', 'New Trader')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'trader',
          item_id: 'new-wallet',
          name: 'New Trader',
          symbol: undefined,
          notes: undefined,
        }),
      })

      expect(result.current.favorites).toHaveLength(1)
      expect(result.current.favorites[0].item_id).toBe('new-wallet')
      expect(toast.success).toHaveBeenCalledWith('Added to tracked traders')
    })

    it('should add a token favorite with symbol', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newToken = {
        id: 'fav-token-new',
        user_id: 'test-user-id',
        type: 'token',
        item_id: 'token-address',
        name: 'New Token',
        symbol: 'NTK',
        created_at: '2025-01-03T00:00:00Z',
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorite: newToken }),
      })

      await act(async () => {
        await result.current.addFavorite('token', 'token-address', 'New Token', 'NTK')
      })

      expect(toast.success).toHaveBeenCalledWith('Added to watchlist')
      expect(result.current.tokens).toHaveLength(1)
    })

    it('should handle add favorite API error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Duplicate entry' }),
      })

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.addFavorite('trader', 'wallet-dup')
        } catch (e) {
          thrownError = e as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError!.message).toBe('Duplicate entry')
      expect(toast.error).toHaveBeenCalledWith('Duplicate entry')
      expect(result.current.favorites).toHaveLength(0)

      consoleSpy.mockRestore()
    })
  })

  // ----------------------------------------------------------------
  // removeFavorite
  // ----------------------------------------------------------------
  describe('removeFavorite', () => {
    beforeEach(() => {
      mockIsAuthenticated = true
    })

    it('should remove a favorite and update state', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      // Mock the DELETE response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await act(async () => {
        await result.current.removeFavorite('trader', 'wallet-abc')
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/favorites?type=trader&item_id=wallet-abc',
        { method: 'DELETE' }
      )

      expect(result.current.favorites).toHaveLength(1)
      expect(result.current.traders).toHaveLength(0)
      expect(result.current.tokens).toHaveLength(1)
      expect(toast.success).toHaveBeenCalledWith('Removed from tracked traders')
    })

    it('should show correct toast for removing a token', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await act(async () => {
        await result.current.removeFavorite('token', 'token-xyz')
      })

      expect(toast.success).toHaveBeenCalledWith('Removed from watchlist')
    })

    it('should handle remove favorite API error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      })

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.removeFavorite('trader', 'wallet-abc')
        } catch (e) {
          thrownError = e as Error
        }
      })

      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError!.message).toBe('Not found')
      expect(toast.error).toHaveBeenCalledWith('Not found')
      // State should not have changed since the operation failed
      expect(result.current.favorites).toHaveLength(2)

      consoleSpy.mockRestore()
    })

    it('should URL-encode item_id in the DELETE request', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          favorites: [
            {
              ...mockTraderFavorite,
              item_id: 'wallet/with+special chars',
            },
          ],
        }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(1)
      })

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await act(async () => {
        await result.current.removeFavorite('trader', 'wallet/with+special chars')
      })

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/favorites?type=trader&item_id=${encodeURIComponent('wallet/with+special chars')}`,
        { method: 'DELETE' }
      )
    })
  })

  // ----------------------------------------------------------------
  // toggleFavorite
  // ----------------------------------------------------------------
  describe('toggleFavorite', () => {
    beforeEach(() => {
      mockIsAuthenticated = true
    })

    it('should add favorite when item is not favorited', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [] }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newFav = {
        id: 'fav-toggle-new',
        user_id: 'test-user-id',
        type: 'trader',
        item_id: 'toggle-wallet',
        name: 'Toggle Trader',
        created_at: '2025-01-04T00:00:00Z',
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorite: newFav }),
      })

      await act(async () => {
        await result.current.toggleFavorite('trader', 'toggle-wallet', 'Toggle Trader')
      })

      expect(result.current.isFavorited('toggle-wallet', 'trader')).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('Added to tracked traders')
    })

    it('should remove favorite when item is already favorited', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [mockTraderFavorite] }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(1)
      })

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await act(async () => {
        await result.current.toggleFavorite('trader', 'wallet-abc', 'Top Trader')
      })

      expect(result.current.isFavorited('wallet-abc', 'trader')).toBe(false)
      expect(toast.success).toHaveBeenCalledWith('Removed from tracked traders')
    })
  })

  // ----------------------------------------------------------------
  // refreshFavorites
  // ----------------------------------------------------------------
  describe('refreshFavorites', () => {
    beforeEach(() => {
      mockIsAuthenticated = true
    })

    it('should re-fetch favorites from the API', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: [mockTraderFavorite] }),
      })

      const { result } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(1)
      })

      // Setup the second fetch with updated data
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      await act(async () => {
        await result.current.refreshFavorites()
      })

      expect(result.current.favorites).toHaveLength(2)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  // ----------------------------------------------------------------
  // Loading states
  // ----------------------------------------------------------------
  describe('loading states', () => {
    beforeEach(() => {
      mockIsAuthenticated = true
    })

    it('should set isLoading true while fetching and false when done', async () => {
      let resolveFetch: (value: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve
      })

      ;(global.fetch as any).mockReturnValue(fetchPromise)

      const { result } = renderHook(() => useFavorites(), { wrapper })

      // Should be loading
      expect(result.current.isLoading).toBe(true)

      // Resolve the fetch
      await act(async () => {
        resolveFetch!({
          ok: true,
          json: async () => ({ favorites: [] }),
        })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  // ----------------------------------------------------------------
  // Reactivity to auth state changes
  // ----------------------------------------------------------------
  describe('reactivity to authentication changes', () => {
    it('should clear favorites when user becomes unauthenticated', async () => {
      mockIsAuthenticated = true

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      const { result, rerender } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      // Simulate losing auth
      mockIsAuthenticated = false

      // The useCallback for fetchFavorites depends on isAuthenticated,
      // so we need to re-render to pick up the change
      rerender()

      await waitFor(() => {
        expect(result.current.favorites).toEqual([])
      })
    })

    it('should fetch favorites when user becomes authenticated', async () => {
      mockIsAuthenticated = false

      const { result, rerender } = renderHook(() => useFavorites(), { wrapper })

      await waitFor(() => {
        expect(result.current.favorites).toEqual([])
      })

      expect(global.fetch).not.toHaveBeenCalled()

      // Simulate auth
      mockIsAuthenticated = true
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ favorites: mockFavorites }),
      })

      rerender()

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2)
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/favorites')
    })
  })
})
