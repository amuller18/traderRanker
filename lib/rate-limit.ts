import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

interface RateLimitConfig {
  maxRequests: number      // Maximum requests allowed
  windowMs: number         // Time window in milliseconds
  keyGenerator?: (req: NextRequest) => string  // Custom key generator
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Check if Redis is configured
const isRedisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
)

// Create Redis client for production (if configured)
let redis: Redis | null = null
let redisRateLimiters: Map<string, Ratelimit> = new Map()

function getRedis(): Redis | null {
  if (!isRedisConfigured) return null

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

function getRedisRateLimiter(preset: string, config: RateLimitConfig): Ratelimit | null {
  const redisClient = getRedis()
  if (!redisClient) return null

  const key = `${preset}-${config.maxRequests}-${config.windowMs}`

  if (!redisRateLimiters.has(key)) {
    // Convert windowMs to seconds for Upstash
    const windowSeconds = Math.ceil(config.windowMs / 1000)

    redisRateLimiters.set(key, new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds} s`),
      analytics: true,
      prefix: `ratelimit:${preset}`,
    }))
  }

  return redisRateLimiters.get(key)!
}

// In-memory store (fallback for development or when Redis is not configured)
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

// In-memory rate limit check
function checkRateLimitInMemory(
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

// Simple rate limit check for use within route handlers
// Uses Redis in production, falls back to in-memory for development
export async function rateLimit(
  req: NextRequest,
  routeKey: string,
  config: RateLimitConfig = RateLimitPresets.standard
): Promise<NextResponse | null> {
  const clientId = getClientIdentifier(req)
  const key = `${routeKey}:${req.method}:${clientId}`

  // Try Redis-based rate limiting first (production)
  const redisLimiter = getRedisRateLimiter(routeKey, config)

  if (redisLimiter) {
    try {
      const { success, limit, remaining, reset } = await redisLimiter.limit(key)

      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(Math.ceil(reset / 1000)),
            }
          }
        )
      }

      return null // No rate limit hit
    } catch (error) {
      // If Redis fails, fall back to in-memory
      console.warn('[RateLimit] Redis failed, falling back to in-memory:', error)
    }
  }

  // In-memory fallback (development or Redis failure)
  const result = checkRateLimitInMemory(key, config)

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

// Synchronous version for backwards compatibility (uses in-memory only)
export function rateLimitSync(
  req: NextRequest,
  routeKey: string,
  config: RateLimitConfig = RateLimitPresets.standard
): NextResponse | null {
  const clientId = getClientIdentifier(req)
  const key = `${routeKey}:${req.method}:${clientId}`

  const result = checkRateLimitInMemory(key, config)

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

  return null
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
