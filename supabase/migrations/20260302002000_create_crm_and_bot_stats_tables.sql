-- Migration: CRM lead tracking + contact timeline events
-- Created: 2026-03-02

ALTER TABLE public.bot_subscribers
  ADD COLUMN IF NOT EXISTS lead_stage TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS lead_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS lead_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lead_stage_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_incoming_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS last_outgoing_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS inbound_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outbound_count BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_subscribers_lead_stage_check'
      AND conrelid = 'public.bot_subscribers'::regclass
  ) THEN
    ALTER TABLE public.bot_subscribers
      ADD CONSTRAINT bot_subscribers_lead_stage_check
      CHECK (lead_stage IN ('new', 'contacted', 'qualified', 'won', 'lost'));
  END IF;
END;
$$;

UPDATE public.bot_subscribers
SET
  lead_stage = COALESCE(NULLIF(lead_stage, ''), 'new'),
  lead_stage_updated_at = COALESCE(lead_stage_updated_at, first_seen_at, created_at, NOW())
WHERE lead_stage IS NULL
   OR lead_stage = ''
   OR lead_stage_updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bot_subscribers_bot_stage_last_seen
  ON public.bot_subscribers (bot_id, lead_stage, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_subscribers_bot_last_incoming
  ON public.bot_subscribers (bot_id, last_incoming_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_subscribers_bot_last_outgoing
  ON public.bot_subscribers (bot_id, last_outgoing_at DESC);

CREATE TABLE IF NOT EXISTS public.bot_contact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NULL,
  direction TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  message_text TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT bot_contact_events_direction_check
    CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT bot_contact_events_event_kind_check
    CHECK (event_kind IN ('message_text', 'callback', 'media', 'service'))
);

CREATE INDEX IF NOT EXISTS idx_bot_contact_events_bot_created_at
  ON public.bot_contact_events (bot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_contact_events_bot_user_created_at
  ON public.bot_contact_events (bot_id, telegram_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_contact_events_bot_direction_created_at
  ON public.bot_contact_events (bot_id, direction, created_at DESC);

ALTER TABLE public.bot_contact_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view contact events of own bots" ON public.bot_contact_events;
CREATE POLICY "Users can view contact events of own bots"
  ON public.bot_contact_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE public.bots.id = public.bot_contact_events.bot_id
        AND public.bots.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert contact events for own bots" ON public.bot_contact_events;
CREATE POLICY "Users can insert contact events for own bots"
  ON public.bot_contact_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE public.bots.id = public.bot_contact_events.bot_id
        AND public.bots.user_id = auth.uid()
    )
  );
