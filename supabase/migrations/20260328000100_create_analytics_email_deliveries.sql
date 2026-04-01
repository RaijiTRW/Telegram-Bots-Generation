CREATE TABLE IF NOT EXISTS public.analytics_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('weekly_digest', 'monthly_summary', 'anomaly_alert')),
  period_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  delivery_channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_email_deliveries_unique_delivery
  ON public.analytics_email_deliveries (user_id, kind, period_key, fingerprint);

CREATE INDEX IF NOT EXISTS analytics_email_deliveries_user_created_idx
  ON public.analytics_email_deliveries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_email_deliveries_kind_status_idx
  ON public.analytics_email_deliveries (kind, status, created_at DESC);

ALTER TABLE public.analytics_email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analytics email deliveries" ON public.analytics_email_deliveries;
CREATE POLICY "Users can view own analytics email deliveries"
  ON public.analytics_email_deliveries FOR SELECT
  USING (auth.uid() = user_id);
