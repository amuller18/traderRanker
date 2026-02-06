/**
 * Unit tests for @/app/api/health/route.ts
 *
 * Tests cover:
 * 1. Returns 200 with status 'ok' when all services configured and backend reachable
 * 2. Returns 503 when supabase is not configured
 * 3. Returns 503 when backend is unreachable
 * 4. Reports 'not_configured' when no backend URL
 * 5. Reports stripe as 'missing' when not configured
 * 6. Reports 'configured' when env vars are set
 * 7. Reports backend error status when backend returns non-200
 * 8. Has valid timestamp and uptime in response
 */

import { vi, beforeEach, afterEach } from 'vitest'

function mockNextServer() {
  vi.doMock('next/server', () => ({
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) =>
        new Response(JSON.stringify(body), {
          status: init?.status ?? 200,
          headers: { 'content-type': 'application/json' },
        }),
    },
  }))
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    // Clear relevant env vars so each test starts clean
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.NEXT_PUBLIC_PI_API_BASE
    delete process.env.NEXT_PUBLIC_API_URL
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function callGET(): Promise<Response> {
    mockNextServer()
    const { GET } = await import('@/app/api/health/route')
    return GET()
  }

  it('returns 200 with status ok when all services configured and backend reachable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', 'https://api.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    )

    const response = await callGET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.supabase).toBe('configured')
    expect(body.stripe).toBe('configured')
    expect(body.backend).toBe('ok')
  })

  it('returns 503 when supabase is not configured', async () => {
    // NEXT_PUBLIC_SUPABASE_URL intentionally not set
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', 'https://api.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    )

    const response = await callGET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.supabase).toBe('missing')
  })

  it('returns 503 when backend is unreachable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', 'https://api.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    const response = await callGET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.backend).toBe('unreachable')
  })

  it('reports not_configured when no backend URL is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    // Neither NEXT_PUBLIC_PI_API_BASE nor NEXT_PUBLIC_API_URL is set

    const response = await callGET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.backend).toBe('not_configured')
  })

  it('reports stripe as missing when not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    // STRIPE_SECRET_KEY intentionally not set

    const response = await callGET()
    const body = await response.json()

    expect(body.stripe).toBe('missing')
  })

  it('reports stripe as configured when env var is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_abc')

    const response = await callGET()
    const body = await response.json()

    expect(body.stripe).toBe('configured')
  })

  it('reports backend error status when backend returns non-200', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', 'https://api.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502 })
    )

    const response = await callGET()
    const body = await response.json()

    // error:502 is not 'unreachable', so allOk logic allows 200
    expect(response.status).toBe(200)
    expect(body.backend).toBe('error:502')
  })

  it('has valid timestamp and uptime in response', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')

    const before = new Date().toISOString()
    const response = await callGET()
    const body = await response.json()
    const after = new Date().toISOString()

    // Timestamp should be a valid ISO string between before and after
    expect(body.timestamp).toBeDefined()
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
    expect(body.timestamp >= before).toBe(true)
    expect(body.timestamp <= after).toBe(true)

    // Uptime should be a positive number
    expect(typeof body.uptime).toBe('number')
    expect(body.uptime).toBeGreaterThan(0)
  })

  it('uses NEXT_PUBLIC_API_URL as fallback backend URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://fallback-api.example.com')
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const response = await callGET()
    const body = await response.json()

    expect(body.backend).toBe('ok')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://fallback-api.example.com/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('includes env field from NODE_ENV', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')

    const response = await callGET()
    const body = await response.json()

    expect(body.env).toBe(process.env.NODE_ENV)
  })
})
