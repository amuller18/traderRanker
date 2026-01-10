"use client";

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phantom wallet authentication hook for Next.js
 *
 * Provides functions to:
 * - Connect to Phantom wallet
 * - Request authentication nonce
 * - Sign nonce with wallet
 * - Verify signature and sign in / create account
 * - Link wallet to existing account
 *
 * Usage:
 * ```tsx
 * const { connectWallet, signInWithWallet, isConnecting, error } = usePhantomAuth()
 *
 * const handleSignIn = async () => {
 *   try {
 *     const result = await signInWithWallet()
 *     if (result.created_new_user) {
 *       // Show onboarding flow
 *     }
 *   } catch (err) {
 *     console.error(err)
 *   }
 * }
 * ```
 */

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  isConnected?: boolean;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on(event: string, callback: () => void): void;
}

interface Window {
  phantom?: {
    solana?: PhantomProvider;
  };
  solana?: PhantomProvider;
}

declare const window: Window;

interface NonceResponse {
  nonce: string;
  expires_at: string;
  message?: string;
}

interface VerifyResponse {
  status: string;
  created_new_user: boolean;
  linked_to_existing_session: boolean;
  user_id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  access_token?: string;
  refresh_token?: string;
  message?: string;
}

interface PhantomAuthState {
  isConnecting: boolean;
  isSigning: boolean;
  isVerifying: boolean;
  error: string | null;
  publicKey: string | null;
}

export function usePhantomAuth() {
  const [state, setState] = useState<PhantomAuthState>({
    isConnecting: false,
    isSigning: false,
    isVerifying: false,
    error: null,
    publicKey: null,
  });

  /**
   * Check if Phantom wallet is installed
   */
  const isPhantomInstalled = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    // Check both window.phantom.solana and window.solana (legacy)
    return !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom);
  }, []);

  /**
   * Get Phantom provider
   */
  const getProvider = useCallback((): PhantomProvider | null => {
    if (typeof window === 'undefined') return null;
    // Try window.phantom.solana first, then fallback to window.solana
    const provider = window.phantom?.solana || window.solana;
    if (!provider?.isPhantom) return null;
    return provider;
  }, []);

  /**
   * Connect to Phantom wallet and return public key
   */
  const connectWallet = useCallback(async (): Promise<string> => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (!isPhantomInstalled()) {
        throw new Error(
          'Phantom wallet is not installed. Please install it from https://phantom.app/'
        );
      }

      const provider = getProvider();
      if (!provider) {
        throw new Error('Failed to get Phantom provider');
      }

      // Connect to wallet (triggers Phantom popup)
      const response = await provider.connect();
      const publicKey = response.publicKey.toString();

      setState(prev => ({
        ...prev,
        isConnecting: false,
        publicKey,
      }));

      return publicKey;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to connect to Phantom wallet';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, [isPhantomInstalled, getProvider]);

  /**
   * Request a nonce from the backend
   */
  const requestNonce = useCallback(async (publicKey: string): Promise<NonceResponse> => {
    try {
      // Use API_URL from environment or default to relative path
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/auth/wallet/nonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_key: publicKey }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to request nonce';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = `Failed to request nonce: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to request nonce from server');
    }
  }, []);

  /**
   * Sign a message (nonce) with Phantom wallet
   */
  const signNonce = useCallback(async (nonce: string): Promise<string> => {
    setState(prev => ({ ...prev, isSigning: true, error: null }));

    try {
      const provider = getProvider();
      if (!provider) {
        throw new Error('Phantom wallet not connected');
      }

      // Encode the nonce as Uint8Array (UTF-8)
      const encodedMessage = new TextEncoder().encode(nonce);

      // Sign the message with Phantom
      // Phantom returns { signature: Uint8Array }
      const { signature } = await provider.signMessage(encodedMessage, 'utf8');

      // Convert signature to base64
      const signatureBase64 = btoa(String.fromCharCode(...signature));

      setState(prev => ({ ...prev, isSigning: false }));

      return signatureBase64;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to sign message with Phantom';
      setState(prev => ({
        ...prev,
        isSigning: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, [getProvider]);

  /**
   * Verify signature with backend and sign in / create account
   */
  const verifyAndSignIn = useCallback(async (
    publicKey: string,
    signature: string,
    nonce: string
  ): Promise<VerifyResponse> => {
    setState(prev => ({ ...prev, isVerifying: true, error: null }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/auth/wallet/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key: publicKey,
          signature,
          nonce,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Signature verification failed';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = `Signature verification failed: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result: VerifyResponse = await response.json();

      // Set Supabase session with the returned tokens
      if (result.access_token && result.refresh_token) {
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });

        // Wait for the session to be fully set and auth context to update
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setState(prev => ({ ...prev, isVerifying: false }));

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to verify signature';
      setState(prev => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, []);

  /**
   * Complete sign-in flow: connect → request nonce → sign → verify
   */
  const signInWithWallet = useCallback(async (): Promise<VerifyResponse> => {
    try {
      // Step 1: Connect to wallet
      const publicKey = await connectWallet();

      // Step 2: Request nonce
      const { nonce } = await requestNonce(publicKey);

      // Step 3: Sign nonce
      const signature = await signNonce(nonce);

      // Step 4: Verify and sign in
      const result = await verifyAndSignIn(publicKey, signature, nonce);

      return result;
    } catch (error: any) {
      throw error; // Re-throw to let caller handle
    }
  }, [connectWallet, requestNonce, signNonce, verifyAndSignIn]);

  /**
   * Link wallet to existing authenticated user
   * Returns the linked wallet public key on success
   */
  const linkWalletIfLoggedIn = useCallback(async (): Promise<{ public_key: string; is_primary: boolean }> => {
    try {
      // Step 1: Connect to wallet
      const publicKey = await connectWallet();

      // Step 2: Request nonce
      const { nonce } = await requestNonce(publicKey);

      // Step 3: Sign nonce
      const signature = await signNonce(nonce);

      // Step 4: Link wallet via API
      setState(prev => ({ ...prev, isVerifying: true, error: null }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/auth/wallet/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: include cookies for auth
        body: JSON.stringify({
          public_key: publicKey,
          signature,
          nonce,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to link wallet';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch {
          errorMessage = `Failed to link wallet: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      setState(prev => ({ ...prev, isVerifying: false }));

      return {
        public_key: result.public_key,
        is_primary: result.is_primary
      };
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to link wallet';
      setState(prev => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, [connectWallet, requestNonce, signNonce]);

  /**
   * Disconnect wallet
   */
  const disconnectWallet = useCallback(async (): Promise<void> => {
    try {
      const provider = getProvider();
      if (provider?.disconnect) {
        await provider.disconnect();
      }
      setState(prev => ({ ...prev, publicKey: null }));
    } catch (error: any) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [getProvider]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    isConnecting: state.isConnecting,
    isSigning: state.isSigning,
    isVerifying: state.isVerifying,
    isLoading: state.isConnecting || state.isSigning || state.isVerifying,
    error: state.error,
    publicKey: state.publicKey,

    // Functions
    isPhantomInstalled,
    connectWallet,
    requestNonce,
    signNonce,
    verifyAndSignIn,
    signInWithWallet,
    linkWalletIfLoggedIn,
    disconnectWallet,
    clearError,
  };
}
