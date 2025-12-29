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
    return window.phantom?.solana?.isPhantom === true;
  }, []);

  /**
   * Get Phantom provider
   */
  const getProvider = useCallback((): PhantomProvider | null => {
    if (typeof window === 'undefined') return null;
    if (!window.phantom?.solana?.isPhantom) return null;
    return window.phantom.solana;
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
        const error = await response.json();
        throw new Error(error.detail || 'Failed to request nonce');
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
        const error = await response.json();
        throw new Error(error.detail || 'Signature verification failed');
      }

      const result: VerifyResponse = await response.json();

      // Set Supabase session with the returned tokens
      if (result.access_token && result.refresh_token) {
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
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
   */
  const linkWalletIfLoggedIn = useCallback(async (): Promise<void> => {
    // TODO: Implement wallet linking flow
    // This requires passing the authentication token to the /link endpoint
    throw new Error('Wallet linking not yet implemented');
  }, []);

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
