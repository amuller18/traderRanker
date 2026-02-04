/**
 * Unit tests for @/lib/sentry.ts
 *
 * Tests cover:
 * 1. initSentry does nothing without DSN
 * 2. initSentry calls Sentry.init with correct config when DSN is set
 * 3. captureError calls Sentry.captureException
 * 4. captureError adds context with withScope when context provided
 * 5. setUser calls Sentry.setUser
 * 6. addBreadcrumb calls Sentry.addBreadcrumb
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @sentry/nextjs before importing the module under test
const mockInit = vi.fn()
const mockCaptureException = vi.fn()
const mockSetUser = vi.fn()
const mockAddBreadcrumb = vi.fn()
const mockWithScope = vi.fn((callback: (scope: any) => void) => {
  const mockScope = {
    setExtra: vi.fn(),
  }
  callback(mockScope)
  return mockScope
})

vi.mock('@sentry/nextjs', () => ({
  init: mockInit,
  captureException: mockCaptureException,
  setUser: mockSetUser,
  addBreadcrumb: mockAddBreadcrumb,
  withScope: mockWithScope,
}))

// We need to re-import the module for each test group that relies on
// different env configurations, because SENTRY_DSN is captured at module load.

describe('sentry', () => {
  beforeEach(() => {
    mockInit.mockReset()
    mockCaptureException.mockReset()
    mockSetUser.mockReset()
    mockAddBreadcrumb.mockReset()
    mockWithScope.mockReset()
    mockWithScope.mockImplementation((callback: (scope: any) => void) => {
      const mockScope = {
        setExtra: vi.fn(),
      }
      callback(mockScope)
      return mockScope
    })
    // Reset modules so each test can get a fresh import with fresh `initialized` state
    vi.resetModules()
  })

  // ==========================================================================
  // initSentry
  // ==========================================================================

  describe('initSentry', () => {
    it('should do nothing when SENTRY_DSN is not set', async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN

      // Re-mock after module reset
      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { initSentry } = await import('@/lib/sentry')

      initSentry()

      expect(mockInit).not.toHaveBeenCalled()
    })

    it('should call Sentry.init with correct config when DSN is set', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { initSentry } = await import('@/lib/sentry')

      initSentry()

      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: process.env.NODE_ENV,
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

    it('should only initialize once on repeated calls', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { initSentry } = await import('@/lib/sentry')

      initSentry()
      initSentry()
      initSentry()

      expect(mockInit).toHaveBeenCalledOnce()
    })

    it('should set tracesSampleRate based on NODE_ENV', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { initSentry } = await import('@/lib/sentry')

      initSentry()

      const initConfig = mockInit.mock.calls[0][0]
      // In test environment, NODE_ENV is 'test', so tracesSampleRate should be 1.0
      expect(initConfig.tracesSampleRate).toBe(1.0)
    })

    it('should include a beforeSend function in config', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { initSentry } = await import('@/lib/sentry')

      initSentry()

      const initConfig = mockInit.mock.calls[0][0]
      expect(initConfig.beforeSend).toBeTypeOf('function')
    })
  })

  // ==========================================================================
  // captureError
  // ==========================================================================

  describe('captureError', () => {
    it('should not call Sentry.captureException when DSN is not set', async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { captureError } = await import('@/lib/sentry')

      captureError(new Error('test'))

      expect(mockCaptureException).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should call Sentry.captureException without context', async () => {
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

      expect(mockCaptureException).toHaveBeenCalledOnce()
      expect(mockCaptureException).toHaveBeenCalledWith(error)
    })

    it('should call Sentry.withScope and set extras when context is provided', async () => {
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

      expect(mockWithScope).toHaveBeenCalledOnce()
      expect(scopeSetExtra).toHaveBeenCalledWith('userId', 'user-123')
      expect(scopeSetExtra).toHaveBeenCalledWith('page', '/backtest')
      expect(mockCaptureException).toHaveBeenCalledWith(error)
    })

    it('should auto-initialize sentry if not yet initialized', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { captureError } = await import('@/lib/sentry')

      captureError(new Error('auto init'))

      // Should have called init before capturing
      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockCaptureException).toHaveBeenCalledOnce()
    })
  })

  // ==========================================================================
  // setUser
  // ==========================================================================

  describe('setUser', () => {
    it('should not call Sentry.setUser when DSN is not set', async () => {
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

      expect(mockSetUser).not.toHaveBeenCalled()
    })

    it('should call Sentry.setUser with user data', async () => {
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

      expect(mockSetUser).toHaveBeenCalledOnce()
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

      expect(mockSetUser).toHaveBeenCalledOnce()
      expect(mockSetUser).toHaveBeenCalledWith(null)
    })

    it('should call Sentry.setUser with partial user data', async () => {
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

      expect(mockSetUser).toHaveBeenCalledOnce()
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
    it('should not call Sentry.addBreadcrumb when DSN is not set', async () => {
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

      expect(mockAddBreadcrumb).toHaveBeenCalledOnce()
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

      expect(mockAddBreadcrumb).toHaveBeenCalledOnce()
      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        message: 'backtest started',
        category: 'feature',
        data: { traderCount: 3, plan: 'pro' },
        level: 'info',
      })
    })

    it('should auto-initialize sentry if not yet initialized', async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'

      vi.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        captureException: mockCaptureException,
        setUser: mockSetUser,
        addBreadcrumb: mockAddBreadcrumb,
        withScope: mockWithScope,
      }))

      const { addBreadcrumb } = await import('@/lib/sentry')

      addBreadcrumb('test', 'test')

      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockAddBreadcrumb).toHaveBeenCalledOnce()
    })
  })
})
