-- Migration: Create bots and bot_configs tables
-- Created: 2025-02-12

-- Create bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'error')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bot_configs table for workflow data
CREATE TABLE IF NOT EXISTS bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_RANDOM_UUID(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  variables JSONB DEFAULT '[]',
  version VARCHAR(50) DEFAULT '1.0.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bot_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
CREATE INDEX IF NOT EXISTS idx_bots_created_at ON bots(created_at DESC);

-- Enable Row Level Security
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own bots
CREATE POLICY "Users can view own bots"
  ON bots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bots"
  ON bots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bots"
  ON bots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bots"
  ON bots FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for bot_configs (through bots relationship)
CREATE POLICY "Users can view configs of own bots"
  ON bot_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_configs.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert configs for own bots"
  ON bot_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_configs.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update configs of own bots"
  ON bot_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_configs.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete configs of own bots"
  ON bot_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_configs.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_configs_updated_at
  BEFORE UPDATE ON bot_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
