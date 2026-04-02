CREATE TABLE IF NOT EXISTS public.app_access_controls (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_scope TEXT NOT NULL DEFAULT 'none',
  maintenance_title TEXT,
  maintenance_message TEXT,
  dashboard_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT app_access_controls_maintenance_scope_check
    CHECK (maintenance_scope IN ('none', 'site', 'editor', 'dashboard_editor'))
);

INSERT INTO public.app_access_controls (
  id,
  registration_open,
  maintenance_scope,
  maintenance_title,
  maintenance_message,
  dashboard_overrides
)
VALUES (
  1,
  TRUE,
  'none',
  NULL,
  NULL,
  jsonb_build_object(
    'bots', jsonb_build_object('mode', 'default', 'label', NULL),
    'statistics', jsonb_build_object('mode', 'default', 'label', NULL),
    'subscription', jsonb_build_object('mode', 'default', 'label', NULL),
    'crm', jsonb_build_object('mode', 'locked', 'label', NULL),
    'docs', jsonb_build_object('mode', 'default', 'label', NULL),
    'profile', jsonb_build_object('mode', 'default', 'label', NULL),
    'settings', jsonb_build_object('mode', 'default', 'label', NULL)
  )
)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS app_access_controls_updated_by_idx
  ON public.app_access_controls (updated_by);

ALTER TABLE public.app_access_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read app access controls" ON public.app_access_controls;
CREATE POLICY "Public can read app access controls"
  ON public.app_access_controls FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can insert app access controls" ON public.app_access_controls;
CREATE POLICY "Admins can insert app access controls"
  ON public.app_access_controls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update app access controls" ON public.app_access_controls;
CREATE POLICY "Admins can update app access controls"
  ON public.app_access_controls FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS app_access_controls_set_updated_at ON public.app_access_controls;
CREATE TRIGGER app_access_controls_set_updated_at
  BEFORE UPDATE ON public.app_access_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
