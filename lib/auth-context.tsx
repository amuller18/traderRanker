"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  wallet_pubkeys?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  wallet_address?: string;  // Keep for backward compatibility
  wallet_pubkeys?: string;  // New field for Phantom wallet
  full_name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<{ requiresEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  linkWallet: (walletAddress: string) => Promise<void>;
  unlinkWallet: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Enable debug mode via environment variable
const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true';

/**
 * Masks a token/key for safe logging by showing only the first 8 characters.
 * @param token - The token to mask
 * @returns Masked token string (e.g., "eyJhbGci...") or empty string
 */
function maskToken(token: string | undefined | null): string {
  if (!token) return '(no token)';
  if (token.length <= 8) return '***';
  return `${token.substring(0, 8)}...`;
}

/**
 * Safely stringifies an object for logging without throwing errors.
 * Handles circular references and non-serializable values.
 *
 * @param obj - The object to stringify
 * @param indent - Whether to use pretty-printing (default: false)
 * @returns JSON string or error message
 */
function safeStringify(obj: unknown, indent = false): string {
  try {
    return JSON.stringify(obj, null, indent ? 2 : 0);
  } catch (error) {
    return `[Unstringifiable: ${error instanceof Error ? error.message : 'unknown error'}]`;
  }
}

/**
 * Safely logs Supabase errors without causing runtime exceptions.
 * Guards against null/undefined error objects and safely accesses properties.
 * Uses console.group for structured, collapsible logging.
 *
 * @param context - Description of where the error occurred (e.g., 'fetchUserProfile')
 * @param err - The error object from Supabase (can be null, undefined, or any shape)
 */
function safeLogSupabaseError(context: string, err: unknown): void {
  console.group(`❌ ${context} - Supabase Error`);

  try {
    // Always log the raw error first to avoid losing information
    console.error('Raw error:', err);
    console.error('Error type:', typeof err);
    console.error('Error constructor:', err?.constructor?.name || 'N/A');

    // Guard: If error is null, undefined, or not an object, we can't safely access properties
    if (!err || typeof err !== 'object') {
      console.error('⚠️ Error is not an object, cannot extract properties');
      console.groupEnd();
      return;
    }

    // Safely extract common Supabase error properties with fallbacks
    // Supabase errors typically have: code, message, details, hint, status
    const errorObj = err as Record<string, unknown>;
    const safeError = {
      code: errorObj.code ?? errorObj.status ?? null,
      message: errorObj.message ?? errorObj.error_description ?? 'Unknown error',
      details: errorObj.details ?? null,
      hint: errorObj.hint ?? null,
      status: errorObj.status ?? null,
    };

    console.error('Extracted properties:', safeError);
  } catch (loggingError) {
    console.error('⚠️ Exception while logging error:', loggingError);
  } finally {
    console.groupEnd();
  }
}

/**
 * Logs detailed information about a Supabase session in a structured, safe manner.
 * @param session - The session object from getSession()
 */
function logSessionDetails(session: any): void {
  if (!DEBUG_MODE) return;

  console.group('🔐 Session Details');
  try {
    console.log('Session exists:', !!session);
    console.log('Access token present:', !!session?.access_token);
    console.log('Access token (masked):', maskToken(session?.access_token));
    console.log('Refresh token present:', !!session?.refresh_token);
    console.log('Refresh token (masked):', maskToken(session?.refresh_token));
    console.log('Token type:', session?.token_type ?? 'N/A');
    console.log('Expires at:', session?.expires_at ?? 'N/A');
    console.log('Expires in (seconds):', session?.expires_in ?? 'N/A');
    console.log('User ID:', session?.user?.id ?? 'N/A');
    console.log('User email:', session?.user?.email ?? 'N/A');
  } catch (error) {
    console.error('Error logging session details:', error);
  } finally {
    console.groupEnd();
  }
}

/**
 * Logs detailed information about a Supabase user in a structured, safe manner.
 * @param user - The user object from getUser()
 */
function logUserDetails(user: any): void {
  if (!DEBUG_MODE) return;

  console.group('👤 User Details');
  try {
    console.log('User exists:', !!user);
    console.log('User ID:', user?.id ?? 'N/A');
    console.log('Email:', user?.email ?? 'N/A');
    console.log('Email confirmed:', user?.email_confirmed_at ? 'Yes' : 'No');
    console.log('Created at:', user?.created_at ?? 'N/A');
    console.log('User metadata:', safeStringify(user?.user_metadata));
    console.log('App metadata:', safeStringify(user?.app_metadata));
  } catch (error) {
    console.error('Error logging user details:', error);
  } finally {
    console.groupEnd();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // CRITICAL: Use useMemo to ensure we get the same client instance across renders
  // This prevents creating multiple clients which breaks session persistence
  const supabase = useMemo(() => createClient(), []);

  /**
   * Fetches user profile from Supabase with extensive debugging and retry logic.
   *
   * FEATURES:
   * - Client-side only execution (guards against SSR/server-side calls)
   * - Comprehensive logging of session, user, tokens, REST URLs, headers
   * - Safe error handling that never throws on logging
   * - Retry logic for both database race conditions (PGRST116) and network errors
   * - Deterministic debugging output for troubleshooting
   *
   * RACE CONDITION HANDLING:
   * After user registration, the database trigger creates a profile row asynchronously.
   * If we query too quickly, we get PGRST116 (no rows). We retry with backoff.
   *
   * NETWORK ERROR HANDLING:
   * Network failures, timeouts, or fetch errors trigger a single retry after 250ms.
   *
   * @param authUser - The authenticated Supabase user object
   * @param retries - Number of retry attempts remaining for PGRST116 (default: 3)
   * @param delay - Delay in milliseconds before retrying PGRST116 (default: 1000ms)
   * @param networkRetries - Number of retry attempts for network errors (default: 1)
   * @returns User profile object or null if not found/error occurred
   */
  const fetchUserProfile = async (
    authUser: SupabaseUser,
    retries = 3,
    delay = 1000,
    networkRetries = 1
  ): Promise<User | null> => {
    const startTime = Date.now();

    console.group('🔍 fetchUserProfile - START');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Retry attempts remaining (PGRST116):', retries);
    console.log('Network retry attempts remaining:', networkRetries);

    try {
      // GUARD: Ensure we're running client-side only
      if (typeof window === 'undefined') {
        console.warn('⚠️ fetchUserProfile called server-side! Aborting.');
        console.warn('This function should only run in the browser.');
        console.groupEnd();
        return null;
      }

      console.log('✅ Client-side execution confirmed');

      // STEP 1: Get current session with detailed logging
      console.group('📡 Step 1: Getting Session');
      const sessionStart = Date.now();
      const sessionResult = await supabase.auth.getSession();
      const sessionDuration = Date.now() - sessionStart;

      console.log('getSession() duration:', `${sessionDuration}ms`);
      console.log('Session result data:', !!sessionResult.data);
      console.log('Session result error:', sessionResult.error ?? 'none');

      logSessionDetails(sessionResult.data?.session);
      console.groupEnd();

      // STEP 2: Get current user with detailed logging
      console.group('📡 Step 2: Getting User');
      const userStart = Date.now();
      const userResult = await supabase.auth.getUser();
      const userDuration = Date.now() - userStart;

      console.log('getUser() duration:', `${userDuration}ms`);
      console.log('User result data:', !!userResult.data);
      console.log('User result error:', userResult.error ?? 'none');

      logUserDetails(userResult.data?.user);
      console.groupEnd();

      // STEP 3: Validate we have necessary auth data
      const session = sessionResult.data?.session;
      const currentUser = userResult.data?.user;

      if (!session || !currentUser || !currentUser.id) {
        console.warn('⚠️ No valid session or user found');
        console.warn('Session exists:', !!session);
        console.warn('User exists:', !!currentUser);
        console.warn('User ID:', currentUser?.id ?? 'N/A');
        console.groupEnd();
        return null;
      }

      console.log('✅ Valid session and user confirmed');

      // STEP 4: Construct REST URL for debugging
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'unknown';
      const restUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${currentUser.id}&select=*`;

      console.group('🌐 Step 3: Profile Query Details');
      console.log('Target user ID:', currentUser.id);
      console.log('Constructed REST URL:', restUrl);
      console.log('Authorization header (masked):', `Bearer ${maskToken(session.access_token)}`);
      console.log('apikey header (masked):', maskToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
      console.groupEnd();

      // STEP 5: Execute profile query
      console.group('📊 Step 4: Executing Profile Query');
      const queryStart = Date.now();

      const { data: profile, error, status } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      const queryDuration = Date.now() - queryStart;

      // Log response immediately and safely
      console.log('Query duration:', `${queryDuration}ms`);
      console.log('Response status:', status ?? 'N/A');
      console.log('Data received:', !!profile);
      console.log('Error received:', !!error);

      // Safe logging of profile data (avoid logging sensitive info in production)
      if (profile) {
        console.log('Profile data:', {
          id: profile.id ?? 'N/A',
          username: profile.username ?? 'N/A',
          has_wallet: !!profile.wallet_address,
          has_full_name: !!profile.full_name,
          has_avatar: !!profile.avatar_url,
        });
      }

      // Safe logging of error
      if (error) {
        safeLogSupabaseError('Profile Query', error);
      }

      console.groupEnd();

      // STEP 6: Handle errors with retry logic
      if (error) {
        const errorCode = (error as any)?.code ?? null;
        const errorMessage = (error as any)?.message ?? 'Unknown error';

        // Retry for PGRST116 (no rows) - race condition after signup
        if (errorCode === 'PGRST116' && retries > 0) {
          console.log(`🔄 PGRST116 detected: Profile not found yet`);
          console.log(`Retrying in ${delay}ms... (${retries} retries left)`);
          console.groupEnd(); // Close main group before retry
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchUserProfile(authUser, retries - 1, delay * 1.5, networkRetries);
        }

        // For other errors, log and return null
        console.error('❌ Profile query failed:', errorMessage);
        console.groupEnd();
        return null;
      }

      // STEP 7: Success - construct User object
      if (!profile) {
        console.warn('⚠️ Query succeeded but no profile data returned');
        console.groupEnd();
        return null;
      }

      const userProfile: User = {
        id: currentUser.id,
        email: currentUser.email || '',
        username: profile.username || '',
        wallet_address: profile.wallet_address,  // Legacy field
        wallet_pubkeys: profile.wallet_pubkeys,  // New field for Phantom wallet
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      };

      const totalDuration = Date.now() - startTime;
      console.log('✅ Profile fetched successfully');
      console.log('Total duration:', `${totalDuration}ms`);
      console.groupEnd();

      return userProfile;

    } catch (error) {
      // STEP 8: Handle unexpected exceptions (network errors, etc.)
      console.group('⚠️ Exception Caught in fetchUserProfile');
      console.error('Exception type:', error?.constructor?.name ?? 'Unknown');
      console.error('Exception message:', error instanceof Error ? error.message : 'Unknown');
      console.error('Exception stack:', error instanceof Error ? error.stack : 'N/A');

      safeLogSupabaseError('fetchUserProfile - unexpected exception', error);

      // Retry once for network errors
      if (networkRetries > 0) {
        console.log('🔄 Network error detected, retrying once after 250ms...');
        console.groupEnd();
        await new Promise(resolve => setTimeout(resolve, 250));
        return fetchUserProfile(authUser, retries, delay, 0); // No more network retries
      }

      console.error('❌ Failed after retries');
      console.groupEnd();
      console.groupEnd(); // Close main group
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      if (DEBUG_MODE) {
        console.group('🚀 AuthProvider Initialization');
        console.log('Environment:', typeof window !== 'undefined' ? 'Browser' : 'Server');
        console.log('Debug mode:', DEBUG_MODE);
        console.log('Supabase client:', supabase ? 'initialized (singleton)' : 'null');
      }

      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (DEBUG_MODE) {
          console.log('Initial session check:', !!session);
        }

        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user);
          setUser(userProfile);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
        if (DEBUG_MODE) {
          console.groupEnd();
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (DEBUG_MODE) {
          console.log('🔔 Auth state changed:', event);
        }

        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user);
          setUser(userProfile);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // supabase is stable (useMemo), but included for completeness
    // fetchUserProfile is stable (defined inline), eslint-disable if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const login = async (email: string, password: string): Promise<void> => {
    console.debug('🔐 Login attempt for:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      safeLogSupabaseError('login', error);
      throw error;
    }

    if (data.user) {
      console.debug('✅ Supabase auth successful, fetching profile...');
      const userProfile = await fetchUserProfile(data.user);
      setUser(userProfile);
      console.debug('✅ User state updated:', userProfile ? userProfile.username : 'null');
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string
  ): Promise<{ requiresEmailConfirmation: boolean }> => {
    console.debug('📝 Registration attempt for:', { email, username });

    // First check if username is already taken
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    // If we got data back, username is taken
    if (existingProfile) {
      console.warn('⚠️ Username already taken:', username);
      throw new Error('Username already in use');
    }

    // If error is not PGRST116 (no rows found), it's a real error
    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('❌ Error checking username availability:', profileCheckError.message);
      safeLogSupabaseError('username check', profileCheckError);
      throw new Error('Error checking username availability');
    }

    console.debug('✅ Username available, creating account...');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) {
      console.error('❌ Registration failed:', error.message);
      safeLogSupabaseError('register', error);

      // Provide user-friendly error messages for common cases
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes('already registered') ||
          errorMessage.includes('already been registered') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('unique constraint') && errorMessage.includes('email')) {
        throw new Error('Email already registered');
      }

      // For other errors, use the original error message
      throw error;
    }

    // Check if we have a session (email confirmation disabled) or need email confirmation
    if (!data.session) {
      console.debug('⚠️ No session created - email confirmation required');
      return { requiresEmailConfirmation: true };
    }

    if (data.user && data.session) {
      console.debug('✅ Supabase signup successful with immediate session, fetching profile...');
      // Use retry logic for post-registration profile fetch
      // The database trigger may not have created the profile yet
      const userProfile = await fetchUserProfile(data.user);
      setUser(userProfile);
      console.debug('✅ User state updated after registration:', userProfile ? userProfile.username : 'null');
    }

    return { requiresEmailConfirmation: false };
  };

  const logout = async (): Promise<void> => {
    // Disconnect Phantom wallet if connected
    try {
      if (typeof window !== 'undefined') {
        const provider = (window as any).phantom?.solana || (window as any).solana;
        if (provider && provider.isConnected) {
          await provider.disconnect();
          console.debug('✅ Phantom wallet disconnected');
        }
      }
    } catch (walletError) {
      console.warn('⚠️ Failed to disconnect wallet:', walletError);
      // Continue with logout even if wallet disconnect fails
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      safeLogSupabaseError('logout', error);
      throw error;
    }
    setUser(null);
  };

  const linkWallet = async (walletAddress: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be logged in to link wallet');
    }

    // Update both wallet_address (legacy) and wallet_pubkeys (Phantom)
    const { error } = await supabase
      .from('profiles')
      .update({
        wallet_address: walletAddress,  // Keep for backward compatibility
        wallet_pubkeys: walletAddress   // New field for Phantom wallet
      })
      .eq('id', user.id);

    if (error) {
      safeLogSupabaseError('linkWallet', error);
      throw error;
    }

    setUser({ ...user, wallet_address: walletAddress, wallet_pubkeys: walletAddress });
  };

  const unlinkWallet = async (): Promise<void> => {
    if (!user) {
      throw new Error('User must be logged in to unlink wallet');
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        wallet_address: null,
        wallet_pubkeys: null
      })
      .eq('id', user.id);

    if (error) {
      safeLogSupabaseError('unlinkWallet', error);
      throw error;
    }

    setUser({ ...user, wallet_address: undefined, wallet_pubkeys: undefined });
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    if (!user) {
      throw new Error('User must be logged in to update profile');
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      safeLogSupabaseError('updateProfile', error);
      throw error;
    }

    setUser({ ...user, ...updates });
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    linkWallet,
    unlinkWallet,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
