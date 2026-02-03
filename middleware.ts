import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Handle auth code from email confirmation - redirect to callback route
  const code = request.nextUrl.searchParams.get('code')
  const isCallbackRoute = request.nextUrl.pathname === '/auth/callback'

  if (code && !isCallbackRoute) {
    // Redirect to the auth callback route to properly handle the code
    const callbackUrl = new URL('/auth/callback', request.url)
    callbackUrl.searchParams.set('code', code)
    return NextResponse.redirect(callbackUrl)
  }

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
  const isOnboardingPage = request.nextUrl.pathname === '/auth/onboarding'

  // Redirect authenticated users away from auth pages
  // EXCEPT for confirm-email and onboarding pages (needed during signup flow)
  if (isAuthPage && user && !isConfirmEmailPage && !isOnboardingPage) {
    return NextResponse.redirect(new URL('/rankings', request.url))
  }

  // Allow unauthenticated access to public pages
  // Add any protected routes here if needed in the future

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
