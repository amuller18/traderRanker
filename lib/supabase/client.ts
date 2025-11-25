import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * SINGLETON browser Supabase client instance.
 * CRITICAL: Must only be created ONCE to maintain session state.
 * Creating multiple clients breaks localStorage/cookie session persistence.
 */
let browserClient: SupabaseClient | null = null

/**
 * Creates or returns the singleton browser Supabase client for client-side operations.
 * Uses NEXT_PUBLIC_ environment variables which are safe for browser exposure.
 *
 * Debug logging can be enabled via NEXT_PUBLIC_DEBUG_SUPABASE=true
 *
 * IMPORTANT: This function ensures only ONE client instance exists across the entire app.
 */
export function createClient() {
  // Return existing instance if already created
  if (browserClient) {
    const debugMode = process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true'
    if (debugMode) {
      console.log('♻️ Reusing existing Supabase client instance (correct behavior)')
    }
    return browserClient
  }

  // For static export builds, provide fallback values
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  const debugMode = process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true'

  if (debugMode) {
    console.group('🔧 Supabase Client Creation (SINGLETON)')
    console.log('Environment:', typeof window !== 'undefined' ? 'Browser' : 'Server')
    console.log('URL configured:', url !== 'https://placeholder.supabase.co')
    console.log('Anon key configured:', anonKey !== 'placeholder-key')
    console.log('URL:', url)
    console.log('Anon key (masked):', maskToken(anonKey))
    console.groupEnd()
  }

  browserClient = createBrowserClient(url, anonKey, {
    auth: {
      // Ensure session persistence in browser localStorage
      persistSession: true,
      // Automatically detect session from URL fragments (e.g., after email confirmation)
      detectSessionInUrl: true,
      // Enable automatic token refresh
      autoRefreshToken: true,
    },
  })

  return browserClient
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
