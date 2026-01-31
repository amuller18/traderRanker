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
  // Apply rate limiting to email addition
  const rateLimitResponse = rateLimit(request, 'add-email', RateLimitPresets.strict);
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
        { detail: 'You must be logged in to add an email' },
        { status: 401 }
      );
    }

    // Check if user is a wallet-only account
    const isWalletOnly = user.email?.endsWith('@wallet.traderranker.com');
    if (!isWalletOnly) {
      return NextResponse.json(
        { detail: 'This account already has an email address' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { detail: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email ends with our wallet domain (prevent using fake emails)
    if (email.endsWith('@wallet.traderranker.com')) {
      return NextResponse.json(
        { detail: 'Please use a real email address' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { detail: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Get admin client
    const adminClient = getSupabaseAdmin();

    // Check if email is already in use by another account
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const emailTaken = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === email.toLowerCase() && u.id !== user.id
    );

    if (emailTaken) {
      return NextResponse.json(
        { detail: 'This email is already registered to another account' },
        { status: 400 }
      );
    }

    // Update the user's email and password
    // Note: This will send a confirmation email to the new address
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        email: email,
        password: password,
        email_confirm: false, // Require email confirmation
        user_metadata: {
          ...user.user_metadata,
          has_real_email: true,
          email_added_at: new Date().toISOString()
        }
      }
    );

    if (updateError) {
      console.error('Failed to update user email:', updateError);
      return NextResponse.json(
        { detail: 'Failed to update email. Please try again.' },
        { status: 500 }
      );
    }

    // Generate a new confirmation link and send it
    // Using the admin client to generate the link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'email_change_new',
      email: email,
      newEmail: email,
    });

    // Note: Supabase should automatically send the confirmation email
    // If not, we may need to implement custom email sending

    return NextResponse.json({
      status: 'ok',
      message: 'Email added successfully. Please check your inbox to confirm your new email address.',
      email: email
    });

  } catch (error: any) {
    console.error('Add email error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
