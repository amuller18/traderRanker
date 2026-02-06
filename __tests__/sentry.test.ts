/**
 * Unit tests for @/lib/sentry.ts
 *
 * Tests cover:
 * 1. captureError logs to console when DSN is not set
 * 2. captureError calls Sentry.captureException when DSN is set
 * 3. captureError adds context with withScope when context provided
 * 4. setUser does nothing when DSN is not set
 * 5. setUser calls Sentry.setUser when DSN is set
 * 6. addBreadcrumb does nothing when DSN is not set
 * 7. addBreadcrumb calls Sentry.addBreadcrumb when DSN is set
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @sentry/nextjs before importing the module under test
const mockInit = vi.fn()
const mockCaptureException = vi.fn()
const mockSetUser = vi.fn()
const mockAddBreadcrumb = vi.fn()
const mockWithScope = vi.fn((callback: (scope: any) => void) => {
  const mockScope = { setExtra: vi.fn() }
  callback(mockScope)
  return mockScope
})

describe('sentry', () => {
  beforeEach(() => {
    mockInit.mockReset()
    mockCaptureException.mockReset()
    mockSetUser.mockReset()
    mockAddBreadcrumb.mockReset()
    mockWithScope.mockReset()
    mockWithScope.mockImplementation((callback: (scope: any) => void) => {
      const mockScope = { setExtra: vi.fn() }
      callback(mockScope)
      return mockScope
    })
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
  })

  // Helper to wait for async operations to complete
  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

  // ==========================================================================
  // captureError
  // ==========================================================================

  describe('captureError', () => {
    it('should log to console when SENTRY_DSN is not set', async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { captureError } = await import('@/lib/sentry')

      const error = new Error('test error')
      captureError(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Error]', error, undefined)
      consoleErrorSpy.mockRestore()
    })

    it('should log to console with context when SENTRY_DSN is not set', async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { captureError } = await import('@/lib/sentry')

      const error = new Error('test error')
      const context = { page: '/backtest' }
      captureError(error, context)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Error]', error, context)
      consoleErrorSpy.mockRestore()
    })

    it('should call Sentry.captureException when DSN is set and module is available', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { captureError } = await import('@/lib/sentry')

      const error = new Error('something broke')
      captureError(error)

      await flushPromises()

      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockCaptureException).toHaveBeenCalledWith(error)
    })

    it('should call withScope and set extras when context is provided', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      const scopeSetExtra = vi.fn()
      mockWithScope.mockImplementation((callback: (scope: any) => void) => {
        const scope = { setExtra: scopeSetExtra }
        callback(scope)
      })

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { captureError } = await import('@/lib/sentry')

      const error = new Error('context error')
      const context = { userId: 'user-123', page: '/backtest' }
      captureError(error, context)

      await flushPromises()

      expect(mockWithScope).toHaveBeenCalledOnce()
      expect(scopeSetExtra).toHaveBeenCalledWith('userId', 'user-123')
      expect(scopeSetExtra).toHaveBeenCalledWith('page', '/backtest')
    })

    it('should fall back to console when @sentry/nextjs is not installed', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      // Mock the dynamic import to throw (simulating module not installed)
      vi.doMock('@sentry/nextjs', () => {
        throw new Error('Module not found')
      })

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { captureError } = await import('@/lib/sentry')

      const error = new Error('test')
      captureError(error)

      await flushPromises()

      // Should fall back to console.error
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  // ==========================================================================
  // setUser
  // ==========================================================================

  describe('setUser', () => {
    it('should do nothing when SENTRY_DSN is not set', async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { setUser } = await import('@/lib/sentry')

      setUser({ id: 'user-123' })

      await flushPromises()

      expect(mockSetUser).not.toHaveBeenCalled()
    })

    it('should call Sentry.setUser with user data when DSN is set', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { setUser } = await import('@/lib/sentry')

      setUser({ id: 'user-123', email: 'test@example.com', username: 'testuser' })

      await flushPromises()

      expect(mockSetUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      })
    })

    it('should call Sentry.setUser with null to clear user', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { setUser } = await import('@/lib/sentry')

      setUser(null)

      await flushPromises()

      expect(mockSetUser).toHaveBeenCalledWith(null)
    })

    it('should handle partial user data', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { setUser } = await import('@/lib/sentry')

      setUser({ id: 'user-456' })

      await flushPromises()

      expect(mockSetUser).toHaveBeenCalledWith({
        id: 'user-456',
        email: undefined,
        username: undefined,
      })
    })
  })

  // ==========================================================================
  // addBreadcrumb
  // ==========================================================================

  describe('addBreadcrumb', () => {
    it('should do nothing when SENTRY_DSN is not set', async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { addBreadcrumb } = await import('@/lib/sentry')

      addBreadcrumb('clicked button', 'ui')

      await flushPromises()

      expect(mockAddBreadcrumb).not.toHaveBeenCalled()
    })

    it('should call Sentry.addBreadcrumb with message, category, and level', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { addBreadcrumb } = await import('@/lib/sentry')

      addBreadcrumb('user navigated', 'navigation')

      await flushPromises()

      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        message: 'user navigated',
        category: 'navigation',
        data: undefined,
        level: 'info',
      })
    })

    it('should call Sentry.addBreadcrumb with data when provided', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { addBreadcrumb } = await import('@/lib/sentry')

      addBreadcrumb('backtest started', 'feature', { traderCount: 3, plan: 'pro' })

      await flushPromises()

      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        message: 'backtest started',
        category: 'feature',
        data: { traderCount: 3, plan: 'pro' },
        level: 'info',
      })
    })
  })

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('initialization', () => {
    it('should call Sentry.init with correct config when DSN is set', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { captureError } = await import('@/lib/sentry')

      captureError(new Error('trigger init'))

      await flushPromises()

      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          debug: false,
          ignoreErrors: expect.arrayContaining([
            'ResizeObserver loop',
            'Failed to fetch',
            'NetworkError',
            'AbortError',
          ]),
        })
      )
    })

    it('should only initialize once on multiple calls', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { captureError, setUser, addBreadcrumb } = await import('@/lib/sentry')

      captureError(new Error('first'))
      setUser({ id: 'user' })
      addBreadcrumb('test', 'test')

      await flushPromises()

      expect(mockInit).toHaveBeenCalledOnce()
    })

    it('should include beforeSend function in config', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { captureError } = await import('@/lib/sentry')

      captureError(new Error('trigger'))

      await flushPromises()

      const initConfig = mockInit.mock.calls[0][0]
      expect(initConfig.beforeSend).toBeTypeOf('function')
    })
  })
})
