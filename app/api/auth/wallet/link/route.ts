import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit';

// Lazy-create admin client to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseAdmin;
}

function verifySignature(
  publicKeyBase58: string,
  message: string,
  signatureBase64: string
): { valid: boolean; error?: string } {
  try {
    // Decode the public key from base58
    const publicKey = bs58.decode(publicKeyBase58);

    // Encode the message as bytes
    const messageBytes = new TextEncoder().encode(message);

    // Decode the signature from base64
    const signature = Buffer.from(signatureBase64, 'base64');

    // Verify using tweetnacl (Ed25519)
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      new Uint8Array(signature),
      new Uint8Array(publicKey)
    );

    if (!isValid) {
      return { valid: false, error: 'Signature verification failed' };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: `Signature verification error: ${error.message}` };
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting to wallet linking
  const rateLimitResponse = await rateLimit(request, 'wallet-link', RateLimitPresets.auth);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Get the authenticated user from the session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore in server context
            }
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { detail: 'You must be logged in to link a wallet' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { public_key, signature, nonce } = body;

    // Validate required fields
    if (!public_key || !signature || !nonce) {
      return NextResponse.json(
        { detail: 'Missing required fields: public_key, signature, nonce' },
        { status: 400 }
      );
    }

    // Get admin client
    const adminClient = getSupabaseAdmin();

    // Step 1: Validate nonce exists and is not expired/used
    const { data: nonceRecord, error: nonceError } = await adminClient
      .from('wallet_nonces')
      .select('*')
      .eq('public_key', public_key)
      .eq('nonce', nonce)
      .single();

    if (nonceError || !nonceRecord) {
      return NextResponse.json(
        { detail: 'Invalid or expired nonce. Please request a new nonce.' },
        { status: 401 }
      );
    }

    if (nonceRecord.used) {
      return NextResponse.json(
        { detail: 'Nonce has already been used. Please request a new nonce.' },
        { status: 401 }
      );
    }

    // Check if nonce is expired
    const expiresAt = new Date(nonceRecord.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { detail: 'Nonce has expired. Please request a new nonce.' },
        { status: 401 }
      );
    }

    // Step 2: Verify signature
    const verification = verifySignature(public_key, nonce, signature);
    if (!verification.valid) {
      return NextResponse.json(
        { detail: verification.error },
        { status: 401 }
      );
    }

    // Step 3: Check if wallet is already linked to another user
    const { data: existingWallet } = await adminClient
      .from('user_wallets')
      .select('*')
      .eq('public_key', public_key)
      .single();

    if (existingWallet) {
      if (existingWallet.user_id === user.id) {
        // Wallet already linked to this user - return success (idempotent)
        // Also make sure profile has the wallet data
        await adminClient
          .from('profiles')
          .update({
            wallet_address: public_key,
            wallet_pubkeys: public_key,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        // Mark nonce as used
        await adminClient
          .from('wallet_nonces')
          .update({ used: true })
          .eq('id', nonceRecord.id);

        return NextResponse.json({
          status: 'ok',
          message: 'Wallet is already linked to your account',
          public_key,
          is_primary: existingWallet.is_primary
        });
      } else {
        return NextResponse.json(
          { detail: 'This wallet is already linked to another account' },
          { status: 400 }
        );
      }
    }

    // Step 4: Check if user already has a wallet linked
    const { data: userWallets } = await adminClient
      .from('user_wallets')
      .select('*')
      .eq('user_id', user.id);

    const hasPrimaryWallet = userWallets && userWallets.some(w => w.is_primary);

    // Step 5: Link wallet to user
    const { error: linkError } = await adminClient
      .from('user_wallets')
      .insert({
        user_id: user.id,
        public_key,
        is_primary: !hasPrimaryWallet // Make primary if no other wallet
      });

    if (linkError) {
      console.error('Failed to link wallet:', linkError);
      return NextResponse.json(
        { detail: 'Failed to link wallet. Please try again.' },
        { status: 500 }
      );
    }

    // Step 6: Update profile with wallet address
    await adminClient
      .from('profiles')
      .update({
        wallet_address: public_key,
        wallet_pubkeys: public_key,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Mark nonce as used
    await adminClient
      .from('wallet_nonces')
      .update({ used: true })
      .eq('id', nonceRecord.id);

    return NextResponse.json({
      status: 'ok',
      message: 'Wallet linked successfully',
      public_key,
      is_primary: !hasPrimaryWallet
    });

  } catch (error: any) {
    console.error('Wallet linking error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
