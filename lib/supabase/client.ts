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
 * IMPORTANT: This function ensures only ONE client instance exists across the entire app.
 */
export function createClient() {
  // Return existing instance if already created
  if (browserClient) {
    return browserClient
  }

  // For static export builds, provide fallback values
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

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
