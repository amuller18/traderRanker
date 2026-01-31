"use client";

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Supabase Web3 Authentication Hook
 *
 * Uses Supabase's native signInWithWeb3() method for Solana/Phantom wallet authentication.
 * This is much simpler than custom nonce/signature verification!
 *
 * Documentation: https://supabase.com/docs/guides/auth/auth-web3
 *
 * Usage:
 * ```tsx
 * const { signInWithPhantom, isLoading, error } = useSupabaseWeb3Auth();
 *
 * const handleSignIn = async () => {
 *   const result = await signInWithPhantom();
 *   if (result) {
 *     console.log('Signed in:', result.user);
 *   }
 * };
 * ```
 */

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  isConnected?: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage?(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  on(event: string, callback: () => void): void;
}

interface Window {
  phantom?: {
    solana?: PhantomProvider;
  };
  solana?: PhantomProvider;
}

declare const window: Window;

interface Web3AuthState {
  isLoading: boolean;
  isConnecting: boolean;
  isSigning: boolean;
  error: string | null;
  publicKey: string | null;
}

export function useSupabaseWeb3Auth() {
  const [state, setState] = useState<Web3AuthState>({
    isLoading: false,
    isConnecting: false,
    isSigning: false,
    error: null,
    publicKey: null,
  });

  const supabase = createClient();

  /**
   * Check if Phantom wallet is installed
   */
  const isPhantomInstalled = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom);
  }, []);

  /**
   * Get Phantom provider
   */
  const getPhantomProvider = useCallback((): PhantomProvider | null => {
    if (typeof window === 'undefined') return null;
    // Try window.phantom.solana first, then fallback to window.solana
    return window.phantom?.solana || window.solana || null;
  }, []);

  /**
   * Sign in with Phantom wallet using Supabase's native Web3 auth
   */
  const signInWithPhantom = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      isConnecting: true,
      error: null,
    }));

    try {
      // Check if Phantom is installed
      if (!isPhantomInstalled()) {
        throw new Error(
          'Phantom wallet is not installed. Please install it from https://phantom.app/'
        );
      }

      const provider = getPhantomProvider();
      if (!provider) {
        throw new Error('Failed to get Phantom provider');
      }

      setState(prev => ({ ...prev, isConnecting: false, isSigning: true }));

      // Use Supabase's native signInWithWeb3 method
      // This handles the nonce generation, signing, and verification automatically!
      // Note: signInWithWeb3 may not be available in all Supabase versions
      // Use the custom auth flow in /api/auth/wallet/* for production
      const { data, error } = await (supabase.auth as any).signInWithWeb3({
        chain: 'solana',
        statement: 'Sign in to TraderRanker with your Phantom wallet',
        wallet: provider,  // Pass the Phantom provider
      });

      if (error) {
        throw error;
      }

      // Extract the wallet address from the identity
      const walletAddress = data?.user?.identities?.[0]?.identity_data?.sub;

      setState(prev => ({
        ...prev,
        isLoading: false,
        isSigning: false,
        publicKey: walletAddress || null,
      }));

      return data;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to sign in with Phantom wallet';
      setState(prev => ({
        ...prev,
        isLoading: false,
        isConnecting: false,
        isSigning: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, [isPhantomInstalled, getPhantomProvider, supabase.auth]);

  /**
   * Link Phantom wallet to existing authenticated user
   */
  const linkPhantomWallet = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      // Check if Phantom is installed
      if (!isPhantomInstalled()) {
        throw new Error('Phantom wallet is not installed');
      }

      const provider = getPhantomProvider();
      if (!provider) {
        throw new Error('Failed to get Phantom provider');
      }

      // Check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to link a wallet');
      }

      // Use Supabase's linkIdentity method to link Web3 wallet
      // Note: Web3 identity linking may not be available in all Supabase versions
      // Use the custom auth flow in /api/auth/wallet/link for production
      const { data, error } = await (supabase.auth.linkIdentity as any)({
        provider: 'web3',
        options: {
          chain: 'solana',
          statement: 'Link your Phantom wallet to your TraderRanker account',
          wallet: provider,
        },
      });

      if (error) {
        throw error;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
      }));

      return data;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to link Phantom wallet';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, [isPhantomInstalled, getPhantomProvider, supabase.auth]);

  /**
   * Unlink Web3 wallet from user account
   */
  const unlinkPhantomWallet = useCallback(async (identityId: string) => {
    try {
      // Note: Web3 identity unlinking may not be available in all Supabase versions
      // Use the custom auth flow in /api/auth/wallet/unlink for production
      const { error } = await (supabase.auth.unlinkIdentity as any)({
        provider: 'web3',
        identity_id: identityId,
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to unlink wallet';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw new Error(errorMessage);
    }
  }, [supabase.auth]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    isLoading: state.isLoading,
    isConnecting: state.isConnecting,
    isSigning: state.isSigning,
    error: state.error,
    publicKey: state.publicKey,

    // Functions
    isPhantomInstalled,
    signInWithPhantom,
    linkPhantomWallet,
    unlinkPhantomWallet,
    clearError,
  };
}
