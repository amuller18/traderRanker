"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  wallet_address?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  wallet_address?: string;
  full_name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  linkWallet: (walletAddress: string) => Promise<void>;
  unlinkWallet: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Safely logs Supabase errors without causing runtime exceptions.
 * Guards against null/undefined error objects and safely accesses properties.
 *
 * @param context - Description of where the error occurred (e.g., 'fetchUserProfile')
 * @param err - The error object from Supabase (can be null, undefined, or any shape)
 */
function safeLogSupabaseError(context: string, err: unknown): void {
  // Always log the raw error first to avoid losing information
  console.error(`${context} - Supabase error (raw):`, err);

  // Guard: If error is null, undefined, or not an object, we can't safely access properties
  if (!err || typeof err !== 'object') {
    console.error(`${context} - Error is not an object, skipping property access`);
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
  };

  console.error(`${context} - Supabase error (safe):`, safeError);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  /**
   * Fetches user profile from Supabase with retry logic for race conditions.
   *
   * Race condition handling: After user registration, the database trigger creates
   * a profile row asynchronously. If we query too quickly, we get PGRST116 (no rows).
   * We retry with exponential backoff to handle this gracefully.
   *
   * @param authUser - The authenticated Supabase user object
   * @param retries - Number of retry attempts remaining (default: 3)
   * @param delay - Delay in milliseconds before retrying (default: 1000ms)
   * @returns User profile object or null if not found/error occurred
   */
  const fetchUserProfile = async (
    authUser: SupabaseUser,
    retries = 3,
    delay = 1000
  ): Promise<User | null> => {
    try {
      // Query the profiles table for this user's profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        // Use safe error logging to avoid runtime exceptions from null/undefined errors
        safeLogSupabaseError('fetchUserProfile', error);

        // Handle race condition: profile not created yet after signup
        // PGRST116 = PostgreSQL REST API error code for "no rows returned"
        // We need to safely check error.code since error might not have this property
        const errorCode = (error as any)?.code ?? null;
        if (errorCode === 'PGRST116' && retries > 0) {
          console.log(`Profile not found, retrying in ${delay}ms... (${retries} retries left)`);
          // Exponential backoff: wait, then retry with longer delay
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchUserProfile(authUser, retries - 1, delay * 1.5);
        }

        // Other errors or out of retries - return null
        return null;
      }

      // Successfully fetched profile - construct User object
      return {
        id: authUser.id,
        email: authUser.email || '',
        username: profile?.username || '',
        wallet_address: profile?.wallet_address,
        full_name: profile?.full_name,
        avatar_url: profile?.avatar_url,
      };
    } catch (error) {
      // Catch any unexpected exceptions (network errors, etc.)
      safeLogSupabaseError('fetchUserProfile - unexpected exception', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user);
          setUser(userProfile);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
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
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      const userProfile = await fetchUserProfile(data.user);
      setUser(userProfile);
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string
  ): Promise<void> => {
    // First check if username is already taken
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingProfile) {
      throw new Error('Username is already taken');
    }

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
      throw error;
    }

    if (data.user) {
      const userProfile = await fetchUserProfile(data.user);
      setUser(userProfile);
    }
  };

  const logout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setUser(null);
  };

  const linkWallet = async (walletAddress: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be logged in to link wallet');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ wallet_address: walletAddress })
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    setUser({ ...user, wallet_address: walletAddress });
  };

  const unlinkWallet = async (): Promise<void> => {
    if (!user) {
      throw new Error('User must be logged in to unlink wallet');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ wallet_address: null })
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    setUser({ ...user, wallet_address: undefined });
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
