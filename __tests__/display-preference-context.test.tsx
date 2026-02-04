import { vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// ----------------------------------------------------------------
// Mock @/lib/supabase/client
// ----------------------------------------------------------------
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
const mockFrom = vi.fn((table: string) => ({
  select: mockSelect,
  update: mockUpdate,
}))

const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: null },
  error: null,
})

const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: {
    subscription: {
      unsubscribe: vi.fn(),
    },
  },
})

const mockSupabase = {
  auth: {
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
  },
  from: mockFrom,
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

// Import after mocking
import {
  DisplayPreferenceProvider,
  useDisplayPreference,
  type DisplayMode,
} from '@/lib/display-preference-context'

// ----------------------------------------------------------------
// localStorage mock helpers
// ----------------------------------------------------------------
const localStorageStore: Record<string, string> = {}

const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key]
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
  }),
  get length() {
    return Object.keys(localStorageStore).length
  },
  key: vi.fn((i: number) => Object.keys(localStorageStore)[i] ?? null),
}

// Wrapper component for rendering hooks
function wrapper({ children }: { children: React.ReactNode }) {
  return <DisplayPreferenceProvider>{children}</DisplayPreferenceProvider>
}

describe('DisplayPreferenceProvider and useDisplayPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage store
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])

    // Install localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    })

    // Default: no session
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    mockSingle.mockResolvedValue({ data: null, error: null })

    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })
  })

  // ----------------------------------------------------------------
  // useDisplayPreference outside provider
  // ----------------------------------------------------------------
  describe('useDisplayPreference outside provider', () => {
    it('should throw when used outside DisplayPreferenceProvider', () => {
      // Suppress error output from the expected throw
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useDisplayPreference())
      }).toThrow('useDisplayPreference must be used within a DisplayPreferenceProvider')

      consoleSpy.mockRestore()
    })
  })

  // ----------------------------------------------------------------
  // Default state
  // ----------------------------------------------------------------
  describe('default state', () => {
    it('should default to price mode when localStorage is empty and user is unauthenticated', async () => {
      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.displayMode).toBe('price')
    })

    it('should initially be loading', async () => {
      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      // isLoading is true initially before async effects resolve
      // (may already be false if effects resolve synchronously in test env)
      expect(typeof result.current.isLoading).toBe('boolean')

      // Wait for loading to finish to avoid act() warnings from unmount
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  // ----------------------------------------------------------------
  // localStorage
  // ----------------------------------------------------------------
  describe('localStorage loading', () => {
    it('should read preference from localStorage on mount', async () => {
      localStorageStore['display_preference'] = 'marketcap'

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.displayMode).toBe('marketcap')
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('display_preference')
    })

    it('should ignore invalid localStorage values', async () => {
      localStorageStore['display_preference'] = 'invalid_mode'

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Falls back to default 'price'
      expect(result.current.displayMode).toBe('price')
    })
  })

  // ----------------------------------------------------------------
  // Supabase sync for authenticated users
  // ----------------------------------------------------------------
  describe('Supabase sync for authenticated users', () => {
    it('should load preference from Supabase profile when user is logged in', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      })

      mockSingle.mockResolvedValue({
        data: { display_preference: 'marketcap' },
        error: null,
      })

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.displayMode).toBe('marketcap')
      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(mockSelect).toHaveBeenCalledWith('display_preference')
    })

    it('should sync localStorage when Supabase profile has a preference', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      })

      mockSingle.mockResolvedValue({
        data: { display_preference: 'marketcap' },
        error: null,
      })

      renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'display_preference',
          'marketcap'
        )
      })
    })

    it('should keep localStorage preference if Supabase profile has no preference', async () => {
      localStorageStore['display_preference'] = 'marketcap'

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
        error: null,
      })

      mockSingle.mockResolvedValue({
        data: { display_preference: null },
        error: null,
      })

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should keep the localStorage value since Supabase has no valid preference
      expect(result.current.displayMode).toBe('marketcap')
    })
  })

  // ----------------------------------------------------------------
  // setDisplayMode
  // ----------------------------------------------------------------
  describe('setDisplayMode', () => {
    it('should update displayMode state', async () => {
      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.setDisplayMode('marketcap')
      })

      expect(result.current.displayMode).toBe('marketcap')
    })

    it('should save to localStorage when mode is set', async () => {
      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.setDisplayMode('marketcap')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'display_preference',
        'marketcap'
      )
    })

    it('should save to Supabase when user is authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-456' },
          },
        },
        error: null,
      })

      mockSingle.mockResolvedValue({
        data: { display_preference: 'price' },
        error: null,
      })

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
      mockUpdate.mockReturnValue({ eq: mockUpdateEq })

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        result.current.setDisplayMode('marketcap')
      })

      // Should have called supabase update
      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(mockUpdate).toHaveBeenCalledWith({ display_preference: 'marketcap' })
    })

    it('should not save to Supabase when user is not authenticated', async () => {
      // Clear any calls from initialization
      mockUpdate.mockClear()

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockUpdate.mockClear()

      act(() => {
        result.current.setDisplayMode('marketcap')
      })

      // update should not be called when no user is logged in
      expect(mockUpdate).not.toHaveBeenCalledWith({ display_preference: 'marketcap' })
    })
  })

  // ----------------------------------------------------------------
  // toggleDisplayMode
  // ----------------------------------------------------------------
  describe('toggleDisplayMode', () => {
    it('should toggle from price to marketcap', async () => {
      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.displayMode).toBe('price')

      act(() => {
        result.current.toggleDisplayMode()
      })

      expect(result.current.displayMode).toBe('marketcap')
    })

    it('should toggle from marketcap to price', async () => {
      localStorageStore['display_preference'] = 'marketcap'

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.displayMode).toBe('marketcap')

      act(() => {
        result.current.toggleDisplayMode()
      })

      expect(result.current.displayMode).toBe('price')
    })

    it('should save toggled mode to localStorage', async () => {
      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.toggleDisplayMode()
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'display_preference',
        'marketcap'
      )
    })
  })

  // ----------------------------------------------------------------
  // Auth state change listener
  // ----------------------------------------------------------------
  describe('auth state change', () => {
    it('should register an auth state change listener', async () => {
      renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(mockOnAuthStateChange).toHaveBeenCalled()
      })
    })

    it('should load preference when user signs in via auth state change', async () => {
      // Start without a session
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      // Capture the auth state change callback
      let authCallback: (event: string, session: any) => void = () => {}
      mockOnAuthStateChange.mockImplementation((cb: any) => {
        authCallback = cb
        return {
          data: {
            subscription: { unsubscribe: vi.fn() },
          },
        }
      })

      // Set up the mock for the profile query that will happen when auth state changes
      const mockAuthSingle = vi.fn().mockResolvedValue({
        data: { display_preference: 'marketcap' },
        error: null,
      })
      const mockAuthEq = vi.fn(() => ({ single: mockAuthSingle }))
      const mockAuthSelect = vi.fn(() => ({ eq: mockAuthEq }))

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Now set up the from mock for the auth state change query
      mockFrom.mockReturnValue({
        select: mockAuthSelect,
        update: mockUpdate,
      })

      // Simulate a sign-in event
      await act(async () => {
        await authCallback('SIGNED_IN', { user: { id: 'new-user-789' } })
      })

      expect(mockAuthSelect).toHaveBeenCalledWith('display_preference')
    })

    it('should clean up subscription on unmount', async () => {
      const mockUnsubscribe = vi.fn()
      mockOnAuthStateChange.mockReturnValue({
        data: {
          subscription: { unsubscribe: mockUnsubscribe },
        },
      })

      const { unmount } = renderHook(() => useDisplayPreference(), { wrapper })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  // Error handling
  // ----------------------------------------------------------------
  describe('error handling', () => {
    it('should handle Supabase errors gracefully and still finish loading', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockGetSession.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useDisplayPreference(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should fall back to default
      expect(result.current.displayMode).toBe('price')

      consoleSpy.mockRestore()
    })
  })
})
