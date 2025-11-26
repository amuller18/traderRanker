# Web3 Authentication Setup Checklist

## Steps to Complete Setup

### 1. Enable Web3 Auth in Supabase Dashboard
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Scroll to **Web3** section
4. Enable **Solana** provider
5. Click **Save**

### 2. Run Database Migrations
You need to run the SQL migration to create the database trigger that automatically updates wallet addresses.

**Option A: Using Supabase Dashboard**
1. Go to **SQL Editor** in your Supabase Dashboard
2. Click **New query**
3. Copy the contents of `lib/supabase/web3-auth-trigger.sql`
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)

**Option B: Using Supabase CLI** (if you have it installed)
```bash
supabase db push
```

### 3. Verify the Trigger is Installed
Run this query in your Supabase SQL Editor:

```sql
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('on_web3_identity_created', 'on_auth_user_created');
```

You should see `on_web3_identity_created` in the results.

### 4. Test the Integration
1. Log out if you're currently logged in
2. Go to the login or register page
3. Click "Sign in with Phantom"
4. Approve the connection in Phantom wallet
5. Sign the message in Phantom wallet
6. You should be logged in and redirected
7. Go to `/account` page
8. Your wallet address should be displayed

## Troubleshooting

### Wallet shows "No wallet linked" after signing in with Phantom

This usually means the database trigger hasn't been installed. Follow step 2 above.

### "Phantom wallet is not installed" error

Install the Phantom browser extension from https://phantom.app/

### Can't see wallet address immediately

Try refreshing the page after signing in. The profile update happens via a database trigger which should be instant, but sometimes the auth state needs to refresh.

### Check if trigger fired correctly

Run this query to check your profile:
```sql
SELECT id, username, email, wallet_pubkeys, wallet_address
FROM profiles
WHERE id = auth.uid();
```

If `wallet_pubkeys` is NULL after signing in with Phantom, the trigger didn't fire. Make sure you ran the migration from step 2.

## Current Status

✅ Code implementation complete
✅ PhantomSignInButton added to login page
✅ PhantomSignInButton added to register page
✅ Logout disconnects wallet
✅ Account page handles Web3-only users
⚠️ **You need to**: Run the database migration (step 2)
⚠️ **You need to**: Enable Solana provider in Supabase (step 1)
