# Supabase Auth & Profile Fetch - Debugging & Verification Guide

## Overview

This document provides comprehensive verification steps for the Supabase authentication and profile-fetching fixes implemented to resolve runtime errors and add extensive debugging.

## Changes Summary

### 1. Enhanced `lib/supabase/client.ts`
- Added debug logging for client creation
- Added explicit auth configuration (`persistSession: true`, `detectSessionInUrl: true`, `autoRefreshToken: true`)
- Added token masking utility for safe logging
- Debug mode controlled by `NEXT_PUBLIC_DEBUG_SUPABASE=true`

### 2. Rewritten `lib/auth-context.tsx`
- Added comprehensive safe logging utilities:
  - `safeLogSupabaseError()` - Never throws on null/undefined errors
  - `maskToken()` - Safely masks tokens for logging
  - `safeStringify()` - Safely stringifies objects without errors
  - `logSessionDetails()` - Detailed session logging (debug mode)
  - `logUserDetails()` - Detailed user logging (debug mode)
- Completely rewrote `fetchUserProfile()` with:
  - Client-side execution guard (`typeof window === 'undefined'`)
  - Step-by-step logging with timing information
  - Session and user validation before profile query
  - REST URL construction and logging
  - Request header logging (masked tokens)
  - Response logging (status, data, error)
  - Network error retry logic (1 retry after 250ms)
  - PGRST116 (no rows) retry logic with exponential backoff
  - Structured console.group/groupEnd for collapsible logs
- All error logging uses safe utilities throughout

### 3. No Changes to `app/auth/register/page.tsx`
- Registration flow already uses `register()` from auth context
- Retry logic in `fetchUserProfile()` handles post-registration race conditions

---

## Environment Variables

Add to your `.env.local` file:

```bash
# Required: Your Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Enable extensive debug logging
NEXT_PUBLIC_DEBUG_SUPABASE=true
```

**Important**: Set `NEXT_PUBLIC_DEBUG_SUPABASE=false` or remove it in production to reduce console noise.

---

## Verification Steps

### Step 1: Enable Debug Mode

Set in `.env.local`:
```bash
NEXT_PUBLIC_DEBUG_SUPABASE=true
```

Restart your dev server:
```bash
npm run dev
```

### Step 2: Browser Console Verification (Logged In User)

Open your browser's DevTools console while logged into your app. You should see structured logs like:

```
🔧 Supabase Client Creation
  Environment: Browser
  URL configured: true
  Anon key configured: true
  ...

🚀 AuthProvider Initialization
  Environment: Browser
  Debug mode: true
  ...

🔍 fetchUserProfile - START
  ├─ 📡 Step 1: Getting Session
  │    getSession() duration: 12ms
  │    🔐 Session Details
  │      Access token present: true
  │      Access token (masked): eyJhbGci...
  │      ...
  ├─ 📡 Step 2: Getting User
  │    getUser() duration: 8ms
  │    👤 User Details
  │      User ID: abc123...
  │      Email: user@example.com
  │      ...
  ├─ 🌐 Step 3: Profile Query Details
  │    Target user ID: abc123...
  │    Constructed REST URL: https://your-project.supabase.co/rest/v1/profiles?id=eq.abc123...
  │    Authorization header (masked): Bearer eyJhbGci...
  │    ...
  ├─ 📊 Step 4: Executing Profile Query
  │    Query duration: 145ms
  │    Response status: 200
  │    Data received: true
  │    Error received: false
  │    Profile data: { id: "abc123...", username: "testuser", ... }
  │
  ✅ Profile fetched successfully
  Total duration: 187ms
```

### Step 3: Manual Profile Fetch Test (Browser Console)

**IMPORTANT**: Run this snippet in the browser console while logged in:

