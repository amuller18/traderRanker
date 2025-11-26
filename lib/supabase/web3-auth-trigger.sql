-- Trigger to automatically update profiles.wallet_pubkeys when user signs in with Web3
-- Run this in your Supabase SQL Editor

-- Function to extract wallet address from Web3 identity and update profile
CREATE OR REPLACE FUNCTION public.handle_web3_identity()
RETURNS TRIGGER AS $$
DECLARE
  wallet_address TEXT;
BEGIN
  -- Check if this is a Web3 identity (Solana or Ethereum)
  IF NEW.provider = 'web3' THEN
    -- Extract the wallet address from identity_data
    -- For Solana/Ethereum, the address is in identity_data.sub
    wallet_address := NEW.identity_data->>'sub';

    IF wallet_address IS NOT NULL THEN
      -- Update the user's profile with the wallet address
      UPDATE public.profiles
      SET
        wallet_pubkeys = wallet_address,
        wallet_address = wallet_address,  -- Also update legacy field
        updated_at = NOW()
      WHERE id = NEW.user_id;

      -- If profile doesn't exist yet, it will be created by handle_new_user trigger
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_web3_identity_created ON auth.identities;

-- Create trigger that fires after a new Web3 identity is inserted
CREATE TRIGGER on_web3_identity_created
  AFTER INSERT ON auth.identities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_web3_identity();

-- Also update the handle_new_user function to handle Web3 users
-- This ensures Web3 users get a profile created with their wallet address
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  wallet_address TEXT;
BEGIN
  -- Extract wallet address from user metadata if it exists (for Web3 users)
  wallet_address := NEW.raw_user_meta_data->>'wallet_address';

  -- If no wallet address in metadata, try to get it from email (Web3 users use wallet@web3.io format)
  IF wallet_address IS NULL AND NEW.email LIKE '%@web3.io' THEN
    wallet_address := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, username, full_name, wallet_pubkeys, wallet_address)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    wallet_address,
    wallet_address
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification query to check if triggers are installed
-- SELECT
--   trigger_name,
--   event_object_table,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name IN ('on_web3_identity_created', 'on_auth_user_created');
