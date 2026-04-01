CREATE TABLE IF NOT EXISTS public.browser_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  locale TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS browser_push_subscriptions_user_idx
  ON public.browser_push_subscriptions (user_id, updated_at DESC);

ALTER TABLE public.browser_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own browser push subscriptions" ON public.browser_push_subscriptions;
CREATE POLICY "Users can view own browser push subscriptions"
  ON public.browser_push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
