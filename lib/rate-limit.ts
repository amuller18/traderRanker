import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  maxRequests: number      // Maximum requests allowed
  windowMs: number         // Time window in milliseconds
  keyGenerator?: (req: NextRequest) => string  // Custom key generator
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (works for single-instance, use Redis for production scale)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

// Get client identifier from request
export function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from various headers (Vercel, Cloudflare, etc.)
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfConnectingIp = req.headers.get('cf-connecting-ip')
  const vercelForwardedFor = req.headers.get('x-vercel-forwarded-for')

  const ip = vercelForwardedFor?.split(',')[0]?.trim()
    || cfConnectingIp
    || forwarded?.split(',')[0]?.trim()
    || realIp
    || 'unknown'

  return ip
}

// Check rate limit and return result
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  cleanupExpiredEntries()

  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    // Create new entry
    const resetTime = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: config.maxRequests - 1, resetTime }
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    return { allowed: false, remaining: 0, resetTime: entry.resetTime, retryAfter }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime }
}

// Preset rate limit configurations
export const RateLimitPresets = {
  // Strict: For sensitive auth endpoints
  strict: { maxRequests: 5, windowMs: 60 * 1000 },         // 5 per minute

  // Auth: For authentication endpoints
  auth: { maxRequests: 10, windowMs: 60 * 1000 },          // 10 per minute

  // Standard: For general API endpoints
  standard: { maxRequests: 30, windowMs: 60 * 1000 },      // 30 per minute

  // Relaxed: For read-heavy endpoints
  relaxed: { maxRequests: 60, windowMs: 60 * 1000 },       // 60 per minute

  // Burst: For endpoints that may need bursts
  burst: { maxRequests: 100, windowMs: 60 * 1000 },        // 100 per minute
}

// Higher-order function to wrap API route with rate limiting
export function withRateLimit<T extends (...args: [NextRequest, ...unknown[]]) => Promise<NextResponse>>(
  handler: T,
  config: RateLimitConfig = RateLimitPresets.standard,
  keyPrefix = ''
): T {
  return (async (req: NextRequest, ...args: unknown[]) => {
    const clientId = config.keyGenerator?.(req) ?? getClientIdentifier(req)
    const key = `${keyPrefix}:${req.method}:${clientId}`

    const result = checkRateLimit(key, config)

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
          }
        }
      )
    }

    const response = await handler(req, ...args as Parameters<T> extends [NextRequest, ...infer R] ? R : never)

    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', String(config.maxRequests))
    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)))

    return response
  }) as T
}

// Simple rate limit check for use within route handlers
export function rateLimit(
  req: NextRequest,
  routeKey: string,
  config: RateLimitConfig = RateLimitPresets.standard
): NextResponse | null {
  const clientId = getClientIdentifier(req)
  const key = `${routeKey}:${req.method}:${clientId}`

  const result = checkRateLimit(key, config)

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
        }
      }
    )
  }

  return null // No rate limit hit
}

// Add rate limit headers to a response
export function addRateLimitHeaders(
  response: NextResponse,
  req: NextRequest,
  routeKey: string,
  config: RateLimitConfig = RateLimitPresets.standard
): NextResponse {
  const clientId = getClientIdentifier(req)
  const key = `${routeKey}:${req.method}:${clientId}`
  const entry = rateLimitStore.get(key)

  if (entry) {
    response.headers.set('X-RateLimit-Limit', String(config.maxRequests))
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)))
  }

  return response
}
