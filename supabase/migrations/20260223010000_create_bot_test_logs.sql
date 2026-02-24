-- Migration: persistent bot test logs for support/admin observability
-- Created: 2026-02-23

CREATE TABLE IF NOT EXISTS bot_test_logs (
  id TEXT PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  run_id TEXT,
  ts_ms BIGINT NOT NULL,
  ts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  level VARCHAR(20) NOT NULL DEFAULT 'info'
    CHECK (level IN ('info', 'warn', 'error', 'debug')),
  source VARCHAR(50) NOT NULL DEFAULT 'system',
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_test_logs_bot_id_ts_ms
  ON bot_test_logs (bot_id, ts_ms DESC);

CREATE INDEX IF NOT EXISTS idx_bot_test_logs_bot_id_run_id_ts_ms
  ON bot_test_logs (bot_id, run_id, ts_ms DESC);

CREATE INDEX IF NOT EXISTS idx_bot_test_logs_created_at
  ON bot_test_logs (created_at DESC);

ALTER TABLE bot_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of own bots"
  ON bot_test_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_test_logs.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert logs for own bots"
  ON bot_test_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_test_logs.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete logs of own bots"
  ON bot_test_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_test_logs.bot_id
      AND bots.user_id = auth.uid()
    )
  );
