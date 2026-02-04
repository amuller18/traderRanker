import { vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { WalletProvider, useWallet } from '@/lib/wallet-context'

// Helper to create a mock Phantom provider
function createMockPhantom(overrides: Record<string, any> = {}) {
  const eventHandlers: Record<string, Array<() => void>> = {}
  return {
    isPhantom: true,
    publicKey: null as { toString: () => string } | null,
    isConnected: false as boolean | null,
    connect: vi.fn().mockResolvedValue({
      publicKey: { toString: () => 'MockPublicKey123' },
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
    signMessage: vi.fn(),
    on: vi.fn((event: string, callback: () => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = []
      eventHandlers[event].push(callback)
    }),
    // Helper to simulate events in tests
    _emit(event: string) {
      eventHandlers[event]?.forEach((cb) => cb())
    },
    ...overrides,
  }
}

// Wrapper for rendering hooks inside WalletProvider
function wrapper({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>
}

describe('WalletProvider and useWallet', () => {
  let originalPhantom: any

  beforeEach(() => {
    originalPhantom = (window as any).phantom
    // Default: no phantom installed
    delete (window as any).phantom
  })

  afterEach(() => {
    if (originalPhantom !== undefined) {
      ;(window as any).phantom = originalPhantom
    } else {
      delete (window as any).phantom
    }
  })

  // ----------------------------------------------------------------
  // Initial state
  // ----------------------------------------------------------------
  describe('initial state', () => {
    it('should have default disconnected state when no Phantom is installed', async () => {
      const { result } = renderHook(() => useWallet(), { wrapper })

      // Allow the useEffect to run
      await waitFor(() => {
        expect(result.current.wallet).toBeNull()
      })

      expect(result.current.publicKey).toBeNull()
      expect(result.current.connected).toBe(false)
      expect(result.current.connecting).toBe(false)
    })

    it('should detect Phantom wallet and set wallet state', async () => {
      const mockPhantom = createMockPhantom()
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.wallet).not.toBeNull()
      })

      expect(result.current.connected).toBe(false)
      expect(result.current.publicKey).toBeNull()
    })

    it('should detect already-connected Phantom wallet on mount', async () => {
      const mockPhantom = createMockPhantom({
        isConnected: true,
        publicKey: { toString: () => 'AlreadyConnectedKey' },
      })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.connected).toBe(true)
      })

      expect(result.current.publicKey).toBe('AlreadyConnectedKey')
    })
  })

  // ----------------------------------------------------------------
  // connectWallet
  // ----------------------------------------------------------------
  describe('connectWallet', () => {
    it('should connect to Phantom wallet and update state', async () => {
      const mockPhantom = createMockPhantom()
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      // Wait for phantom detection
      await waitFor(() => {
        expect(result.current.wallet).not.toBeNull()
      })

      await act(async () => {
        await result.current.connectWallet()
      })

      expect(mockPhantom.connect).toHaveBeenCalledTimes(1)
      expect(result.current.publicKey).toBe('MockPublicKey123')
      expect(result.current.connected).toBe(true)
      expect(result.current.connecting).toBe(false)
    })

    it('should set connecting to true while connection is in progress', async () => {
      let resolveConnect: (value: any) => void
      const connectPromise = new Promise((resolve) => {
        resolveConnect = resolve
      })

      const mockPhantom = createMockPhantom({
        connect: vi.fn(() => connectPromise),
      })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.wallet).not.toBeNull()
      })

      // Start connecting (don't await yet)
      let connectDone = false
      act(() => {
        result.current.connectWallet().then(() => {
          connectDone = true
        })
      })

      // connecting should be true while waiting
      expect(result.current.connecting).toBe(true)

      // Resolve the connect promise
      await act(async () => {
        resolveConnect!({ publicKey: { toString: () => 'DelayedKey' } })
      })

      await waitFor(() => {
        expect(result.current.connecting).toBe(false)
      })

      expect(result.current.connected).toBe(true)
      expect(result.current.publicKey).toBe('DelayedKey')
    })

    it('should open phantom.app if wallet is not installed', async () => {
      // No phantom installed
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      const { result } = renderHook(() => useWallet(), { wrapper })

      await act(async () => {
        await result.current.connectWallet()
      })

      expect(openSpy).toHaveBeenCalledWith('https://phantom.app/', '_blank')

      openSpy.mockRestore()
    })

    it('should handle connection error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockPhantom = createMockPhantom({
        connect: vi.fn().mockRejectedValue(new Error('User rejected')),
      })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.wallet).not.toBeNull()
      })

      await act(async () => {
        await result.current.connectWallet()
      })

      expect(result.current.connecting).toBe(false)
      expect(result.current.connected).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error connecting to Phantom wallet:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  // ----------------------------------------------------------------
  // disconnectWallet
  // ----------------------------------------------------------------
  describe('disconnectWallet', () => {
    it('should disconnect from Phantom wallet and clear state', async () => {
      const mockPhantom = createMockPhantom()
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      // Connect first
      await waitFor(() => {
        expect(result.current.wallet).not.toBeNull()
      })

      await act(async () => {
        await result.current.connectWallet()
      })

      expect(result.current.connected).toBe(true)

      // Now disconnect
      await act(async () => {
        await result.current.disconnectWallet()
      })

      expect(mockPhantom.disconnect).toHaveBeenCalledTimes(1)
      expect(result.current.publicKey).toBeNull()
      expect(result.current.connected).toBe(false)
    })

    it('should handle disconnect error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockPhantom = createMockPhantom({
        disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.wallet).not.toBeNull()
      })

      await act(async () => {
        await result.current.connectWallet()
      })

      await act(async () => {
        await result.current.disconnectWallet()
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error disconnecting from Phantom wallet:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should do nothing if wallet is not set', async () => {
      const { result } = renderHook(() => useWallet(), { wrapper })

      // wallet is null, should not throw
      await act(async () => {
        await result.current.disconnectWallet()
      })

      expect(result.current.connected).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  // Event listeners
  // ----------------------------------------------------------------
  describe('event listeners', () => {
    it('should register connect, disconnect, and accountChanged listeners', async () => {
      const mockPhantom = createMockPhantom()
      ;(window as any).phantom = { solana: mockPhantom }

      renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(mockPhantom.on).toHaveBeenCalledWith('connect', expect.any(Function))
      })

      expect(mockPhantom.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
      expect(mockPhantom.on).toHaveBeenCalledWith('accountChanged', expect.any(Function))
    })

    it('should update state on connect event', async () => {
      const mockPhantom = createMockPhantom()
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(mockPhantom.on).toHaveBeenCalledWith('connect', expect.any(Function))
      })

      // Simulate a connect event by setting publicKey then firing event
      mockPhantom.publicKey = { toString: () => 'EventConnectedKey' }

      act(() => {
        mockPhantom._emit('connect')
      })

      await waitFor(() => {
        expect(result.current.publicKey).toBe('EventConnectedKey')
      })

      expect(result.current.connected).toBe(true)
    })

    it('should clear state on disconnect event', async () => {
      const mockPhantom = createMockPhantom({
        isConnected: true,
        publicKey: { toString: () => 'InitialKey' },
      })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.connected).toBe(true)
      })

      act(() => {
        mockPhantom._emit('disconnect')
      })

      await waitFor(() => {
        expect(result.current.publicKey).toBeNull()
      })

      expect(result.current.connected).toBe(false)
    })

    it('should update publicKey on accountChanged event when new key exists', async () => {
      const mockPhantom = createMockPhantom({
        isConnected: true,
        publicKey: { toString: () => 'OriginalKey' },
      })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.publicKey).toBe('OriginalKey')
      })

      // Change the publicKey and emit accountChanged
      mockPhantom.publicKey = { toString: () => 'NewAccountKey' }

      act(() => {
        mockPhantom._emit('accountChanged')
      })

      await waitFor(() => {
        expect(result.current.publicKey).toBe('NewAccountKey')
      })
    })

    it('should clear state on accountChanged when publicKey is null', async () => {
      const mockPhantom = createMockPhantom({
        isConnected: true,
        publicKey: { toString: () => 'OriginalKey' },
      })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      await waitFor(() => {
        expect(result.current.connected).toBe(true)
      })

      // Set publicKey to null and emit accountChanged
      mockPhantom.publicKey = null

      act(() => {
        mockPhantom._emit('accountChanged')
      })

      await waitFor(() => {
        expect(result.current.publicKey).toBeNull()
      })

      expect(result.current.connected).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  // Non-Phantom provider edge case
  // ----------------------------------------------------------------
  describe('edge cases', () => {
    it('should not set wallet if isPhantom is false', async () => {
      const mockPhantom = createMockPhantom({ isPhantom: false })
      ;(window as any).phantom = { solana: mockPhantom }

      const { result } = renderHook(() => useWallet(), { wrapper })

      // Give the effect time to run
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(result.current.wallet).toBeNull()
    })

    it('should handle phantom detection error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Make accessing phantom throw
      Object.defineProperty(window, 'phantom', {
        get() {
          throw new Error('Access denied')
        },
        configurable: true,
      })

      const { result } = renderHook(() => useWallet(), { wrapper })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(result.current.wallet).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking for Phantom wallet:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()

      // Clean up the property descriptor
      Object.defineProperty(window, 'phantom', {
        value: undefined,
        writable: true,
        configurable: true,
      })
    })
  })
})
