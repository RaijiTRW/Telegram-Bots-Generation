-- Migration: encrypted bot secrets storage
-- Created: 2026-02-23

CREATE TABLE IF NOT EXISTS bot_secrets (
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  secret_name TEXT NOT NULL CHECK (secret_name IN ('telegram_token', 'webhook_secret')),
  algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_version INTEGER NOT NULL DEFAULT 1,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bot_id, secret_name)
);

CREATE INDEX IF NOT EXISTS idx_bot_secrets_bot_id
  ON bot_secrets (bot_id);

ALTER TABLE bot_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view secrets of own bots"
  ON bot_secrets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_secrets.bot_id
        AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert secrets for own bots"
  ON bot_secrets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_secrets.bot_id
        AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update secrets of own bots"
  ON bot_secrets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_secrets.bot_id
        AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete secrets of own bots"
  ON bot_secrets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_secrets.bot_id
        AND bots.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE TRIGGER update_bot_secrets_updated_at
      BEFORE UPDATE ON bot_secrets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
