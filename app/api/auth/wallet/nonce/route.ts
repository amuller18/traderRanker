import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

function validatePublicKey(publicKey: string): { valid: boolean; error?: string } {
  if (!publicKey || typeof publicKey !== 'string') {
    return { valid: false, error: 'Public key is required' };
  }

  // Solana public keys are 32-44 characters base58 encoded
  if (publicKey.length < 32 || publicKey.length > 44) {
    return { valid: false, error: 'Invalid public key length' };
  }

  // Check for valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(publicKey)) {
    return { valid: false, error: 'Invalid public key format (not base58)' };
  }

  return { valid: true };
}

function generateNonce(): string {
  // Generate 32 random bytes and encode as hex
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  // Apply strict rate limiting to nonce generation
  const rateLimitResponse = await rateLimit(request, 'wallet-nonce', RateLimitPresets.strict);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { public_key } = body;

    // Validate public key
    const validation = validatePublicKey(public_key);
    if (!validation.valid) {
      return NextResponse.json(
        { detail: validation.error },
        { status: 400 }
      );
    }

    // Generate nonce
    const nonce = generateNonce();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Get admin client
    const adminClient = getSupabaseAdmin();

    // Store nonce in database
    const { data, error } = await adminClient
      .from('wallet_nonces')
      .insert({
        public_key,
        nonce,
        expires_at: expiresAt.toISOString(),
        used: false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create nonce:', error);
      return NextResponse.json(
        { detail: 'Failed to generate nonce. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      nonce,
      expires_at: expiresAt.toISOString(),
      message: `Sign this message to authenticate with TraderRanker: ${nonce}`
    });

  } catch (error) {
    console.error('Nonce generation error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
