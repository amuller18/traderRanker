-- Create audit_logs table for tracking user actions and security events
-- Run this migration in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON public.audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON public.audit_logs(session_id);

-- Composite index for security queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_security
ON public.audit_logs(action, ip_address, created_at DESC)
WHERE action IN ('api.rate_limited', 'security.suspicious_activity');

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (from backend)
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Only service role can read (admin dashboard)
CREATE POLICY "Service role can read audit logs"
ON public.audit_logs
FOR SELECT
TO service_role
USING (true);

-- Users can read their own audit logs
CREATE POLICY "Users can read own audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.audit_logs IS 'Audit trail for user actions and security events';
COMMENT ON COLUMN public.audit_logs.action IS 'Action type (e.g., user.login, wallet.connect)';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional action-specific data';

-- Auto-cleanup old logs (optional - keep 90 days by default)
-- Uncomment to enable automatic cleanup
/*
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * *', 'SELECT cleanup_old_audit_logs()');
*/
