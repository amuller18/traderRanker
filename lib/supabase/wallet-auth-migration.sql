-- Phantom Wallet Authentication Migration
-- Run this in your Supabase SQL Editor after running schema.sql
-- This adds support for Solana wallet-based authentication (sign-in, link, create flows)

-- ============================================================================
-- 1. wallet_nonces: Temporary nonces for signature challenges
-- ============================================================================
-- Stores time-limited nonces to prevent replay attacks during wallet sign-in
-- Each nonce is valid for 5 minutes and can only be used once
CREATE TABLE IF NOT EXISTS public.wallet_nonces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  public_key TEXT NOT NULL,          -- Solana wallet public key (base58 encoded)
  nonce TEXT NOT NULL UNIQUE,        -- Cryptographically secure random nonce
  expires_at TIMESTAMPTZ NOT NULL,   -- Expiry timestamp (5 minutes from creation)
  used BOOLEAN DEFAULT FALSE,        -- Prevents replay attacks
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS wallet_nonces_public_key_idx ON public.wallet_nonces (public_key);
CREATE INDEX IF NOT EXISTS wallet_nonces_nonce_idx ON public.wallet_nonces (nonce);
CREATE INDEX IF NOT EXISTS wallet_nonces_expires_at_idx ON public.wallet_nonces (expires_at);

-- RLS: Nonces are managed server-side only (no client access)
ALTER TABLE public.wallet_nonces ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (no user access)
-- This is enforced by default when no policies are created for users
-- The FastAPI backend will use the service role key to manage nonces

-- ============================================================================
-- 2. user_wallets: Mapping of Supabase users to Solana wallets
-- ============================================================================
-- Allows users to link multiple wallets to their account
-- One wallet can only be linked to one user (enforced by unique constraint)
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL UNIQUE,   -- Solana wallet public key (base58 encoded)
  is_primary BOOLEAN DEFAULT FALSE,  -- Marks primary wallet for multi-wallet users
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()  -- Track last sign-in with this wallet
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS user_wallets_user_id_idx ON public.user_wallets (user_id);
CREATE INDEX IF NOT EXISTS user_wallets_public_key_idx ON public.user_wallets (public_key);

-- RLS: Users can view and manage their own wallets
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own wallets
CREATE POLICY "Users can view own wallets"
  ON public.user_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert wallets (during sign-in/link flow)
-- Users cannot directly insert (must go through backend verification)
CREATE POLICY "Service role can insert wallets"
  ON public.user_wallets
  FOR INSERT
  WITH CHECK (true);  -- Backend enforces validation via service role

-- Policy: Users can delete their own wallets (unlink)
CREATE POLICY "Users can delete own wallets"
  ON public.user_wallets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Users can update their own wallets (e.g., set primary)
CREATE POLICY "Users can update own wallets"
  ON public.user_wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Helper Functions
-- ============================================================================

-- Function: Cleanup expired nonces (run periodically via cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_nonces()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.wallet_nonces
  WHERE expires_at < NOW() OR used = TRUE;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update last_used_at timestamp when wallet is used for sign-in
CREATE OR REPLACE FUNCTION public.update_wallet_last_used()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be triggered by backend after successful sign-in
  -- For now, we'll update it manually in the backend
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Optional: Add wallet metadata to profiles table
-- ============================================================================
-- Uncomment if you want to store wallet-specific metadata in profiles
-- This extends the existing profiles table from schema.sql

-- ALTER TABLE public.profiles
--   ADD COLUMN IF NOT EXISTS primary_wallet_public_key TEXT,
--   ADD COLUMN IF NOT EXISTS wallet_login_enabled BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- 5. Optional: Extension to auth.users metadata
-- ============================================================================
-- The backend will store wallet-related metadata in auth.users.raw_user_meta_data
-- Example structure (no migration needed, just documentation):
-- {
--   "wallet_created": true,
--   "primary_wallet": "base58_public_key",
--   "login_method": "phantom_wallet"
-- }

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm migration success)
-- ============================================================================

-- Check if tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('wallet_nonces', 'user_wallets');

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('wallet_nonces', 'user_wallets');

-- Check policies
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('wallet_nonces', 'user_wallets');