```javascript
// Manual Profile Fetch Test
(async () => {
  console.group('🧪 Manual Profile Fetch Test');

  // Import Supabase client
  const { createClient } = await import('/lib/supabase/client.js');
  const supabase = createClient();

  // Step 1: Get session
  console.log('Step 1: Getting session...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  console.log('Session exists:', !!session);
  console.log('Access token present:', !!session?.access_token);
  console.log('Access token (first 20 chars):', session?.access_token?.substring(0, 20) + '...');
  console.log('User ID:', session?.user?.id);
  console.log('User email:', session?.user?.email);

  if (!session) {
    console.error('❌ No session found. Please log in first.');
    console.groupEnd();
    return;
  }

  // Step 2: Get user
  console.log('\nStep 2: Getting user...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log('User exists:', !!user);
  console.log('User ID:', user?.id);

  if (!user) {
    console.error('❌ No user found.');
    console.groupEnd();
    return;
  }

  // Step 3: Fetch profile
  console.log('\nStep 3: Fetching profile...');
  const startTime = Date.now();

  const { data: profile, error, status } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const duration = Date.now() - startTime;

  console.log('Query duration:', duration + 'ms');
  console.log('Status:', status);
  console.log('Profile data:', profile);
  console.log('Error:', error);

  // Step 4: Test manual REST fetch with headers
  console.log('\nStep 4: Testing direct REST API call...');
  const supabaseUrl = 'YOUR_SUPABASE_URL_HERE'; // Replace with your actual URL
  const restUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`;

  console.log('REST URL:', restUrl);
  console.log('Authorization:', `Bearer ${session.access_token.substring(0, 20)}...`);

  try {
    const response = await fetch(restUrl, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': 'YOUR_ANON_KEY_HERE', // Replace with your actual anon key
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('REST Response status:', response.status);
    console.log('REST Response data:', data);
  } catch (fetchError) {
    console.error('❌ REST fetch error:', fetchError);
  }

  console.groupEnd();
})();
```

**Replace `YOUR_SUPABASE_URL_HERE` and `YOUR_ANON_KEY_HERE` with your actual values from `.env.local`.**

### Step 4: Test Registration Flow

1. Log out of your application
2. Go to the registration page
3. Open browser DevTools console
4. Register a new account
5. Watch the console logs - you should see:
   - `🔍 fetchUserProfile - START`
   - Multiple retry attempts if PGRST116 occurs
   - `🔄 PGRST116 detected: Profile not found yet`
   - `Retrying in 1000ms...`
   - Eventually: `✅ Profile fetched successfully`

### Step 5: Test Error Scenarios

#### 5a. Test Empty Error Object

Temporarily add this to `lib/auth-context.tsx` after line 100:

```typescript
// TEST: Simulate empty error object
safeLogSupabaseError('TEST - Empty Error', {});
safeLogSupabaseError('TEST - Null Error', null);
safeLogSupabaseError('TEST - Undefined Error', undefined);
```

Refresh the page and verify console shows safe handling without runtime exceptions.

#### 5b. Test Network Failure

1. Open browser DevTools
2. Go to Network tab
3. Enable "Offline" mode
4. Try to log in or fetch profile
5. Watch console for:
   - `⚠️ Exception Caught in fetchUserProfile`
   - `🔄 Network error detected, retrying once after 250ms...`
   - Network retry attempt

---

## Curl Verification Commands

### Command 1: Test with User Access Token

**Get your access token**:
1. Log into your app in the browser
2. Open DevTools console
3. Run:
   ```javascript
   (async () => {
     const { createClient } = await import('/lib/supabase/client.js');
     const supabase = createClient();
     const { data: { session } } = await supabase.auth.getSession();
     console.log('Access Token:', session.access_token);
   })();
   ```
4. Copy the token

**Run curl command** (replace `YOUR_TOKEN` and `YOUR_USER_ID`):

```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/profiles?id=eq.YOUR_USER_ID&select=*' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -v
```

**Expected output**:
```
< HTTP/2 200
< content-type: application/json
...
[{"id":"YOUR_USER_ID","username":"testuser","full_name":null,"avatar_url":null,"wallet_address":null,"created_at":"...","updated_at":"..."}]
```

### Command 2: Test with Service Role Key (Admin Access)

**⚠️ WARNING**: Never expose service_role key in client code or commit it to version control!

**Run curl command** (replace `YOUR_SERVICE_ROLE_KEY`):

```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/profiles?select=*' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'apikey: YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -v
```

**Expected output**:
```
< HTTP/2 200
< content-type: application/json
...
[{"id":"...","username":"user1",...},{"id":"...","username":"user2",...},...]
```

This bypasses RLS and returns ALL profiles (useful for debugging RLS policies).

### Command 3: Test RLS Policy (Should Fail Without Token)

```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/profiles?select=*' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -v
```

**Expected output**:
```
< HTTP/2 200
< content-type: application/json
...
[]
```

Empty array means RLS is working correctly - anon users can't read profiles.

---

## Troubleshooting

### Issue: Still seeing `Error fetching profile: {}`

**Diagnosis**: This means the error object is literally an empty object `{}`.

**Solution**:
1. Check your Supabase RLS policies - they might be blocking the query
2. Run curl commands above to verify RLS policies
3. Enable debug mode and check console for detailed error info
4. Look for `❌ Profile Query - Supabase Error` logs

### Issue: Profile not found after registration (PGRST116)

**Diagnosis**: Database trigger hasn't created profile yet (race condition).

**Solution**:
- The code now handles this automatically with retry logic
- Check console for `🔄 PGRST116 detected` messages
- If retries fail, check your database trigger:

```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check recent profiles
SELECT id, username, created_at FROM public.profiles ORDER BY created_at DESC LIMIT 5;
```

### Issue: "fetchUserProfile called server-side"

**Diagnosis**: Function is being called during SSR/server rendering.

**Solution**:
- The code now guards against this automatically
- Ensure `"use client"` directive is at top of `lib/auth-context.tsx`
- Check that components using `useAuth()` are client components

### Issue: Network retry not working

**Diagnosis**: Check console for network retry logs.

**Solution**:
1. Verify error is actually a network error (not a Supabase API error)
2. Check browser network tab for failed requests
3. Increase `networkRetries` parameter if needed (currently set to 1)

---

## Security Considerations

### ✅ Safe Practices Implemented

1. **Token Masking**: All tokens are masked in logs (showing only first 8 characters)
2. **Debug Mode**: Extensive logs only when `NEXT_PUBLIC_DEBUG_SUPABASE=true`
3. **Client-Side Only**: Profile fetching runs only in browser, never server-side
4. **No Service Role Exposure**: Service role key never used in client code
5. **Safe Error Logging**: Never throws exceptions during logging
6. **RLS Respected**: All queries go through Supabase client with user tokens

### ⚠️ Important Warnings

1. **Never log full tokens in production**: Always mask tokens
2. **Never commit `.env.local`**: Use `.env.example` templates only
3. **Never expose service_role key**: Only use server-side in secure environments
4. **Disable debug mode in production**: Set `NEXT_PUBLIC_DEBUG_SUPABASE=false`
5. **Monitor RLS policies**: Ensure they're not accidentally disabled

---

## Next Steps

### 1. Test the Fix

Follow all verification steps above and confirm:
- [ ] No runtime exceptions when logging errors
- [ ] Profile fetches successfully after registration
- [ ] Console logs are structured and readable (in debug mode)
- [ ] Network errors trigger retry logic
- [ ] Client-side guard prevents SSR issues

### 2. Verify RLS Policies

Run this query in Supabase SQL Editor:

```sql
-- List all policies on profiles table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

