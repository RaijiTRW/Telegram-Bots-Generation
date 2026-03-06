-- Migration: analytics tables for admin dashboard
-- Adds:
-- 1) user_presence (online signal)
-- 2) landing_page_views (landing view events)

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  locale TEXT,
  page_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS user_presence_last_seen_idx ON public.user_presence(last_seen_at DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own presence" ON public.user_presence;
CREATE POLICY "Users can view own presence"
  ON public.user_presence FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own presence" ON public.user_presence;
CREATE POLICY "Users can insert own presence"
  ON public.user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own presence" ON public.user_presence;
CREATE POLICY "Users can update own presence"
  ON public.user_presence FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all presence" ON public.user_presence;
CREATE POLICY "Admins can view all presence"
  ON public.user_presence FOR SELECT
  USING (public.is_current_user_admin());

DROP TRIGGER IF EXISTS user_presence_set_updated_at ON public.user_presence;
CREATE TRIGGER user_presence_set_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.landing_page_views (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locale TEXT,
  path TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS landing_page_views_created_at_idx ON public.landing_page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS landing_page_views_session_idx ON public.landing_page_views(session_id);

ALTER TABLE public.landing_page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view landing page views" ON public.landing_page_views;
CREATE POLICY "Admins can view landing page views"
  ON public.landing_page_views FOR SELECT
  USING (public.is_current_user_admin());

