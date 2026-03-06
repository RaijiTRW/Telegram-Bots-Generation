-- Migration: allow bootstrap role update from Supabase SQL editor
-- Keeps normal app-side protection: only authenticated admins can change roles.

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

  -- Allow service-role calls and SQL editor/superuser sessions for bootstrap operations.
  IF auth.role() = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
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
