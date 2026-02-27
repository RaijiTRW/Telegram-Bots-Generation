-- Migration: bot subscribers tracking
-- Created: 2026-02-27

CREATE TABLE IF NOT EXISTS bot_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_subscribers_bot_id_last_seen
  ON bot_subscribers (bot_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_subscribers_telegram_user_id
  ON bot_subscribers (telegram_user_id);

ALTER TABLE bot_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subscribers of own bots"
  ON bot_subscribers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_subscribers.bot_id
        AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert subscribers for own bots"
  ON bot_subscribers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_subscribers.bot_id
        AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subscribers of own bots"
  ON bot_subscribers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_subscribers.bot_id
        AND bots.user_id = auth.uid()
    )
  );
