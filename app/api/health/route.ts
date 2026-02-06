import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'unknown',
  }

  // Check Supabase connectivity
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  health.supabase = supabaseUrl ? 'configured' : 'missing'

  // Check Stripe configuration
  health.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing'

  // Check backend API connectivity
  const backendUrl = process.env.NEXT_PUBLIC_PI_API_BASE || process.env.NEXT_PUBLIC_API_URL
  if (backendUrl) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`${backendUrl}/health`, { signal: controller.signal })
      clearTimeout(timeout)
      health.backend = res.ok ? 'ok' : `error:${res.status}`
    } catch {
      health.backend = 'unreachable'
    }
  } else {
    health.backend = 'not_configured'
  }

  const allOk = health.supabase === 'configured' && health.backend !== 'unreachable'
  const status = allOk ? 200 : 503

  return NextResponse.json(health, { status })
}
