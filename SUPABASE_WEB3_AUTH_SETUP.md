# Supabase Web3 Authentication Setup Guide

Complete guide to setting up Phantom (Solana) wallet authentication using Supabase's native Web3 auth feature.

## 🎯 Overview

This implementation uses **Supabase's built-in Web3 authentication** feature, which is much simpler than custom nonce/signature verification. Supabase handles all the cryptographic verification automatically!

**Key Benefits:**
- ✅ No custom backend needed for signature verification
- ✅ Automatic nonce generation and validation
- ✅ Built-in rate limiting and security
- ✅ Works with all Solana wallets (Phantom, Solflare, Brave, etc.)
- ✅ Database trigger automatically updates profiles table

## 📋 Setup Steps

### Step 1: Enable Web3 Auth in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Scroll down to **Web3 Wallet** section
4. Enable **Solana** (and optionally **Ethereum**)
5. Click **Save**

**Screenshot locations in dashboard:**
```
Authentication → Providers → Web3 Wallet → Solana [Toggle ON]
```

### Step 2: Configure Redirect URLs

Web3 authentication requires proper redirect URL configuration to prevent abuse.

1. Go to **Authentication** → **URL Configuration**
2. Add your application URLs to **Redirect URLs**:

For local development:
```
http://localhost:3000/**
```

For production:
```
https://yourdomain.com/**
```

The `**` wildcard allows all routes on your domain.

### Step 3: Run Database Migrations

Execute the following SQL migrations in your Supabase SQL Editor:

#### 3a. Run the Web3 auth trigger migration

```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste the contents of:
lib/supabase/web3-auth-trigger.sql
```

This creates a database trigger that automatically updates `profiles.wallet_pubkeys` when users sign in with Web3.

**What the trigger does:**
- Listens for new Web3 identity creation
- Extracts the wallet address from the identity
- Updates the user's profile with the wallet address
- Works seamlessly with existing profile creation triggers

### Step 4: Optional - Configure Rate Limiting

For production, you may want to adjust rate limits:

1. Go to **Authentication** → **Rate Limits**
2. Set **Web3 sign-ins per 5 minutes** (default: 30)

Or if using Supabase CLI:

```toml
[auth.rate_limit]
web3 = 30  # Adjust as needed
```

### Step 5: Optional - Enable CAPTCHA

To prevent abuse from automated wallet creation:

1. Go to **Authentication** → **Bot Detection**
2. Enable **CAPTCHA protection**
3. Choose provider (hCaptcha, reCAPTCHA, or Turnstile)
4. Add your CAPTCHA site key and secret

## 🎨 Frontend Integration

### Using the Simplified Components

The new implementation provides two options:

#### Option 1: PhantomSignInButton (Recommended - Simplest)

```tsx
import { PhantomSignInButton } from '@/components/PhantomSignInButton';

export default function LoginPage() {
  return (
    <div>
      <h1>Sign In</h1>
      <PhantomSignInButton
        onSuccess={() => {
          // User is now signed in!
          router.push('/dashboard');
        }}
      />
    </div>
  );
}
```

#### Option 2: useSupabaseWeb3Auth Hook (More Control)

```tsx
import { useSupabaseWeb3Auth } from '@/hooks/useSupabaseWeb3Auth';

export default function CustomSignIn() {
  const { signInWithPhantom, isLoading, error } = useSupabaseWeb3Auth();

  const handleSignIn = async () => {
    try {
      const result = await signInWithPhantom();
      if (result?.user) {
        console.log('Signed in:', result.user);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  };

  return (
    <button onClick={handleSignIn} disabled={isLoading}>
      {isLoading ? 'Signing in...' : 'Sign in with Phantom'}
    </button>
  );
}
```

### Linking Wallet to Existing Account

If a user is already logged in (via email/password) and wants to link their Phantom wallet:

```tsx
import { useSupabaseWeb3Auth } from '@/hooks/useSupabaseWeb3Auth';

export function LinkWalletButton() {
  const { linkPhantomWallet, isLoading } = useSupabaseWeb3Auth();

  const handleLinkWallet = async () => {
    try {
      await linkPhantomWallet();
      toast.success('Wallet linked successfully!');
    } catch (err) {
      toast.error('Failed to link wallet');
    }
  };

  return (
    <button onClick={handleLinkWallet} disabled={isLoading}>
      Link Phantom Wallet
    </button>
  );
}
```

### Unlinking Wallet

```tsx
const { unlinkPhantomWallet } = useSupabaseWeb3Auth();

// Get the identity ID from user's identities
const web3Identity = user.identities?.find(i => i.provider === 'web3');

if (web3Identity) {
  await unlinkPhantomWallet(web3Identity.id);
}
```

## 🔄 How It Works

### Sign-In Flow

