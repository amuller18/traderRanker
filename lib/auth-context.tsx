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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Fetch user profile from Supabase
  const fetchUserProfile = async (authUser: SupabaseUser, retries = 3): Promise<User | null> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        // Check if the profiles table doesn't exist
        if (error.code === 'PGRST116' || error.message.includes('relation "public.profiles" does not exist')) {
          console.error('❌ Database schema not set up! Please run the SQL schema in Supabase.');
          console.error('📝 Instructions: Check AUTH_SETUP_COMPLETE.md for setup steps.');
          throw new Error('Database schema not set up. Please run the SQL schema in Supabase (see AUTH_SETUP_COMPLETE.md)');
        }

        // If profile not found and we have retries left, wait and retry
        // (profile might still be creating from the trigger)
        if (error.code === 'PGRST116' && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchUserProfile(authUser, retries - 1);
        }

        console.error('Error fetching profile:', error);
        return null;
      }

      return {
        id: authUser.id,
        email: authUser.email || '',
        username: profile?.username || authUser.user_metadata?.username || '',
        wallet_address: profile?.wallet_address,
        full_name: profile?.full_name,
        avatar_url: profile?.avatar_url,
      };
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      throw error;
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
      try {
        const userProfile = await fetchUserProfile(data.user);
        setUser(userProfile);
      } catch (error: any) {
        // If profile fetch fails, still set basic user info from auth
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          username: data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'User',
        });
        // Re-throw to show the error to the user
        throw error;
      }
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string
  ): Promise<void> => {
    try {
      // First check if username is already taken
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingProfile) {
        throw new Error('Username is already taken');
      }
    } catch (error: any) {
      // If the table doesn't exist, we'll catch it later when trying to fetch profile
      // If it's a "not found" error, that's good - username is available
      if (error?.code !== 'PGRST116') {
        // Re-throw if it's actually a "username taken" error
        if (error?.message === 'Username is already taken') {
          throw error;
        }
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username, // Save username as display name in Supabase Auth
          full_name: username, // Also save as full_name
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const userProfile = await fetchUserProfile(data.user);
        setUser(userProfile);
      } catch (error: any) {
        // If profile fetch fails, still set basic user info from auth
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          username: username,
        });
        // Re-throw to show the error to the user
        throw error;
      }
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
