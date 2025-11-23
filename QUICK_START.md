# Quick Start Guide

## ✅ Environment Variables Configured

Your Supabase credentials are already set up in `.env.local`.

## 🚨 IMPORTANT: Set Up Database Schema (Required!)

Before you can use authentication, you **MUST** run the database schema in Supabase:

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/vpnkmyndixwyvttuztuv
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Run the Schema

1. Open the file `lib/supabase/schema.sql` in your code editor
2. Copy the **entire contents**
3. Paste into the Supabase SQL Editor
4. Click **Run** or press `Ctrl/Cmd + Enter`

You should see: ✅ "Success. No rows returned"

This creates:
- `profiles` table for user data
- Row Level Security policies
- Auto-profile creation trigger
- Wallet linking functionality

### Step 3: (Optional) Disable Email Confirmation for Development

For easier testing during development:

1. Go to **Authentication** → **Providers** → **Email**
2. Toggle **"Confirm email"** to **OFF**
3. Click **Save**

⚠️ **For production**: Keep email confirmation enabled!

## 🚀 Start the App

```bash
npm run dev
```

Visit http://localhost:3000

## 🧪 Test the Integration

### Test User Registration

1. Go to http://localhost:3000/auth/register
2. Create account:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `password123`
3. You should be auto-logged in

### Test Wallet Connection

1. Make sure Phantom wallet extension is installed
2. Click **"Connect Wallet"** in header
3. Approve the connection in Phantom
4. Wallet should auto-link to your profile
5. Click your avatar → see wallet address

### Verify in Supabase Dashboard

1. Go to **Authentication** → **Users**
   - You should see your test user
2. Go to **Table Editor** → **profiles**
   - You should see your profile with wallet_address

## 🎯 Features Available

✅ User registration with email/password
✅ Login/logout
✅ Phantom wallet connection
✅ Automatic wallet linking to user profile
✅ Manual link/unlink wallet
✅ Session persistence
✅ Secure database with RLS

## 📱 UI Elements

**Header (Desktop)**
- Left: Logo + Navigation
- Right: [Connect Wallet] [Login] or [Connect Wallet] [Avatar]

**Header (Mobile)**
- Hamburger menu with all features
- User profile section when logged in
- Wallet connection button
- Login/logout button

**User Dropdown** (when logged in)
- Username & email
- Wallet address (if linked)
- Link/Unlink wallet options
- Logout button

## 🐛 Troubleshooting

**Error: "relation 'profiles' does not exist"**
→ You forgot to run the SQL schema! Go to Step 1 above.

**Error: "Invalid API key"**
→ Check that `.env.local` has correct credentials and restart dev server.

**Wallet connects but doesn't save**
→ Make sure you're logged in first, or check Supabase logs.

**Can't create account**
→ Check if email confirmation is required in Supabase settings.

## 📚 Full Documentation

See `SUPABASE_SETUP.md` for comprehensive setup guide.

## 🔐 Security Note

Your `.env.local` file is in `.gitignore` and will NOT be committed to git. This keeps your Supabase credentials secure.

## Next Steps

1. ✅ Run the SQL schema in Supabase
2. ✅ Test user registration
3. ✅ Test wallet connection
4. ✅ Build your trading features!
