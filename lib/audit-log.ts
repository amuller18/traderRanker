import { createClient } from '@supabase/supabase-js'

// Activity types for audit logging
export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.signup'
  | 'user.password_change'
  | 'user.email_change'
  | 'wallet.connect'
  | 'wallet.disconnect'
  | 'wallet.link'
  | 'wallet.unlink'
  | 'favorite.add'
  | 'favorite.remove'
  | 'subscription.checkout_start'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'api.rate_limited'
  | 'security.suspicious_activity'

export interface AuditLogEntry {
  action: AuditAction
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  success: boolean
  errorMessage?: string
}

// Get admin client for audit logging
let supabaseAdmin: ReturnType<typeof createClient> | null = null

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Audit logging disabled: Missing Supabase environment variables')
      return null
    }

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })
  }
  return supabaseAdmin
}

// Log an audit event
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const adminClient = getSupabaseAdmin()
    if (!adminClient) {
      // Fallback to console logging if Supabase not available
      console.log('[AUDIT]', JSON.stringify(entry))
      return
    }

    // Use type assertion since audit_logs is a new table not in generated types
    const { error } = await (adminClient as any)
      .from('audit_logs')
      .insert({
        action: entry.action,
        user_id: entry.userId || null,
        session_id: entry.sessionId || null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        metadata: entry.metadata || {},
        success: entry.success,
        error_message: entry.errorMessage || null,
        created_at: new Date().toISOString()
      })

    if (error) {
      // Don't throw - audit logging should not break the main flow
      console.error('[AUDIT] Failed to log event:', error.message)
      // Fallback to console
      console.log('[AUDIT]', JSON.stringify(entry))
    }
  } catch (err) {
    // Never let audit logging break the application
    console.error('[AUDIT] Error:', err)
    console.log('[AUDIT]', JSON.stringify(entry))
  }
}

// Helper to extract request info for audit logging
export function extractRequestInfo(request: Request): {
  ipAddress: string
  userAgent: string
  sessionId?: string
} {
  const headers = request.headers

  // Get IP from various headers
  const forwarded = headers.get('x-forwarded-for')
  const vercelForwardedFor = headers.get('x-vercel-forwarded-for')
  const cfConnectingIp = headers.get('cf-connecting-ip')
  const realIp = headers.get('x-real-ip')

  const ipAddress = vercelForwardedFor?.split(',')[0]?.trim()
    || cfConnectingIp
    || forwarded?.split(',')[0]?.trim()
    || realIp
    || 'unknown'

  const userAgent = headers.get('user-agent') || 'unknown'

  // Try to get session ID from cookie header
  const cookieHeader = headers.get('cookie') || ''
  const sessionMatch = cookieHeader.match(/tr_session_id=([^;]+)/)
  const sessionId = sessionMatch?.[1]

  return { ipAddress, userAgent, sessionId }
}

// Convenience functions for common audit events
export const AuditLog = {
  async userLogin(userId: string, request: Request, success: boolean, errorMessage?: string) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'user.login',
      userId,
      sessionId,
      ipAddress,
      userAgent,
      success,
      errorMessage
    })
  },

  async userSignup(userId: string, request: Request, metadata?: Record<string, unknown>) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'user.signup',
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata,
      success: true
    })
  },

  async walletConnect(userId: string | undefined, publicKey: string, request: Request, success: boolean) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'wallet.connect',
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: { publicKey: publicKey.substring(0, 8) + '...' },
      success
    })
  },

  async walletLink(userId: string, publicKey: string, request: Request, success: boolean) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'wallet.link',
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: { publicKey: publicKey.substring(0, 8) + '...' },
      success
    })
  },

  async walletUnlink(userId: string, request: Request, success: boolean) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'wallet.unlink',
      userId,
      sessionId,
      ipAddress,
      userAgent,
      success
    })
  },

  async favoriteAdd(userId: string, itemType: string, itemId: string, request: Request) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'favorite.add',
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: { itemType, itemId: itemId.substring(0, 8) + '...' },
      success: true
    })
  },

  async favoriteRemove(userId: string, itemType: string, itemId: string, request: Request) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'favorite.remove',
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: { itemType, itemId: itemId.substring(0, 8) + '...' },
      success: true
    })
  },

  async subscriptionEvent(
    action: 'subscription.checkout_start' | 'subscription.created' | 'subscription.updated' | 'subscription.cancelled',
    userId: string,
    request: Request,
    metadata?: Record<string, unknown>
  ) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata,
      success: true
    })
  },

  async rateLimited(request: Request, routeKey: string) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'api.rate_limited',
      sessionId,
      ipAddress,
      userAgent,
      metadata: { route: routeKey },
      success: false,
      errorMessage: 'Rate limit exceeded'
    })
  },

  async suspiciousActivity(request: Request, reason: string, metadata?: Record<string, unknown>) {
    const { ipAddress, userAgent, sessionId } = extractRequestInfo(request)
    await logAuditEvent({
      action: 'security.suspicious_activity',
      sessionId,
      ipAddress,
      userAgent,
      metadata: { reason, ...metadata },
      success: false,
      errorMessage: reason
    })
  }
}
