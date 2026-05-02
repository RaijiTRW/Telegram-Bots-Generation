ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_onboarding_seen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editor_onboarding_seen BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles
SET
  dashboard_onboarding_seen = false,
  editor_onboarding_seen = false;

COMMENT ON COLUMN public.profiles.dashboard_onboarding_seen IS 'Whether the user closed or completed the dashboard onboarding tour.';
COMMENT ON COLUMN public.profiles.editor_onboarding_seen IS 'Whether the user closed or completed the editor onboarding tour.';
