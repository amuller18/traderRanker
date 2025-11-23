# Supabase Setup Guide

This guide will help you set up Supabase authentication and user profiles for TraderRanker.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in your project details:
   - Name: `TraderRanker` (or your preferred name)
   - Database Password: (choose a strong password)
   - Region: (select the closest to your users)
4. Wait for the project to be created (takes ~2 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

## Step 3: Configure Environment Variables

1. Open the `.env.local` file in your project root
2. Replace the placeholder values with your actual Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file

## Step 4: Set Up the Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `lib/supabase/schema.sql`
4. Paste it into the SQL editor
5. Click "Run" or press `Ctrl/Cmd + Enter`

This will:
- Create the `profiles` table
- Set up Row Level Security (RLS) policies
- Create triggers to automatically create profiles on user signup
- Link profiles with Supabase Auth

## Step 5: Configure Email Authentication (Optional)

By default, Supabase requires email confirmation. For development, you can disable this:

1. Go to **Authentication** → **Providers** → **Email**
2. Under "Email Settings", toggle **"Confirm email"** to OFF
3. Click "Save"

⚠️ **For production**: Keep email confirmation enabled and configure your SMTP settings.

## Step 6: Test the Setup

1. Start your development server:
```bash
npm run dev
```

2. Navigate to `http://localhost:3000/auth/register`
3. Create a test account
4. Check your Supabase dashboard:
   - Go to **Authentication** → **Users** (you should see your new user)
   - Go to **Table Editor** → **profiles** (you should see your profile)

## Features Implemented

### Authentication
- ✅ Email/password registration
- ✅ Email/password login
- ✅ Logout functionality
- ✅ Session persistence
- ✅ Auto-profile creation on signup

### User Profiles
- ✅ Username (unique)
- ✅ Email (from Supabase Auth)
- ✅ Wallet address linking
- ✅ Full name (optional)
- ✅ Avatar URL (optional)

### Phantom Wallet Integration
- ✅ Connect/disconnect wallet
- ✅ Link wallet to user profile
- ✅ Unlink wallet from profile
- ✅ Display wallet address in user dropdown
- ✅ Automatic wallet linking on connection (when logged in)

## Usage

### User Registration Flow
1. User visits `/auth/register`
2. Fills in username, email, and password
3. Supabase creates auth user
4. Database trigger creates profile automatically
5. User is logged in and redirected to home

### Wallet Connection Flow
1. User clicks "Connect Wallet" button
2. Phantom wallet popup appears
3. User approves connection
4. If logged in, wallet address is automatically linked to profile
5. Wallet address displayed in header and user dropdown

### Linking Wallet to Existing Account
1. Login to your account
2. Connect your Phantom wallet
3. Click on your avatar → "Link Wallet"
4. Wallet address is saved to your profile

## Database Schema

```sql
profiles
├── id (uuid, primary key, references auth.users)
├── username (text, unique, required)
├── full_name (text, optional)
├── avatar_url (text, optional)
├── wallet_address (text, optional)
├── created_at (timestamp)
└── updated_at (timestamp)
```

## Security Features

- **Row Level Security (RLS)**: Users can only view/edit their own profiles
- **Unique usernames**: Checked before account creation
- **Password requirements**: Minimum 6 characters (enforced client-side)
- **Session management**: Automatic token refresh
- **Secure wallet linking**: Only authenticated users can link wallets

## Troubleshooting

### "Invalid API key" error
- Check that your `.env.local` file has the correct credentials
- Restart your development server after changing `.env.local`

### Users created but no profile
- Make sure you ran the SQL schema in Step 4
- Check that the trigger `on_auth_user_created` exists in your database

### Wallet connection fails
- Make sure Phantom wallet browser extension is installed
- Check browser console for errors
- Ensure you're on a Solana-compatible network

### Build errors
- Run `npm install --legacy-peer-deps` to resolve peer dependency issues
- Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

## Next Steps

### Production Deployment
1. Enable email confirmation in Supabase
2. Configure custom SMTP for emails
3. Set up proper password reset flow
4. Add OAuth providers (Google, GitHub, etc.)
5. Implement rate limiting
6. Add email verification requirements

### Additional Features to Consider
- Two-factor authentication (2FA)
- Profile picture upload
- User preferences/settings
- Trading history linked to wallet
- Portfolio tracking
- Social features (follow traders)

## Support

For issues or questions:
- Supabase Documentation: https://supabase.com/docs
- Phantom Wallet Docs: https://docs.phantom.app/
- Next.js Documentation: https://nextjs.org/docs

## License

This setup is part of the TraderRanker project.
