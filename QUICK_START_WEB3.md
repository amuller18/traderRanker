# Quick Start: Supabase Native Web3 Authentication

## ✅ Step 1: Enable in Supabase Dashboard

### Enable Web3 Provider
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/auth/providers
2. Scroll to **Web3 Wallet** section
3. Toggle **Solana** to ON
4. Click **Save**

### Configure Redirect URLs
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/auth/url-configuration
2. Add these URLs under **Redirect URLs**:
   ```
   http://localhost:3000/**
   https://your-production-domain.com/**
   ```

## ✅ Step 2: Run Database Migration

Copy and run this in your Supabase SQL Editor:
https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

```sql
-- File: lib/supabase/web3-auth-trigger.sql
-- This creates a trigger that automatically updates profiles.wallet_pubkeys
-- when users sign in with their Phantom wallet

-- See the file for the full migration
```

## ✅ Step 3: Add PhantomSignInButton to Your Login Page

```tsx
// app/auth/login/page.tsx
import { PhantomSignInButton } from '@/components/PhantomSignInButton';

export default function LoginPage() {
  return (
    <div>
      <h1>Sign In</h1>

      {/* Email/Password login */}
      <LoginForm />

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      {/* Phantom Wallet Sign-In */}
      <PhantomSignInButton
        onSuccess={() => router.push('/dashboard')}
      />
    </div>
  );
}
```

## ✅ Step 4: Test It!

1. Install Phantom wallet extension if you haven't: https://phantom.app/
2. Go to your login page
3. Click "Sign in with Phantom"
4. Approve the connection in Phantom
5. Sign the message in Phantom
6. You'll be signed in and redirected!

## 🔍 Verify It's Working

### Check User Created
1. Go to Supabase Dashboard → Authentication → Users
2. You should see a new user with email like: `{your-wallet-address}@web3.io`

### Check Profile Updated
1. Go to Supabase Dashboard → Table Editor → profiles
2. Find your user's profile
3. Check that `wallet_pubkeys` column has your wallet address ✅

### Check on Account Page
1. Go to `/account` in your app
2. You should see your wallet address displayed ✅

## 🎨 Customization

### Change Button Style
```tsx
<PhantomSignInButton
  variant="outline"
  size="lg"
  className="w-full"
  onSuccess={() => console.log('Signed in!')}
/>
```

### Use the Hook Directly
```tsx
import { useSupabaseWeb3Auth } from '@/hooks/useSupabaseWeb3Auth';

const { signInWithPhantom, isLoading, error } = useSupabaseWeb3Auth();

const handleSignIn = async () => {
  const result = await signInWithPhantom();
  if (result?.user) {
    // User is now signed in!
    router.push('/dashboard');
  }
};
```

## 🔗 Link Wallet to Existing Account

If a user already has an email/password account and wants to link their Phantom wallet:

```tsx
import { useSupabaseWeb3Auth } from '@/hooks/useSupabaseWeb3Auth';

const { linkPhantomWallet, isLoading } = useSupabaseWeb3Auth();

const handleLinkWallet = async () => {
  try {
    await linkPhantomWallet();
    toast.success('Wallet linked successfully!');
  } catch (error) {
    toast.error('Failed to link wallet');
  }
};

return (
  <button onClick={handleLinkWallet} disabled={isLoading}>
    Link Phantom Wallet
  </button>
);
```

## 📊 What Gets Saved

### In `auth.users` table:
- Email: `{wallet_address}@web3.io`
- Email confirmed: `true`

### In `auth.identities` table:
- Provider: `web3`
- Identity data → sub: Your wallet address

### In `profiles` table (via trigger):
- `wallet_pubkeys`: Your Phantom wallet address ✅
- `wallet_address`: Same (for backward compatibility)

## 🐛 Troubleshooting

**"Phantom wallet not installed"**
- Install from https://phantom.app/

**"Redirect URL mismatch"**
- Add your URL to Supabase redirect URLs with `/**` wildcard

**"wallet_pubkeys not updating"**
- Make sure you ran the database migration (web3-auth-trigger.sql)
- Check if trigger exists in Supabase SQL Editor

**"Rate limit exceeded"**
- Wait a few minutes, or increase rate limits in Supabase dashboard

## 🎉 That's It!

You now have fully functional Phantom wallet authentication with just a few lines of code!

No backend needed, no manual signature verification, no nonce management - Supabase handles it all! ✨
