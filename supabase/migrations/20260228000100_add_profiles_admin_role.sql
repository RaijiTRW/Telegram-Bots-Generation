-- Migration: add admin role to profiles and secure role updates

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.profiles.role IS 'Dashboard access role: user or admin';

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

CREATE OR REPLACE FUNCTION public.is_admin_by_id(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_by_id(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_is_admin BOOLEAN;
  remaining_admins BIGINT;
BEGIN
  IF COALESCE(NEW.role, 'user') = COALESCE(OLD.role, 'user') THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Only authenticated admin can change profile role';
  END IF;

  actor_is_admin := public.is_admin_by_id(actor_id);
  IF NOT actor_is_admin THEN
    RAISE EXCEPTION 'Only admin can change profile role';
  END IF;

  IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT COUNT(*)
    INTO remaining_admins
    FROM public.profiles
    WHERE role = 'admin'
      AND id <> OLD.id;

    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'At least one admin must remain';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_role_update_trigger ON public.profiles;
CREATE TRIGGER guard_profile_role_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_role_update();

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