Verify you have policies like:
- `SELECT` policy: `(auth.uid() = id)`
- `UPDATE` policy: `(auth.uid() = id)`

### 3. Monitor Production

After deploying:
1. Set `NEXT_PUBLIC_DEBUG_SUPABASE=false` in production
2. Monitor error logs for any remaining issues
3. Check Supabase Dashboard > Logs for API errors
4. Set up error tracking (e.g., Sentry) for production errors

### 4. Optional Enhancements

Consider these follow-up improvements:
- [ ] Add error tracking service (Sentry, LogRocket, etc.)
- [ ] Add custom error boundary component for auth errors
- [ ] Implement exponential backoff for network retries
- [ ] Add user-facing error messages (not just console logs)
- [ ] Add performance monitoring for slow queries

---

## Summary of Changes

### Files Modified

1. **`lib/supabase/client.ts`** (42 lines)
   - Added debug logging for client creation
   - Added explicit auth configuration
   - Added token masking utility

2. **`lib/auth-context.tsx`** (563 lines)
   - Added 5 safe logging utility functions
   - Completely rewrote `fetchUserProfile()` with extensive logging
   - Added client-side execution guard
   - Added network error retry logic
   - Added structured console.group logging
   - Made all error logging safe (never throws)

3. **`app/auth/register/page.tsx`** (no changes)
   - Already uses auth context correctly
   - Retry logic in context handles race conditions

### Bug Fixes

1. ✅ **Prevented runtime exceptions** from accessing properties on null/undefined errors
2. ✅ **Added client-side execution guard** to prevent SSR issues
3. ✅ **Added comprehensive debugging** with structured, collapsible logs
4. ✅ **Added network retry logic** for transient failures
5. ✅ **Enhanced PGRST116 retry logic** with better logging
6. ✅ **Added token masking** for secure logging
7. ✅ **Added timing information** for performance debugging

---

## Testing Checklist

- [ ] Registration flow works without errors
- [ ] Login flow works without errors
- [ ] Profile fetch succeeds after registration (with retries if needed)
- [ ] Console logs are structured and readable in debug mode
- [ ] No runtime exceptions when logging errors
- [ ] Client-side guard prevents server-side execution
- [ ] Network errors trigger retry logic
- [ ] Tokens are properly masked in logs
- [ ] Curl commands work with user token
- [ ] Curl commands work with service role key
- [ ] RLS policies are correctly enforced
- [ ] Debug mode can be toggled via env var

---

**Last Updated**: 2025-11-24
**Supabase JS Version**: v2.84.0
**Next.js Version**: v15.2.4
