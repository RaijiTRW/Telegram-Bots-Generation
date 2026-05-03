ALTER TABLE public.app_access_controls
  ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'beta_request';

ALTER TABLE public.app_access_controls
  DROP CONSTRAINT IF EXISTS app_access_controls_registration_mode_check;

ALTER TABLE public.app_access_controls
  ADD CONSTRAINT app_access_controls_registration_mode_check
    CHECK (registration_mode IN ('open', 'beta_request', 'closed'));

UPDATE public.app_access_controls
SET
  registration_mode = CASE
    WHEN registration_open THEN 'beta_request'
    ELSE 'closed'
  END,
  registration_open = FALSE
WHERE id = 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_access_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_access_status_check
    CHECK (access_status IN ('active', 'beta_pending', 'rejected'));

CREATE INDEX IF NOT EXISTS profiles_access_status_idx
  ON public.profiles(access_status);

CREATE OR REPLACE FUNCTION public.guard_profile_access_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.access_status, 'active') = COALESCE(OLD.access_status, 'active') THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admin can change profile access status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_access_status_update_trigger ON public.profiles;
CREATE TRIGGER guard_profile_access_status_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_access_status_update();

CREATE TABLE IF NOT EXISTS public.beta_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT beta_access_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS beta_access_requests_email_key
  ON public.beta_access_requests (email);

CREATE INDEX IF NOT EXISTS beta_access_requests_status_idx
  ON public.beta_access_requests(status);

CREATE INDEX IF NOT EXISTS beta_access_requests_user_id_idx
  ON public.beta_access_requests(user_id);

ALTER TABLE public.beta_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read beta access requests" ON public.beta_access_requests;
CREATE POLICY "Admins can read beta access requests"
  ON public.beta_access_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update beta access requests" ON public.beta_access_requests;
CREATE POLICY "Admins can update beta access requests"
  ON public.beta_access_requests FOR UPDATE
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

DROP TRIGGER IF EXISTS beta_access_requests_set_updated_at ON public.beta_access_requests;
CREATE TRIGGER beta_access_requests_set_updated_at
  BEFORE UPDATE ON public.beta_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_email_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
  smtp_user TEXT,
  smtp_from TEXT,
  smtp_password_algorithm TEXT,
  smtp_password_key_version INTEGER,
  smtp_password_iv TEXT,
  smtp_password_ciphertext TEXT,
  smtp_password_auth_tag TEXT,
  imap_host TEXT,
  imap_port INTEGER,
  imap_secure BOOLEAN NOT NULL DEFAULT TRUE,
  imap_user TEXT,
  imap_password_algorithm TEXT,
  imap_password_key_version INTEGER,
  imap_password_iv TEXT,
  imap_password_ciphertext TEXT,
  imap_password_auth_tag TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.admin_email_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.admin_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read email settings" ON public.admin_email_settings;
CREATE POLICY "Admins can read email settings"
  ON public.admin_email_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert email settings" ON public.admin_email_settings;
CREATE POLICY "Admins can insert email settings"
  ON public.admin_email_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update email settings" ON public.admin_email_settings;
CREATE POLICY "Admins can update email settings"
  ON public.admin_email_settings FOR UPDATE
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

DROP TRIGGER IF EXISTS admin_email_settings_set_updated_at ON public.admin_email_settings;
CREATE TRIGGER admin_email_settings_set_updated_at
  BEFORE UPDATE ON public.admin_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, language, access_status)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'language', ''), 'ru'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'access_status', ''), 'active')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        access_status = EXCLUDED.access_status,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
