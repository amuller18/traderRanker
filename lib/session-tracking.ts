import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// Session cookie configuration
export const SESSION_COOKIE_NAME = 'tr_session_id'
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

// Activity types for audit logging
export type ActivityType =
  | 'page_view'
  | 'login'
  | 'logout'
  | 'signup'
  | 'wallet_connect'
  | 'wallet_disconnect'
  | 'wallet_link'
  | 'wallet_unlink'
  | 'favorite_add'
  | 'favorite_remove'
  | 'subscription_start'
  | 'subscription_cancel'
  | 'settings_update'
  | 'api_request'

export interface SessionInfo {
  sessionId: string
  clientIp: string
  userAgent: string
  country?: string
  city?: string
  referrer?: string
  timestamp: number
}

export interface ActivityLog {
  sessionId: string
  userId?: string
  activityType: ActivityType
  metadata?: Record<string, unknown>
  ipAddress: string
  userAgent: string
  timestamp: Date
}

// Get or create session ID from request
export function getOrCreateSessionId(req: NextRequest): {
  sessionId: string
  isNew: boolean
} {
  const existingSessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value

  if (existingSessionId) {
    return { sessionId: existingSessionId, isNew: false }
  }

  // Generate new session ID
  const newSessionId = `sess_${uuidv4().replace(/-/g, '')}`
  return { sessionId: newSessionId, isNew: true }
}

// Set session cookie on response
export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: '/',
  })
}

// Extract session information from request
export function extractSessionInfo(req: NextRequest): SessionInfo {
  const { sessionId } = getOrCreateSessionId(req)

  // Get client IP from various headers
  const forwarded = req.headers.get('x-forwarded-for')
  const vercelForwardedFor = req.headers.get('x-vercel-forwarded-for')
  const cfConnectingIp = req.headers.get('cf-connecting-ip')
  const realIp = req.headers.get('x-real-ip')

  const clientIp = vercelForwardedFor?.split(',')[0]?.trim()
    || cfConnectingIp
    || forwarded?.split(',')[0]?.trim()
    || realIp
    || 'unknown'

  // Get geo info from Vercel headers
  const country = req.headers.get('x-vercel-ip-country') || undefined
  const city = req.headers.get('x-vercel-ip-city') || undefined

  return {
    sessionId,
    clientIp,
    userAgent: req.headers.get('user-agent') || 'unknown',
    country,
    city,
    referrer: req.headers.get('referer') || undefined,
    timestamp: Date.now(),
  }
}

// Security headers to add to all responses
export const SECURITY_HEADERS: Record<string, string> = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Enable XSS protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permissions policy (disable sensitive APIs)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vercel.live https://*.solana.com https://*.helius-rpc.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

// Add security headers to response
export function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

// Request ID header for tracing
export function addRequestId(response: NextResponse): string {
  const requestId = `req_${uuidv4().replace(/-/g, '').substring(0, 16)}`
  response.headers.set('X-Request-Id', requestId)
  return requestId
}

// Add cache control headers
export function addCacheHeaders(
  response: NextResponse,
  options: {
    maxAge?: number
    sMaxAge?: number
    staleWhileRevalidate?: number
    private?: boolean
    noStore?: boolean
  } = {}
): NextResponse {
  if (options.noStore) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return response
  }

  const directives: string[] = []

  if (options.private) {
    directives.push('private')
  } else {
    directives.push('public')
  }

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`)
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`)
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`)
  }

  if (directives.length > 0) {
    response.headers.set('Cache-Control', directives.join(', '))
  }

  return response
}
