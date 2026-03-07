CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    language TEXT DEFAULT 'ru' CHECK (language IN ('ru', 'en')),
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN role SET DEFAULT 'user';

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

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    language,
    role,
    created_at,
    updated_at
)
SELECT
    auth.users.id,
    auth.users.email,
    auth.users.raw_user_meta_data->>'full_name',
    auth.users.raw_user_meta_data->>'avatar_url',
    'ru',
    'user',
    COALESCE(auth.users.created_at, TIMEZONE('utc'::text, NOW())),
    COALESCE(auth.users.updated_at, TIMEZONE('utc'::text, NOW()))
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.users.id
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL DEFAULT 'base' CHECK (plan_code IN ('base', 'business', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired', 'incomplete')),
    currency TEXT NOT NULL DEFAULT 'RUB' CHECK (currency IN ('RUB', 'USD')),
    billing_provider TEXT NOT NULL DEFAULT 'yookassa' CHECK (billing_provider IN ('yookassa')),
    price_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    current_period_start TIMESTAMPTZ NULL,
    current_period_end TIMESTAMPTZ NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ NULL,
    past_due_at TIMESTAMPTZ NULL,
    provider_customer_id TEXT NULL,
    provider_payment_method_id TEXT NULL,
    provider_last_payment_id TEXT NULL,
    provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.subscription_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL CHECK (plan_code IN ('base', 'business', 'enterprise')),
    kind TEXT NOT NULL CHECK (kind IN ('initial', 'renewal', 'change')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RUB' CHECK (currency IN ('RUB', 'USD')),
    billing_provider TEXT NOT NULL DEFAULT 'yookassa' CHECK (billing_provider IN ('yookassa')),
    provider_payment_id TEXT NULL,
    provider_payment_method_id TEXT NULL,
    provider_idempotence_key TEXT NULL,
    confirmation_url TEXT NULL,
    return_url TEXT NULL,
    failure_reason TEXT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    succeeded_at TIMESTAMPTZ NULL,
    failed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

DROP TRIGGER IF EXISTS set_updated_at_user_subscriptions ON public.user_subscriptions;
CREATE TRIGGER set_updated_at_user_subscriptions
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_subscription_transactions ON public.subscription_transactions;
CREATE TRIGGER set_updated_at_subscription_transactions
    BEFORE UPDATE ON public.subscription_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS user_subscriptions_plan_status_idx
    ON public.user_subscriptions(plan_code, status, current_period_end);

CREATE INDEX IF NOT EXISTS subscription_transactions_user_created_idx
    ON public.subscription_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS subscription_transactions_status_created_idx
    ON public.subscription_transactions(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_transactions_provider_payment_id_idx
    ON public.subscription_transactions(provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subscription transactions" ON public.subscription_transactions;
CREATE POLICY "Users can view own subscription transactions"
    ON public.subscription_transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can view all subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    );

DROP POLICY IF EXISTS "Admins can view all subscription transactions" ON public.subscription_transactions;
CREATE POLICY "Admins can view all subscription transactions"
    ON public.subscription_transactions FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    );

INSERT INTO public.user_subscriptions (
    user_id,
    plan_code,
    status,
    currency,
    billing_provider,
    price_amount,
    started_at
)
SELECT
    profiles.id,
    'base',
    'active',
    'RUB',
    'yookassa',
    0,
    COALESCE(profiles.created_at, TIMEZONE('utc'::text, NOW()))
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, language)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        'ru'
    );

    INSERT INTO public.user_subscriptions (
        user_id,
        plan_code,
        status,
        currency,
        billing_provider,
        price_amount,
        started_at
    )
    VALUES (
        NEW.id,
        'base',
        'active',
        'RUB',
        'yookassa',
        0,
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
