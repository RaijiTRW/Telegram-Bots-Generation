-- Backfill existing users from auth.users to profiles table
-- This migration creates profile entries for users who signed up before the profiles table was created

INSERT INTO public.profiles (id, email, full_name, avatar_url, language, created_at, updated_at)
SELECT
    id,
    email,
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'avatar_url',
    'ru' as language,
    created_at,
    updated_at
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.users.id
);
