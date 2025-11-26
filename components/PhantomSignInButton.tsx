"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseWeb3Auth } from '@/hooks/useSupabaseWeb3Auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Phantom Wallet Sign-In Button (Supabase Web3 Auth)
 *
 * Uses Supabase's native signInWithWeb3() for authentication.
 * Much simpler than custom nonce/signature verification!
 *
 * Features:
 * - One-click sign-in with Phantom wallet
 * - Automatic profile creation with wallet address
 * - Progress states and error handling
 * - Works for both new users and returning users
 *
 * Usage:
 * ```tsx
 * <PhantomSignInButton onSuccess={() => router.push('/dashboard')} />
 * ```
 */

interface PhantomSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
}

export function PhantomSignInButton({
  onSuccess,
  onError,
  className,
  variant = 'default',
  size = 'default',
}: PhantomSignInButtonProps) {
  const router = useRouter();
  const {
    signInWithPhantom,
    isLoading,
    isConnecting,
    isSigning,
    error,
    clearError,
    isPhantomInstalled,
  } = useSupabaseWeb3Auth();

  /**
   * Get current status message based on loading state
   */
  const getStatusMessage = (): string => {
    if (isConnecting) return 'Connecting to Phantom...';
    if (isSigning) return 'Waiting for signature...';
    return 'Sign in with Phantom';
  };

  /**
   * Handle wallet sign-in flow
   */
  const handleSignIn = async () => {
    try {
      clearError();

      // Check if Phantom is installed
      if (!isPhantomInstalled()) {
        const error = new Error(
          'Phantom wallet is not installed. Please install it from https://phantom.app/'
        );
        onError?.(error);
        toast.error('Phantom wallet not installed', {
          description: 'Please install Phantom from phantom.app',
        });
        return;
      }

      // Execute sign-in flow using Supabase Web3 auth
      const result = await signInWithPhantom();

      if (result?.user) {
        // Check if this is a new user
        const isNewUser = result.user.created_at === result.user.last_sign_in_at;

        toast.success(
          isNewUser ? 'Account created successfully!' : 'Welcome back!',
          {
            description: `Signed in with ${result.user.identities?.[0]?.identity_data?.sub?.slice(0, 8)}...`,
          }
        );

        // Call success callback
        onSuccess?.();

        // Refresh the page to update auth state
        router.refresh();
      }
    } catch (err: any) {
      console.error('Phantom sign-in error:', err);
      onError?.(err);
      toast.error('Sign-in failed', {
        description: err.message || 'Please try again',
      });
    }
  };

  return (
    <div className={className}>
      <Button
        onClick={handleSignIn}
        disabled={isLoading}
        variant={variant}
        size={size}
        className="w-full"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{getStatusMessage()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <PhantomIcon />
            <span>Sign in with Phantom</span>
          </div>
        )}
      </Button>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Phantom logo icon component
 */
function PhantomIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M102.3 49.6c-3.6-24.3-23-37.3-42.4-37.3-33.4 0-50.8 26.3-50.8 58.5 0 18.5 11.5 44.1 28.3 44.1 7.4 0 14.5-6.8 18.1-15.8 1.1-2.7 3.4-4.5 6.3-4.5 4.1 0 6.8 3.4 6.8 7.4 0 11.5-13.5 25.7-31.2 25.7C15.5 127.7 0 99.1 0 70.8 0 31.9 24.8 0 63.9 0c26.6 0 49 15.4 54.2 45.6 1.1 6.3-3.8 11.5-10.2 11.5-4.5 0-8.5-3.2-9.4-7.5l3.8.1z"
        fill="currentColor"
      />
      <ellipse cx="47.3" cy="55.6" rx="7" ry="11.5" fill="currentColor" />
      <ellipse cx="81.3" cy="55.6" rx="7" ry="11.5" fill="currentColor" />
    </svg>
  );
}
