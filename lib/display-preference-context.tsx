"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type DisplayMode = 'price' | 'marketcap';

interface DisplayPreferenceContextType {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  toggleDisplayMode: () => void;
  isLoading: boolean;
}

const DisplayPreferenceContext = createContext<DisplayPreferenceContextType | undefined>(undefined);

const STORAGE_KEY = 'display_preference';

export function DisplayPreferenceProvider({ children }: { children: ReactNode }) {
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('price');
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load preference from localStorage first, then sync with Supabase if logged in
  useEffect(() => {
    const loadPreference = async () => {
      setIsLoading(true);

      // First, check localStorage for immediate UI response
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'price' || stored === 'marketcap') {
          setDisplayModeState(stored);
        }
      }

      // Then check if user is logged in and has a saved preference
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUserId(session.user.id);

          // Fetch user's saved preference from profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_preference')
            .eq('id', session.user.id)
            .single();

          if (profile?.display_preference === 'price' || profile?.display_preference === 'marketcap') {
            setDisplayModeState(profile.display_preference);
            // Sync localStorage with DB preference
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, profile.display_preference);
            }
          }
        }
      } catch (error) {
        console.error('Error loading display preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreference();

    // Listen for auth changes
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          // Load preference when user logs in
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_preference')
            .eq('id', session.user.id)
            .single();

          if (profile?.display_preference === 'price' || profile?.display_preference === 'marketcap') {
            setDisplayModeState(profile.display_preference);
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, profile.display_preference);
            }
          }
        } else {
          setUserId(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setDisplayMode = useCallback(async (mode: DisplayMode) => {
    setDisplayModeState(mode);

    // Save to localStorage immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }

    // If user is logged in, save to Supabase
    if (userId) {
      try {
        const supabase = createClient();
        await supabase
          .from('profiles')
          .update({ display_preference: mode })
          .eq('id', userId);
      } catch (error) {
        console.error('Error saving display preference:', error);
      }
    }
  }, [userId]);

  const toggleDisplayMode = useCallback(() => {
    const newMode = displayMode === 'price' ? 'marketcap' : 'price';
    setDisplayMode(newMode);
  }, [displayMode, setDisplayMode]);

  const value: DisplayPreferenceContextType = {
    displayMode,
    setDisplayMode,
    toggleDisplayMode,
    isLoading,
  };

  return (
    <DisplayPreferenceContext.Provider value={value}>
      {children}
    </DisplayPreferenceContext.Provider>
  );
}

export function useDisplayPreference() {
  const context = useContext(DisplayPreferenceContext);
  if (context === undefined) {
    throw new Error('useDisplayPreference must be used within a DisplayPreferenceProvider');
  }
  return context;
}
