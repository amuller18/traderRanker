import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a browser Supabase client for client-side operations.
 * Uses NEXT_PUBLIC_ environment variables which are safe for browser exposure.
 *
 * Debug logging can be enabled via NEXT_PUBLIC_DEBUG_SUPABASE=true
 */
export function createClient() {
  // For static export builds, provide fallback values
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  const debugMode = process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true'

  if (debugMode) {
    console.group('🔧 Supabase Client Creation')
    console.log('Environment:', typeof window !== 'undefined' ? 'Browser' : 'Server')
    console.log('URL configured:', url !== 'https://placeholder.supabase.co')
    console.log('Anon key configured:', anonKey !== 'placeholder-key')
    console.log('URL:', url)
    console.log('Anon key (masked):', maskToken(anonKey))
    console.groupEnd()
  }

  return createBrowserClient(url, anonKey, {
    auth: {
      // Ensure session persistence in browser localStorage
      persistSession: true,
      // Automatically detect session from URL fragments (e.g., after email confirmation)
      detectSessionInUrl: true,
      // Enable automatic token refresh
      autoRefreshToken: true,
    },
  })
}

/**
 * Masks a token/key for safe logging by showing only the first 8 characters.
 * @param token - The token to mask
 * @returns Masked token string (e.g., "eyJhbGci...")
 */
function maskToken(token: string): string {
  if (!token || token.length <= 8) return '***'
  return `${token.substring(0, 8)}...`
}
