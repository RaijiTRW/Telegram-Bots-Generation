-- Migration: Docs CMS with revisions, redirects and media assets

CREATE TABLE IF NOT EXISTS public.docs_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en')),
  parent_id UUID NULL REFERENCES public.docs_pages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_home BOOLEAN NOT NULL DEFAULT FALSE,
  latest_revision_id UUID NULL,
  published_revision_id UUID NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.docs_page_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.docs_pages(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  title_snapshot TEXT NOT NULL,
  blocks JSONB NOT NULL,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_note TEXT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (page_id, revision_no)
);

CREATE TABLE IF NOT EXISTS public.docs_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en')),
  from_path TEXT NOT NULL,
  to_page_id UUID NOT NULL REFERENCES public.docs_pages(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.docs_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en')),
  page_id UUID NULL REFERENCES public.docs_pages(id) ON DELETE SET NULL,
  bucket TEXT NOT NULL DEFAULT 'docs-media',
  object_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS docs_pages_locale_path_uq
  ON public.docs_pages(locale, path);

CREATE UNIQUE INDEX IF NOT EXISTS docs_pages_locale_parent_slug_uq
  ON public.docs_pages(locale, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE UNIQUE INDEX IF NOT EXISTS docs_pages_locale_single_home_uq
  ON public.docs_pages(locale)
  WHERE is_home;

CREATE INDEX IF NOT EXISTS docs_pages_locale_parent_sort_idx
  ON public.docs_pages(locale, parent_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS docs_pages_published_revision_idx
  ON public.docs_pages(published_revision_id)
  WHERE published_revision_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS docs_revisions_page_created_idx
  ON public.docs_page_revisions(page_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS docs_redirects_locale_from_path_uq
  ON public.docs_redirects(locale, from_path);

CREATE INDEX IF NOT EXISTS docs_redirects_to_page_idx
  ON public.docs_redirects(to_page_id);

CREATE INDEX IF NOT EXISTS docs_media_locale_page_idx
  ON public.docs_media_assets(locale, page_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'docs_pages_latest_revision_fkey'
      AND conrelid = 'public.docs_pages'::regclass
  ) THEN
    ALTER TABLE public.docs_pages
      ADD CONSTRAINT docs_pages_latest_revision_fkey
      FOREIGN KEY (latest_revision_id)
      REFERENCES public.docs_page_revisions(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'docs_pages_published_revision_fkey'
      AND conrelid = 'public.docs_pages'::regclass
  ) THEN
    ALTER TABLE public.docs_pages
      ADD CONSTRAINT docs_pages_published_revision_fkey
      FOREIGN KEY (published_revision_id)
      REFERENCES public.docs_page_revisions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.docs_compute_path(target_parent_id UUID, target_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  parent_path TEXT;
BEGIN
  IF target_parent_id IS NULL THEN
    RETURN target_slug;
  END IF;

  SELECT path INTO parent_path
  FROM public.docs_pages
  WHERE id = target_parent_id;

  IF parent_path IS NULL THEN
    RAISE EXCEPTION 'Parent docs page not found';
  END IF;

  IF parent_path = '' THEN
    RETURN target_slug;
  END IF;

  RETURN parent_path || '/' || target_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.docs_pages_set_path_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.slug := LOWER(TRIM(COALESCE(NEW.slug, '')));
  NEW.slug := REGEXP_REPLACE(NEW.slug, '[^a-z0-9\-_]+', '-', 'g');
  NEW.slug := REGEXP_REPLACE(NEW.slug, '-{2,}', '-', 'g');
  NEW.slug := TRIM(BOTH '-' FROM NEW.slug);

  IF NEW.slug = '' THEN
    NEW.slug := 'page';
  END IF;

  NEW.path := public.docs_compute_path(NEW.parent_id, NEW.slug);
  NEW.updated_at := TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.docs_recompute_subtree_paths(root_page_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  WITH RECURSIVE tree AS (
    SELECT
      p.id,
      p.parent_id,
      p.slug,
      p.path,
      public.docs_compute_path(p.parent_id, p.slug) AS recalculated_path
    FROM public.docs_pages p
    WHERE p.id = root_page_id

    UNION ALL

    SELECT
      child.id,
      child.parent_id,
      child.slug,
      child.path,
      CASE
        WHEN tree.recalculated_path = '' THEN child.slug
        ELSE tree.recalculated_path || '/' || child.slug
      END AS recalculated_path
    FROM public.docs_pages child
    JOIN tree ON child.parent_id = tree.id
  )
  UPDATE public.docs_pages p
  SET path = tree.recalculated_path,
      updated_at = TIMEZONE('utc'::text, NOW())
  FROM tree
  WHERE p.id = tree.id
    AND p.path IS DISTINCT FROM tree.recalculated_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.docs_pages_after_move_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.parent_id IS DISTINCT FROM NEW.parent_id)
     OR (OLD.slug IS DISTINCT FROM NEW.slug)
     OR (OLD.path IS DISTINCT FROM NEW.path) THEN
    PERFORM public.docs_recompute_subtree_paths(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS docs_pages_set_path_before ON public.docs_pages;
CREATE TRIGGER docs_pages_set_path_before
  BEFORE INSERT OR UPDATE OF parent_id, slug ON public.docs_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.docs_pages_set_path_trigger();

DROP TRIGGER IF EXISTS docs_pages_after_move ON public.docs_pages;
CREATE TRIGGER docs_pages_after_move
  AFTER UPDATE OF parent_id, slug, path ON public.docs_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.docs_pages_after_move_trigger();

DROP TRIGGER IF EXISTS docs_pages_set_updated_at ON public.docs_pages;
CREATE TRIGGER docs_pages_set_updated_at
  BEFORE UPDATE ON public.docs_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.docs_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published docs pages" ON public.docs_pages;
CREATE POLICY "Public can view published docs pages"
  ON public.docs_pages FOR SELECT
  USING (published_revision_id IS NOT NULL);

DROP POLICY IF EXISTS "Admins can view all docs pages" ON public.docs_pages;
CREATE POLICY "Admins can view all docs pages"
  ON public.docs_pages FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can insert docs pages" ON public.docs_pages;
CREATE POLICY "Admins can insert docs pages"
  ON public.docs_pages FOR INSERT
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update docs pages" ON public.docs_pages;
CREATE POLICY "Admins can update docs pages"
  ON public.docs_pages FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete docs pages" ON public.docs_pages;
CREATE POLICY "Admins can delete docs pages"
  ON public.docs_pages FOR DELETE
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Public can view published revisions" ON public.docs_page_revisions;
CREATE POLICY "Public can view published revisions"
  ON public.docs_page_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.docs_pages p
      WHERE p.published_revision_id = public.docs_page_revisions.id
    )
  );

DROP POLICY IF EXISTS "Admins can view all revisions" ON public.docs_page_revisions;
CREATE POLICY "Admins can view all revisions"
  ON public.docs_page_revisions FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can insert revisions" ON public.docs_page_revisions;
CREATE POLICY "Admins can insert revisions"
  ON public.docs_page_revisions FOR INSERT
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update revisions" ON public.docs_page_revisions;
CREATE POLICY "Admins can update revisions"
  ON public.docs_page_revisions FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete revisions" ON public.docs_page_revisions;
CREATE POLICY "Admins can delete revisions"
  ON public.docs_page_revisions FOR DELETE
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Public can view active redirects" ON public.docs_redirects;
CREATE POLICY "Public can view active redirects"
  ON public.docs_redirects FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can view all redirects" ON public.docs_redirects;
CREATE POLICY "Admins can view all redirects"
  ON public.docs_redirects FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can insert redirects" ON public.docs_redirects;
CREATE POLICY "Admins can insert redirects"
  ON public.docs_redirects FOR INSERT
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update redirects" ON public.docs_redirects;
CREATE POLICY "Admins can update redirects"
  ON public.docs_redirects FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete redirects" ON public.docs_redirects;
CREATE POLICY "Admins can delete redirects"
  ON public.docs_redirects FOR DELETE
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Public can view docs media assets" ON public.docs_media_assets;
CREATE POLICY "Public can view docs media assets"
  ON public.docs_media_assets FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can insert docs media assets" ON public.docs_media_assets;
CREATE POLICY "Admins can insert docs media assets"
  ON public.docs_media_assets FOR INSERT
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update docs media assets" ON public.docs_media_assets;
CREATE POLICY "Admins can update docs media assets"
  ON public.docs_media_assets FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete docs media assets" ON public.docs_media_assets;
CREATE POLICY "Admins can delete docs media assets"
  ON public.docs_media_assets FOR DELETE
  USING (public.is_current_user_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'docs-media',
  'docs-media',
  TRUE,
  524288000,
  ARRAY[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read docs-media" ON storage.objects;
CREATE POLICY "Public can read docs-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'docs-media');

DROP POLICY IF EXISTS "Admins can upload docs-media" ON storage.objects;
CREATE POLICY "Admins can upload docs-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'docs-media' AND public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update docs-media" ON storage.objects;
CREATE POLICY "Admins can update docs-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'docs-media' AND public.is_current_user_admin())
  WITH CHECK (bucket_id = 'docs-media' AND public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete docs-media" ON storage.objects;
CREATE POLICY "Admins can delete docs-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'docs-media' AND public.is_current_user_admin());
