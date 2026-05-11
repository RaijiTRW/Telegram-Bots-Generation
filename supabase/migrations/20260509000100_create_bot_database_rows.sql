-- Migration: bot database rows
-- Created: 2026-05-09

CREATE TABLE IF NOT EXISTS public.bot_database_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  row_key TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_name TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT bot_database_rows_row_key_not_blank CHECK (btrim(row_key) <> ''),
  CONSTRAINT bot_database_rows_row_key_length CHECK (char_length(row_key) <= 64),
  CONSTRAINT bot_database_rows_row_key_format CHECK (row_key ~ '^[A-Za-z0-9_-]+$'),
  CONSTRAINT bot_database_rows_bot_key_unique UNIQUE (bot_id, row_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_database_rows_bot_sort
  ON public.bot_database_rows (bot_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_bot_database_rows_bot_updated
  ON public.bot_database_rows (bot_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_database_rows_content_search
  ON public.bot_database_rows
  USING GIN (to_tsvector('simple', content));

ALTER TABLE public.bot_database_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view database rows of own bots" ON public.bot_database_rows;
CREATE POLICY "Users can view database rows of own bots"
  ON public.bot_database_rows FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE public.bots.id = public.bot_database_rows.bot_id
        AND public.bots.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert database rows for own bots" ON public.bot_database_rows;
CREATE POLICY "Users can insert database rows for own bots"
  ON public.bot_database_rows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE public.bots.id = public.bot_database_rows.bot_id
        AND public.bots.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update database rows of own bots" ON public.bot_database_rows;
CREATE POLICY "Users can update database rows of own bots"
  ON public.bot_database_rows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE public.bots.id = public.bot_database_rows.bot_id
        AND public.bots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE public.bots.id = public.bot_database_rows.bot_id
        AND public.bots.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete database rows of own bots" ON public.bot_database_rows;
CREATE POLICY "Users can delete database rows of own bots"
  ON public.bot_database_rows FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE public.bots.id = public.bot_database_rows.bot_id
        AND public.bots.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS bot_database_rows_set_updated_at ON public.bot_database_rows;
CREATE TRIGGER bot_database_rows_set_updated_at
  BEFORE UPDATE ON public.bot_database_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Backfill from the previous metadata.database shape:
-- metadata.database.rows[] -> one row per item
-- metadata.database.text   -> one legacy row with key "main"
WITH metadata_rows AS (
  SELECT
    b.id AS bot_id,
    LEFT(
      COALESCE(
        NULLIF(
          regexp_replace(
            regexp_replace(
              btrim(COALESCE(row_item.value ->> 'id', 'row_' || row_item.ordinality::text)),
              '[^A-Za-z0-9_-]',
              '_',
              'g'
            ),
            '_+',
            '_',
            'g'
          ),
          ''
        ),
        'row_' || row_item.ordinality::text
      ),
      56
    ) AS base_row_key,
    COALESCE(row_item.value ->> 'text', '') AS content,
    COALESCE(b.metadata #>> '{database,sourceName}', NULL) AS source_name,
    row_item.ordinality::integer AS sort_order
  FROM public.bots b
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(b.metadata #> '{database,rows}') = 'array'
        THEN b.metadata #> '{database,rows}'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS row_item(value, ordinality)
),
legacy_rows AS (
  SELECT
    b.id AS bot_id,
    'main' AS base_row_key,
    COALESCE(b.metadata #>> '{database,text}', '') AS content,
    COALESCE(b.metadata #>> '{database,sourceName}', NULL) AS source_name,
    0 AS sort_order
  FROM public.bots b
  WHERE COALESCE(b.metadata #>> '{database,text}', '') <> ''
    AND jsonb_array_length(
      CASE
        WHEN jsonb_typeof(b.metadata #> '{database,rows}') = 'array'
          THEN b.metadata #> '{database,rows}'
        ELSE '[]'::jsonb
      END
    ) = 0
),
source_rows AS (
  SELECT * FROM metadata_rows
  UNION ALL
  SELECT * FROM legacy_rows
),
deduped_rows AS (
  SELECT
    bot_id,
    CASE
      WHEN row_number() OVER (PARTITION BY bot_id, base_row_key ORDER BY sort_order) = 1
        THEN base_row_key
      ELSE base_row_key || '_' || row_number() OVER (PARTITION BY bot_id, base_row_key ORDER BY sort_order)::text
    END AS row_key,
    content,
    source_name,
    sort_order
  FROM source_rows
  WHERE btrim(content) <> ''
)
INSERT INTO public.bot_database_rows (
  bot_id,
  row_key,
  content,
  source_name,
  sort_order,
  created_at,
  updated_at
)
SELECT
  bot_id,
  row_key,
  content,
  source_name,
  sort_order,
  TIMEZONE('utc'::text, NOW()),
  TIMEZONE('utc'::text, NOW())
FROM deduped_rows
ON CONFLICT (bot_id, row_key) DO UPDATE
SET
  content = EXCLUDED.content,
  source_name = EXCLUDED.source_name,
  sort_order = EXCLUDED.sort_order,
  updated_at = EXCLUDED.updated_at;
