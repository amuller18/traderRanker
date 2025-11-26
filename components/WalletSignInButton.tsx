"use client";

import React, { useState } from 'react';
import { usePhantomAuth } from '@/hooks/usePhantomAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Phantom Wallet Sign-In Button Component
 *
 * Features:
 * - Connect to Phantom wallet
 * - Sign authentication challenge
 * - Create new account or sign in
 * - Show onboarding modal for new users
 * - Display progress states and error messages
 *
 * Usage:
 * ```tsx
 * <WalletSignInButton onSuccess={(user) => console.log('Signed in:', user)} />
 * ```
 */

interface WalletSignInButtonProps {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}

export function WalletSignInButton({
  onSuccess,
  onError,
  className,
  variant = 'default',
}: WalletSignInButtonProps) {
  const {
    signInWithWallet,
    isLoading,
    isConnecting,
    isSigning,
    isVerifying,
    error,
    clearError,
    isPhantomInstalled,
  } = usePhantomAuth();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [signInResult, setSignInResult] = useState<any>(null);
  const [profileData, setProfileData] = useState({
    email: '',
    displayName: '',
  });

  /**
   * Get current status message based on loading state
   */
  const getStatusMessage = (): string => {
    if (isConnecting) return 'Connecting to Phantom...';
    if (isSigning) return 'Waiting for signature...';
    if (isVerifying) return 'Verifying signature...';
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
        return;
      }

      // Execute sign-in flow
      const result = await signInWithWallet();

      setSignInResult(result);

      // If new user, show onboarding modal
      if (result.created_new_user) {
        setShowOnboarding(true);
      } else {
        // Existing user - call success callback
        onSuccess?.(result);
      }
    } catch (err: any) {
      console.error('Wallet sign-in error:', err);
      onError?.(err);
    }
  };

  /**
   * Complete onboarding and update user profile
   */
  const handleCompleteOnboarding = async () => {
    try {
      // TODO: Call backend API to update user profile
      // For now, just close modal and call success
      setShowOnboarding(false);
      onSuccess?.(signInResult);
    } catch (err: any) {
      console.error('Profile update error:', err);
      onError?.(err);
    }
  };

  /**
   * Skip onboarding
   */
  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
    onSuccess?.(signInResult);
  };

  return (
    <>
      {/* Sign-In Button */}
      <div className={className}>
        <Button
          onClick={handleSignIn}
          disabled={isLoading}
          variant={variant}
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

      {/* Onboarding Modal for New Users */}
      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome! Complete Your Profile</DialogTitle>
            <DialogDescription>
              Your Phantom wallet has been connected successfully. You can optionally
              add an email and display name to complete your profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={profileData.email}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            {/* Display Name Input */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your Name"
                value={profileData.displayName}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, displayName: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSkipOnboarding}
              className="flex-1"
            >
              Skip for now
            </Button>
            <Button onClick={handleCompleteOnboarding} className="flex-1">
              Complete Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
