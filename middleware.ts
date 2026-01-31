import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Session cookie configuration
const SESSION_COOKIE_NAME = 'tr_session_id'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

// Security headers
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

// Generate session ID
function generateSessionId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `sess_${hex}`
}

// Add security headers to response
function addSecurityHeaders(response: NextResponse): void {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add request ID for tracing
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`
  response.headers.set('X-Request-Id', requestId)
}

// Set session cookie if not present
function ensureSessionCookie(request: NextRequest, response: NextResponse): void {
  const existingSession = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!existingSession) {
    const sessionId = generateSessionId()
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    })
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')
  const isConfirmEmailPage = request.nextUrl.pathname === '/auth/confirm-email'

  // Redirect authenticated users away from auth pages
  // EXCEPT for the confirm-email page (needed during email confirmation flow)
  if (isAuthPage && user && !isConfirmEmailPage) {
    const redirectResponse = NextResponse.redirect(new URL('/rankings', request.url))
    addSecurityHeaders(redirectResponse)
    ensureSessionCookie(request, redirectResponse)
    return redirectResponse
  }

  // Add security headers to all responses
  addSecurityHeaders(supabaseResponse)

  // Ensure session cookie exists for tracking
  ensureSessionCookie(request, supabaseResponse)

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
