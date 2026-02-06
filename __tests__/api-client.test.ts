/**
 * Unit tests for lib/api-client.ts
 *
 * Tests cover:
 * 1. apiFetch generic wrapper (via exported functions)
 * 2. Successful fetch responses
 * 3. API error responses (non-ok status)
 * 4. Network errors (Failed to fetch TypeError)
 * 5. API key header being set when env var is present
 * 6. Filter parameters being correctly serialized
 * 7. Graceful error handling (returning [] or { success: false })
 * 8. POST / DELETE method calls
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Environment helpers – we need to control env vars *before* the module is
// imported because API_BASE is evaluated at module scope.
// ---------------------------------------------------------------------------

const MOCK_API_BASE = 'http://test-api.example.com'
const MOCK_API_KEY = 'test-api-key-12345'

// We will dynamically import the module in each test group so we can change
// env vars between groups. Keep a handle for the current module.
let apiClient: typeof import('@/lib/api-client')

// Global fetch mock
const mockFetch = vi.fn()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  }
}

function textResponse(text: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: vi.fn().mockResolvedValue(text),
  }
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'No Content',
    text: vi.fn().mockResolvedValue(''),
  }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()

  // Suppress console.error noise from the module's error handling
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  // Reset modules so the next import re-evaluates API_BASE
  vi.resetModules()
})

// ===========================================================================
// 1. fetchTraderStats
// ===========================================================================

describe('fetchTraderStats', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should fetch trader stats and return data on success', async () => {
    const mockData = [{ caller: 'TraderA', n_calls: 10, win_rate_pct: 60 }]
    mockFetch.mockResolvedValueOnce(jsonResponse(mockData))

    const result = await apiClient.fetchTraderStats()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/traders/stats`)
    expect(result).toEqual(mockData)
  })

  it('should include X-API-Key header when env var is set', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchTraderStats()

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['X-API-Key']).toBe(MOCK_API_KEY)
  })

  it('should serialize winRateRange filter parameters', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchTraderStats({
      winRateRange: [20, 80],
      totalCallsRange: [5, 100],
      roiRange: [-50, 500],
    })

    const [url] = mockFetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.searchParams.get('winRateMin')).toBe('20')
    expect(parsed.searchParams.get('winRateMax')).toBe('80')
    expect(parsed.searchParams.get('totalCallsMin')).toBe('5')
    expect(parsed.searchParams.get('totalCallsMax')).toBe('100')
    expect(parsed.searchParams.get('roiMin')).toBe('-50')
    expect(parsed.searchParams.get('roiMax')).toBe('500')
  })

  it('should serialize searchTerm filter parameter', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchTraderStats({
      winRateRange: [0, 100],
      totalCallsRange: [0, 1000],
      roiRange: [-100, 10000],
      searchTerm: 'whale',
    })

    const [url] = mockFetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.searchParams.get('search')).toBe('whale')
  })

  it('should return empty array on API error (non-ok status)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: 'Internal Server Error' }, 500)
    )

    const result = await apiClient.fetchTraderStats()

    expect(result).toEqual([])
  })

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await apiClient.fetchTraderStats()

    expect(result).toEqual([])
  })
})

// ===========================================================================
// 2. fetchTraderTrades
// ===========================================================================

describe('fetchTraderTrades', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should fetch trades for a specific trader', async () => {
    const mockTrades = [{ ca: 'token1', caller: 'TraderA' }]
    mockFetch.mockResolvedValueOnce(jsonResponse(mockTrades))

    const result = await apiClient.fetchTraderTrades('TraderA')

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/traders/TraderA/trades`)
    expect(result).toEqual(mockTrades)
  })

  it('should encode special characters in caller name', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchTraderTrades('Trader With Spaces')

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('Trader%20With%20Spaces')
  })

  it('should include limit and offset query params when provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchTraderTrades('TraderA', { limit: 10, offset: 20 })

    const [url] = mockFetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.searchParams.get('limit')).toBe('10')
    expect(parsed.searchParams.get('offset')).toBe('20')
  })

  it('should return empty array on API error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))

    const result = await apiClient.fetchTraderTrades('UnknownTrader')

    expect(result).toEqual([])
  })

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await apiClient.fetchTraderTrades('TraderA')

    expect(result).toEqual([])
  })
})

// ===========================================================================
// 3. fetchAllTrades
// ===========================================================================

describe('fetchAllTrades', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should fetch all trades from /api/trades', async () => {
    const mockTrades = [{ ca: 'token1' }, { ca: 'token2' }]
    mockFetch.mockResolvedValueOnce(jsonResponse(mockTrades))

    const result = await apiClient.fetchAllTrades()

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/trades`)
    expect(result).toEqual(mockTrades)
  })

  it('should return empty array on error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await apiClient.fetchAllTrades()

    expect(result).toEqual([])
  })
})

// ===========================================================================
// 4. fetchAllTradesFiltered
// ===========================================================================

describe('fetchAllTradesFiltered', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should call /api/trades/filtered without params when no filters', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchAllTradesFiltered()

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/trades/filtered`)
  })

  it('should serialize roiRange and marketCapRange filters', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchAllTradesFiltered({
      roiRange: [-50, 500],
      marketCapRange: [1000, 1000000],
      dateRange: [new Date('2024-01-01T00:00:00Z'), new Date('2024-12-31T23:59:59Z')],
    })

    const [url] = mockFetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.searchParams.get('roiMin')).toBe('-50')
    expect(parsed.searchParams.get('roiMax')).toBe('500')
    expect(parsed.searchParams.get('mcMin')).toBe('1000')
    expect(parsed.searchParams.get('mcMax')).toBe('1000000')
  })

  it('should serialize dateRange as Unix timestamps (seconds)', async () => {
    const from = new Date('2024-06-01T00:00:00Z')
    const to = new Date('2024-06-30T23:59:59Z')
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchAllTradesFiltered({
      roiRange: [0, 100],
      marketCapRange: [0, 1e9],
      dateRange: [from, to],
    })

    const [url] = mockFetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.searchParams.get('dateFrom')).toBe(
      Math.floor(from.getTime() / 1000).toString()
    )
    expect(parsed.searchParams.get('dateTo')).toBe(
      Math.floor(to.getTime() / 1000).toString()
    )
  })

  it('should serialize searchTerm, traderSearchTerm, and timeframe', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchAllTradesFiltered({
      roiRange: [0, 100],
      marketCapRange: [0, 1e9],
      dateRange: [new Date(), new Date()],
      searchTerm: 'SOL',
      traderSearchTerm: 'whale',
      timeframe: '7d',
    })

    const [url] = mockFetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.searchParams.get('search')).toBe('SOL')
    expect(parsed.searchParams.get('trader')).toBe('whale')
    expect(parsed.searchParams.get('timeframe')).toBe('7d')
  })

  it('should return empty array on error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Server Error' }, 500))

    const result = await apiClient.fetchAllTradesFiltered()

    expect(result).toEqual([])
  })
})

// ===========================================================================
// 5. createOrUpdateTrader
// ===========================================================================

describe('createOrUpdateTrader', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should POST trader data and return success result', async () => {
    const successResult = { success: true, message: 'Trader created' }
    mockFetch.mockResolvedValueOnce(jsonResponse(successResult))

    const trader = { caller: 'NewTrader' } as any
    const result = await apiClient.createOrUpdateTrader(trader)

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/traders`)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual(trader)
    expect(result).toEqual(successResult)
  })

  it('should return { success: false } on API error', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: 'Validation error' }, 400)
    )

    const result = await apiClient.createOrUpdateTrader({ caller: 'Bad' } as any)

    expect(result.success).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it('should return { success: false } on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await apiClient.createOrUpdateTrader({ caller: 'X' } as any)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Network error')
  })
})

// ===========================================================================
// 6. createOrUpdateTrade
// ===========================================================================

describe('createOrUpdateTrade', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should POST trade data and return success result', async () => {
    const successResult = { success: true, message: 'Trade created' }
    mockFetch.mockResolvedValueOnce(jsonResponse(successResult))

    const trade = { caller: 'TraderA', ca: 'token1' } as any
    const result = await apiClient.createOrUpdateTrade(trade)

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/trades`)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual(trade)
    expect(result).toEqual(successResult)
  })

  it('should return { success: false } on error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500))

    const result = await apiClient.createOrUpdateTrade({ caller: 'X' } as any)

    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// 7. removeTrader
// ===========================================================================

describe('removeTrader', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should send DELETE request with encoded caller', async () => {
    const successResult = { success: true, message: 'Trader deleted' }
    mockFetch.mockResolvedValueOnce(jsonResponse(successResult))

    const result = await apiClient.removeTrader('Trader A')

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/traders/Trader%20A`)
    expect(options.method).toBe('DELETE')
    expect(result).toEqual(successResult)
  })

  it('should return { success: false } on error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404))

    const result = await apiClient.removeTrader('Ghost')

    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// 8. removeTrade
// ===========================================================================

describe('removeTrade', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should send DELETE request with caller, ca, and date_called in body', async () => {
    const successResult = { success: true, message: 'Trade deleted' }
    mockFetch.mockResolvedValueOnce(jsonResponse(successResult))

    const result = await apiClient.removeTrade('TraderA', 'tokenABC', '2024-01-15T12:00:00Z')

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe(`${MOCK_API_BASE}/api/trades`)
    expect(options.method).toBe('DELETE')
    expect(JSON.parse(options.body)).toEqual({
      caller: 'TraderA',
      ca: 'tokenABC',
      date_called: '2024-01-15T12:00:00Z',
    })
    expect(result).toEqual(successResult)
  })

  it('should return { success: false } on error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await apiClient.removeTrade('X', 'Y', 'Z')

    expect(result.success).toBe(false)
    expect(result.message).toContain('Network error')
  })
})

// ===========================================================================
// 9. apiFetch internals: Content-Type header and empty response handling
// ===========================================================================

describe('apiFetch internals (via exported functions)', () => {
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    vi.stubEnv('NEXT_PUBLIC_PI_API_KEY', MOCK_API_KEY)
    apiClient = await import('@/lib/api-client')
  })

  it('should always send Content-Type: application/json header', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchAllTrades()

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('should handle empty (204) response body gracefully', async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse(204))

    // removeTrader calls apiFetch which returns null for empty body
    const result = await apiClient.removeTrader('TraderX')

    // The function should not throw; it returns the parsed result (null)
    // Since null is returned from apiFetch and removeTrader returns it, expect it
    expect(result).toBeNull()
  })

  it('should parse error body as JSON when available', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: 'Duplicate entry' }, 409)
    )

    const result = await apiClient.createOrUpdateTrader({ caller: 'Dup' } as any)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Duplicate entry')
  })

  it('should handle non-JSON error body (plain text)', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('Bad Gateway', 502))

    // We use removeTrade because textResponse also satisfies !response.ok path
    const result = await apiClient.removeTrade('A', 'B', 'C')

    expect(result.success).toBe(false)
    // The error message should contain either the text or statusText
    expect(result.message).toBeTruthy()
  })
})

// ===========================================================================
// 10. API key omission when env var is not set
// ===========================================================================

describe('API key header behavior', () => {
  it('should NOT include X-API-Key header when env var is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_PI_API_BASE', MOCK_API_BASE)
    // Deliberately do NOT set NEXT_PUBLIC_PI_API_KEY
    delete process.env.NEXT_PUBLIC_PI_API_KEY

    apiClient = await import('@/lib/api-client')
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchAllTrades()

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers).not.toHaveProperty('X-API-Key')
  })
})

// ===========================================================================
// 11. Default API_BASE fallback
// ===========================================================================

describe('API_BASE default fallback', () => {
  it('should use http://localhost:8000 when NEXT_PUBLIC_PI_API_BASE is not set', async () => {
    // Make sure the env var is absent
    delete process.env.NEXT_PUBLIC_PI_API_BASE

    apiClient = await import('@/lib/api-client')
    mockFetch.mockResolvedValueOnce(jsonResponse([]))

    await apiClient.fetchAllTrades()

    const [url] = mockFetch.mock.calls[0]
    expect(url.startsWith('http://localhost:8000')).toBe(true)
  })
})
