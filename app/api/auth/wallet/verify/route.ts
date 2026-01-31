import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import crypto from 'crypto';
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

// Generate a deterministic password from wallet signature
// This allows the user to sign in again by signing the same way
function derivePassword(publicKey: string, signature: string): string {
  const hash = crypto.createHash('sha256')
    .update(publicKey + signature)
    .digest('hex');
  return hash.slice(0, 32); // Use first 32 chars as password
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
  // Apply rate limiting to wallet verification
  const rateLimitResponse = rateLimit(request, 'wallet-verify', RateLimitPresets.auth);
  if (rateLimitResponse) return rateLimitResponse;

  try {
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

    // Step 3: Check if wallet is already linked to a user
    const { data: walletRecord } = await adminClient
      .from('user_wallets')
      .select('*')
      .eq('public_key', public_key)
      .single();

    let userId: string;
    let createdNewUser = false;
    const walletEmail = `${public_key}@wallet.traderranker.com`;
    const walletPassword = derivePassword(public_key, signature);

    if (walletRecord) {
      // Wallet already linked - sign in existing user
      userId = walletRecord.user_id;

      // Update last_used_at
      await adminClient
        .from('user_wallets')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', walletRecord.id);

      // Update user's password to current derived password (in case signature differs)
      await adminClient.auth.admin.updateUserById(userId, {
        password: walletPassword
      });

    } else {
      // Create new user with wallet
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: walletEmail,
        password: walletPassword,
        email_confirm: true,
        user_metadata: {
          wallet_created: true,
          primary_wallet: public_key,
          login_method: 'phantom_wallet'
        }
      });

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError);
        return NextResponse.json(
          { detail: 'Failed to create user account. Please try again.' },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
      createdNewUser = true;

      // Link wallet to new user
      const { error: linkError } = await adminClient
        .from('user_wallets')
        .insert({
          user_id: userId,
          public_key,
          is_primary: true
        });

      if (linkError) {
        console.error('Failed to link wallet:', linkError);
        return NextResponse.json(
          { detail: 'Failed to link wallet to account. Please try again.' },
          { status: 500 }
        );
      }

      // Create profile for new user
      // Generate username from wallet address (first 8 chars)
      const username = `wallet_${public_key.slice(0, 8)}`;

      await adminClient
        .from('profiles')
        .upsert({
          id: userId,
          username: username,
          wallet_address: public_key,
          wallet_pubkeys: public_key,
          updated_at: new Date().toISOString()
        });
    }

    // Mark nonce as used
    await adminClient
      .from('wallet_nonces')
      .update({ used: true })
      .eq('id', nonceRecord.id);

    // Create a session by signing in with the derived credentials
    // Use anon key for sign-in since admin client can't create sessions
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false } }
    );

    const { data: sessionData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: walletEmail,
      password: walletPassword
    });

    if (signInError || !sessionData.session) {
      console.error('Failed to create session:', signInError);
      return NextResponse.json(
        { detail: 'Authentication successful but session creation failed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      created_new_user: createdNewUser,
      linked_to_existing_session: false,
      user_id: userId,
      email: walletEmail,
      user_metadata: sessionData.user?.user_metadata || {},
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      message: createdNewUser
        ? 'Account created successfully. Welcome!'
        : 'Sign-in successful. Welcome back!'
    });

  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
