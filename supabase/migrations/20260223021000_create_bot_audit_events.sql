-- Migration: bot audit events for support/admin visibility
-- Created: 2026-02-23

CREATE TABLE IF NOT EXISTS bot_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'system',
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_audit_events_bot_id_created_at
  ON bot_audit_events (bot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_audit_events_event_type
  ON bot_audit_events (event_type, created_at DESC);

ALTER TABLE bot_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit events of own bots"
  ON bot_audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_audit_events.bot_id
        AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert audit events for own bots"
  ON bot_audit_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_audit_events.bot_id
        AND bots.user_id = auth.uid()
    )
  );
