# Deploying to Vercel with Supabase

## Setting Environment Variables in Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. **Go to your Vercel project**
   - Visit https://vercel.com/dashboard
   - Select your `traderRanker` project

2. **Navigate to Settings**
   - Click on **Settings** tab
   - Click on **Environment Variables** in the left sidebar

3. **Add your Supabase variables**

   Add these two variables:

   **Variable 1:**
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://vpnkmyndixwyvttuztuv.supabase.co`
   - Environment: Select **Production**, **Preview**, and **Development**

   **Variable 2:**
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbmtteW5kaXh3eXZ0dHV6dHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTE0MDAsImV4cCI6MjA3OTQyNzQwMH0.TDd0UvjlQxSn1h3-sgNa0yo5skci36hBHvcN9t5m5T8`
   - Environment: Select **Production**, **Preview**, and **Development**

4. **Redeploy**
   - Go to **Deployments** tab
   - Click on the three dots (`...`) next to your latest deployment
   - Click **Redeploy**
   - Check "Use existing Build Cache" is **OFF**
   - Click **Redeploy**

### Option 2: Via Vercel CLI

If you have Vercel CLI installed:

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login to Vercel
vercel login

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste: https://vpnkmyndixwyvttuztuv.supabase.co
# Select: Production, Preview, Development

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbmtteW5kaXh3eXZ0dHV6dHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTE0MDAsImV4cCI6MjA3OTQyNzQwMH0.TDd0UvjlQxSn1h3-sgNa0yo5skci36hBHvcN9t5m5T8
# Select: Production, Preview, Development

# Redeploy
vercel --prod
```

## Quick Copy-Paste Values

```
NEXT_PUBLIC_SUPABASE_URL=https://vpnkmyndixwyvttuztuv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbmtteW5kaXh3eXZ0dHV6dHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTE0MDAsImV4cCI6MjA3OTQyNzQwMH0.TDd0UvjlQxSn1h3-sgNa0yo5skci36hBHvcN9t5m5T8
```

## Important Notes

### ⚠️ Security

- The `NEXT_PUBLIC_` prefix means these variables are exposed to the browser
- The anon key is safe to expose (it's meant to be public)
- Never expose your Supabase service_role key (you don't need it for this app)

### 🔒 Supabase Security

Your database is protected by:
- Row Level Security (RLS) policies
- The anon key only allows authenticated access
- Each user can only access their own data

### 📦 Build Settings

Make sure your Vercel project has these settings:

**Framework Preset:** Next.js
**Build Command:** `npm run build` or `next build`
**Output Directory:** Leave empty (Next.js handles this)
**Install Command:** `npm install --legacy-peer-deps`

### Common Issues

**Build fails with "Invalid API key"**
- Make sure you added both environment variables
- Check for typos in variable names (must be exact)
- Redeploy with cache cleared

**Build fails with peer dependency errors**
- Add custom install command: `npm install --legacy-peer-deps`
- Or add this to package.json:
  ```json
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
  ```

**Pages work locally but fail on Vercel**
- Supabase credentials are different in production
- Check environment variables are set for all environments
- Clear build cache and redeploy

## After Deployment

1. **Test your deployment**
   - Visit your Vercel URL
   - Try registering a new account
   - Test wallet connection

2. **Configure Supabase for production**
   - Add your Vercel domain to Supabase allowed URLs:
     - Go to Supabase Dashboard → Authentication → URL Configuration
     - Add your Vercel URL to "Site URL" and "Redirect URLs"
     - Example: `https://your-app.vercel.app`

3. **Enable email confirmation** (production only)
   - Go to Authentication → Providers → Email
   - Toggle "Confirm email" to ON
   - Configure SMTP settings for email delivery

## Quick Deployment Checklist

- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` to Vercel
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel
- [ ] Set variables for all environments (Production, Preview, Development)
- [ ] Add custom install command if needed: `npm install --legacy-peer-deps`
- [ ] Clear build cache and redeploy
- [ ] Test registration and login on deployed site
- [ ] Add Vercel domain to Supabase allowed URLs
- [ ] Database schema already run in Supabase ✓

## Screenshot Guide

### Step 1: Vercel Environment Variables
```
Settings → Environment Variables → Add New

┌─────────────────────────────────────────┐
│ Key:   NEXT_PUBLIC_SUPABASE_URL        │
│ Value: https://vpnkmyndixwyvttuztuv... │
│ [x] Production                          │
│ [x] Preview                             │
│ [x] Development                         │
└─────────────────────────────────────────┘
```

### Step 2: Add Second Variable
```
┌─────────────────────────────────────────┐
│ Key:   NEXT_PUBLIC_SUPABASE_ANON_KEY   │
│ Value: eyJhbGciOiJIUzI1NiIsInR5cCI... │
│ [x] Production                          │
│ [x] Preview                             │
│ [x] Development                         │
└─────────────────────────────────────────┘
```

## Need Help?

If deployment still fails:
1. Check Vercel build logs for specific error
2. Verify environment variables are saved
3. Try deploying from main branch
4. Contact me with the error message
