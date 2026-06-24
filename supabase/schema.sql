-- =============================================================================
-- Beer Game — Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ── Games table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.games (
  id          TEXT   PRIMARY KEY,
  code        TEXT   UNIQUE NOT NULL,
  host_id     TEXT,
  config      JSONB  NOT NULL DEFAULT '{}',
  state       JSONB  NOT NULL DEFAULT '{}',
  players     JSONB  NOT NULL DEFAULT '{}',
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS games_code_idx ON public.games (code);

-- ── Session settings (single row) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_settings (
  id                INT     PRIMARY KEY DEFAULT 1,
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  game_config       JSONB   DEFAULT NULL,
  event_name        TEXT    NOT NULL DEFAULT 'Beer Game',
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.session_settings (id, registration_open, event_name)
VALUES (1, TRUE, 'Beer Game')
ON CONFLICT (id) DO NOTHING;

-- ── Disable RLS (tighten for production) ─────────────────────────────────────
ALTER TABLE public.games            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_settings DISABLE ROW LEVEL SECURITY;

-- ── Enable Realtime replication ───────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_settings;
