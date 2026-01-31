import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
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

export async function POST(request: NextRequest) {
  // Apply rate limiting to wallet unlinking
  const rateLimitResponse = rateLimit(request, 'wallet-unlink', RateLimitPresets.auth);
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
        { detail: 'You must be logged in to unlink a wallet' },
        { status: 401 }
      );
    }

    // Check if user is wallet-only (has fake email)
    const isWalletOnly = user.email?.endsWith('@wallet.traderranker.com');
    if (isWalletOnly) {
      return NextResponse.json(
        { detail: 'Cannot disconnect wallet. Please add an email first to keep access to your account.' },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseAdmin();

    // Delete all wallets for this user from user_wallets table
    const { error: walletError } = await adminClient
      .from('user_wallets')
      .delete()
      .eq('user_id', user.id);

    if (walletError) {
      console.error('Failed to delete from user_wallets:', walletError);
      // Continue anyway to clear profile
    }

    // Clear wallet from profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        wallet_address: null,
        wallet_pubkeys: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
      return NextResponse.json(
        { detail: 'Failed to disconnect wallet. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Wallet disconnected successfully'
    });

  } catch (error: any) {
    console.error('Wallet unlink error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