```
1. User clicks "Sign in with Phantom"
   ↓
2. useSupabaseWeb3Auth.signInWithPhantom() is called
   ↓
3. Supabase generates a nonce automatically
   ↓
4. Phantom wallet prompts user to sign the message
   ↓
5. Supabase verifies the signature (EIP-4361 standard)
   ↓
6. User account is created/retrieved
   ↓
7. Database trigger updates profiles.wallet_pubkeys
   ↓
8. User is signed in with Supabase session
```

### What Gets Stored

**In `auth.users` table:**
- Email: `{wallet_address}@web3.io` (placeholder)
- Email confirmed: `true`
- User metadata: Empty (wallet info is in identity)

**In `auth.identities` table:**
- Provider: `web3`
- Identity data:
  - `sub`: The wallet address (public key)
  - `statement`: Sign-in message shown to user
  - `chain`: `solana`

**In `profiles` table (via trigger):**
- `wallet_pubkeys`: Solana wallet address
- `wallet_address`: Solana wallet address (legacy field)

## 🔒 Security Features

### Built-in Protections

1. **EIP-4361 Standard**: Industry-standard message signing
2. **Timestamp Validation**: Signatures expire after 10 minutes
3. **Domain Validation**: Signatures must match your configured redirect URLs
4. **Rate Limiting**: Configurable limits per IP address
5. **CAPTCHA Support**: Optional bot protection

### Best Practices

1. **Always configure redirect URLs** in production
2. **Enable rate limiting** to prevent abuse
3. **Consider CAPTCHA** for public-facing applications
4. **Use HTTPS** in production (required for Web3 wallets)
5. **Monitor auth logs** in Supabase dashboard

## 🧪 Testing

### Local Development Testing

1. Make sure Phantom wallet is installed
2. Start your Next.js dev server: `npm run dev`
3. Navigate to your sign-in page
4. Click "Sign in with Phantom"
5. Approve the connection and signature in Phantom
6. Check Supabase dashboard:
   - **Authentication** → **Users** (new user should appear)
   - **Table Editor** → **profiles** (wallet_pubkeys should be set)
   - **Authentication** → **Logs** (see auth events)

### Verify Database Trigger

Run this query in Supabase SQL Editor to verify the trigger is working:

```sql
-- Check if triggers exist
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'on_web3_identity_created';

-- Check if function exists
SELECT
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_web3_identity';
```

### Test Wallet Linking

1. Sign in with email/password
2. Go to account settings
3. Click "Link Wallet" button
4. Approve in Phantom
5. Check that `wallet_pubkeys` is now set in your profile

## 📊 Monitoring & Debugging

### View Auth Logs

In Supabase Dashboard:
```
Authentication → Logs
```

Look for events:
- `user.created` - New user signed up with Web3
- `user.signedin` - User signed in with Web3
- `identity.created` - Web3 identity was linked

### Common Issues

**Issue**: "Phantom wallet not installed"
- **Solution**: Install Phantom browser extension from https://phantom.app/

**Issue**: "Redirect URL mismatch"
- **Solution**: Add your URL to redirect URLs in dashboard
- Make sure to include `/**` wildcard

**Issue**: "Signature verification failed"
- **Solution**: Check that your site is using HTTPS (or http://localhost for dev)
- Clear browser cache and try again

**Issue**: "wallet_pubkeys not updating in profiles"
- **Solution**: Run the web3-auth-trigger.sql migration
- Check trigger exists with the verification query above

**Issue**: "Rate limit exceeded"
- **Solution**: Wait a few minutes or increase rate limits in dashboard

## 🆚 Comparison: Supabase Web3 vs Custom Implementation

| Feature | Supabase Web3 Auth | Custom Implementation |
|---------|-------------------|----------------------|
| **Setup Complexity** | ✅ Simple (1 toggle) | ❌ Complex (backend endpoints) |
| **Backend Code** | ✅ None needed | ❌ FastAPI routes required |
| **Signature Verification** | ✅ Automatic | ❌ Manual (PyNaCl) |
| **Nonce Management** | ✅ Automatic | ❌ Manual (database + expiry) |
| **Rate Limiting** | ✅ Built-in | ❌ Manual implementation |
| **Security Updates** | ✅ Managed by Supabase | ❌ Your responsibility |
| **Standard Compliance** | ✅ EIP-4361 | ✅ EIP-4361 (if implemented correctly) |

**Recommendation**: Use Supabase Web3 Auth unless you have very specific requirements that need custom verification.

## 📚 Additional Resources

- [Supabase Web3 Auth Documentation](https://supabase.com/docs/guides/auth/auth-web3)
- [EIP-4361 Standard](https://eips.ethereum.org/EIPS/eip-4361)
- [Phantom Wallet Documentation](https://docs.phantom.app/)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)

## 🤝 Support

For issues:
1. Check Supabase auth logs in dashboard
2. Verify database triggers are installed
3. Check browser console for errors
4. Review Phantom wallet connection logs

---

**Last Updated**: January 2025
**Supabase Version**: Latest
**Next.js Version**: 15.x
