'use client';

import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Wallet, Mail, User, TrendingUp, ArrowRight, Edit2, Check, X, BarChart3, ArrowLeftRight, Loader2, Plus, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { mockAccountData } from '@/app/copy-trader/dashboard/data/mock';
import { AccountDataPoint } from '@/app/copy-trader/dashboard/types';
import { PageHeader } from '@/app/page-header';
import { useDisplayPreference } from '@/lib/display-preference-context';
import { usePhantomAuth } from '@/hooks/usePhantomAuth';
import { toast } from 'sonner';

export default function AccountPage() {
  const { user, updateProfile, linkWallet } = useAuth();
  const { displayMode, toggleDisplayMode } = useDisplayPreference();
  const { linkWalletIfLoggedIn, isPhantomInstalled, isLoading: isWalletLoading, error: walletError } = usePhantomAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [accountData, setAccountData] = useState<AccountDataPoint[]>([]);
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Check if user is wallet-only (has fake @wallet.traderranker.com email)
  const isWalletOnlyAccount = user?.email?.endsWith('@wallet.traderranker.com') ?? false;
  const hasWalletLinked = !!(user?.wallet_pubkeys || user?.wallet_address);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  useEffect(() => {
    // TODO: Fetch real account data based on user ID
    setAccountData(mockAccountData);
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await updateProfile({
        full_name: fullName || undefined,
        avatar_url: avatarUrl || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
    }
    setIsEditing(false);
  };

  const handleLinkWallet = async () => {
    if (!isPhantomInstalled()) {
      toast.error('Phantom wallet is not installed. Please install it from https://phantom.app/');
      return;
    }

    setIsLinkingWallet(true);
    try {
      const result = await linkWalletIfLoggedIn();
      // Update local state via auth context
      await linkWallet(result.public_key);
      toast.success('Wallet linked successfully!');
      // Force page refresh to update all components
      window.location.reload();
    } catch (error) {
      console.error('Failed to link wallet:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to link wallet');
      setIsLinkingWallet(false);
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || !emailPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (emailPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSavingEmail(true);
    try {
      const response = await fetch('/api/auth/add-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newEmail, password: emailPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to add email');
      }

      toast.success('Email added! Please check your inbox to confirm.');
      setIsAddingEmail(false);
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      console.error('Failed to add email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Please log in to view your account settings.</p>
              <Button asChild>
                <Link href="/auth/login">Go to Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate account summary
  const latestValue = accountData[accountData.length - 1]?.value || 0;
  const firstValue = accountData[0]?.value || 0;
  const totalChange = latestValue - firstValue;
  const totalChangePercent = firstValue > 0 ? ((latestValue - firstValue) / firstValue) * 100 : 0;
  const isPositive = totalChange >= 0;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getInitials = (name?: string, email?: string, username?: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    return 'U';  // Default fallback
  };

  return (
    <>
      <PageHeader />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile and view your account overview
          </p>
        </div>

      <div className="grid gap-6">
        {/* Profile Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal account details</CardDescription>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar and Name */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={isEditing ? avatarUrl : user.avatar_url} />
                <AvatarFallback className="text-lg">
                  {getInitials(user.full_name, user.email, user.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="avatarUrl">Avatar URL</Label>
                      <Input
                        id="avatarUrl"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold">
                      {user.full_name || 'No name set'}
                    </h3>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Account Details */}
            <div className="grid gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Username</Label>
                  <p className="font-medium">{user.username}</p>
                </div>
              </div>

              {/* Email section - hide for wallet-only accounts or show add email option */}
              {isWalletOnlyAccount ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    {isAddingEmail ? (
                      <form onSubmit={handleAddEmail} className="space-y-2 mt-2">
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          disabled={isSavingEmail}
                          required
                        />
                        <Input
                          type="password"
                          placeholder="Create a password (min 6 chars)"
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          disabled={isSavingEmail}
                          required
                        />
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={isSavingEmail}>
                            {isSavingEmail ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              'Add Email'
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsAddingEmail(false);
                              setNewEmail('');
                              setEmailPassword('');
                            }}
                            disabled={isSavingEmail}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-muted-foreground text-sm">No email linked</span>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-primary"
                          onClick={() => setIsAddingEmail(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Email
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : user.email ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
              ) : null}

              {/* Wallet section */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                  {hasWalletLinked ? (
                    <p className="font-medium font-mono text-sm">
                      {`${(user.wallet_pubkeys || user.wallet_address)!.slice(0, 6)}...${(user.wallet_pubkeys || user.wallet_address)!.slice(-4)}`}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-muted-foreground text-sm">No wallet linked</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-primary"
                        onClick={handleLinkWallet}
                        disabled={isLinkingWallet}
                      >
                        {isLinkingWallet ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Linking...
                          </>
                        ) : (
                          <>
                            <LinkIcon className="h-3 w-3 mr-1" />
                            Link Wallet
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Display Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Display Preferences
            </CardTitle>
            <CardDescription>Customize how data is displayed in tables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Price Display Mode</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose to display prices or market caps in trade tables
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleDisplayMode}
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                {displayMode === 'price' ? 'Price' : 'Market Cap'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This preference will be applied across all trade tables in the app.
              {user ? ' Your preference is saved to your account.' : ' Sign in to save this preference.'}
            </p>
          </CardContent>
        </Card>

        {/* Account Balance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Account Balance
            </CardTitle>
            <CardDescription>Your current trading account overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {formatCurrency(latestValue)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(totalChange)}
                </span>
                <span className={`text-sm font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ({isPositive ? '+' : ''}{totalChangePercent.toFixed(2)}%)
                </span>
                <span className="text-sm text-muted-foreground">all time</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button asChild className="w-full" size="lg">
                <Link href="/copy-trader/dashboard">
                  View Copy Trading Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Access detailed charts, strategies, and trading history
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
