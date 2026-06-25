-- =============================================================================
-- Beer Game — Migration: admin password + allow_self_start
-- Run in Supabase Dashboard → SQL Editor → New query
-- =============================================================================

ALTER TABLE public.session_settings
  ADD COLUMN IF NOT EXISTS admin_password   TEXT    NOT NULL DEFAULT 'beergame2026',
  ADD COLUMN IF NOT EXISTS allow_self_start BOOLEAN NOT NULL DEFAULT TRUE;

-- Ensure the single settings row has the defaults
UPDATE public.session_settings
SET
  admin_password   = COALESCE(admin_password,   'beergame2026'),
  allow_self_start = COALESCE(allow_self_start,  TRUE)
WHERE id = 1;
