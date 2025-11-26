"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Linked Wallets List Component
 *
 * Displays all wallets linked to the current user's account and allows unlinking.
 *
 * Features:
 * - Fetch and display linked wallets
 * - Mark primary wallet
 * - Unlink wallets with confirmation
 * - Prevent unlinking last wallet (safeguard)
 *
 * Usage:
 * ```tsx
 * <LinkedWalletsList userId="user-id-123" />
 * ```
 */

interface Wallet {
  id: string;
  public_key: string;
  is_primary: boolean;
  created_at: string;
  last_used_at: string;
}

interface LinkedWalletsListProps {
  userId?: string;
  onWalletUnlinked?: () => void;
}

export function LinkedWalletsList({ userId, onWalletUnlinked }: LinkedWalletsListProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletToUnlink, setWalletToUnlink] = useState<Wallet | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  /**
   * Fetch linked wallets from backend
   */
  useEffect(() => {
    async function fetchWallets() {
      try {
        setIsLoading(true);
        setError(null);

        // TODO: Replace with actual API call to fetch user's wallets
        // For now, return mock data
        // const response = await fetch(`/api/auth/wallet/list?user_id=${userId}`)
        // const data = await response.json()

        // Mock data for demonstration
        const mockWallets: Wallet[] = [
          // {
          //   id: '1',
          //   public_key: '7fXi...abc123',
          //   is_primary: true,
          //   created_at: new Date().toISOString(),
          //   last_used_at: new Date().toISOString(),
          // },
        ];

        setWallets(mockWallets);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch wallets');
      } finally {
        setIsLoading(false);
      }
    }

    fetchWallets();
  }, [userId]);

  /**
   * Handle wallet unlinking
   */
  const handleUnlinkWallet = async (wallet: Wallet) => {
    // Prevent unlinking if it's the last wallet
    if (wallets.length === 1) {
      setError('Cannot unlink your last wallet. Please link another wallet first.');
      return;
    }

    setWalletToUnlink(wallet);
  };

  /**
   * Confirm and execute wallet unlinking
   */
  const confirmUnlink = async () => {
    if (!walletToUnlink) return;

    try {
      setIsUnlinking(true);
      setError(null);

      // TODO: Call backend API to unlink wallet
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/auth/wallet/unlink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
          // 'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          public_key: walletToUnlink.public_key,
          confirm: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unlink wallet');
      }

      // Remove wallet from list
      setWallets((prev) => prev.filter((w) => w.id !== walletToUnlink.id));

      // Call callback
      onWalletUnlinked?.();

      setWalletToUnlink(null);
    } catch (err: any) {
      setError(err.message || 'Failed to unlink wallet');
    } finally {
      setIsUnlinking(false);
    }
  };

  /**
   * Format public key for display (truncate middle)
   */
  const formatPublicKey = (key: string): string => {
    if (key.length <= 16) return key;
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Linked Wallets</CardTitle>
          <CardDescription>Loading your connected wallets...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Wallets</CardTitle>
        <CardDescription>
          Manage Phantom wallets connected to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Wallets List */}
        {wallets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No wallets linked to your account yet.
          </div>
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono">
                      {formatPublicKey(wallet.public_key)}
                    </code>
                    {wallet.is_primary && (
                      <Badge variant="default">Primary</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Added {formatDate(wallet.created_at)} • Last used{' '}
                    {formatDate(wallet.last_used_at)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlinkWallet(wallet)}
                  disabled={wallets.length === 1}
                >
                  Unlink
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Safeguard Message */}
        {wallets.length === 1 && (
          <Alert className="mt-4">
            <AlertDescription>
              This is your only linked wallet. Link another wallet before unlinking
              this one to maintain access to your account.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!walletToUnlink}
        onOpenChange={(open) => !open && setWalletToUnlink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink this wallet? You will no longer be able
              to sign in with this wallet.
              {walletToUnlink && (
                <div className="mt-2">
                  <code className="text-sm font-mono">
                    {formatPublicKey(walletToUnlink.public_key)}
                  </code>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnlink}
              disabled={isUnlinking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnlinking ? 'Unlinking...' : 'Unlink Wallet'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
