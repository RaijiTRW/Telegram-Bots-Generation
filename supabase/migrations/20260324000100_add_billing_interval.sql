ALTER TABLE public.user_subscriptions
    ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'month';

UPDATE public.user_subscriptions
SET billing_interval = 'month'
WHERE billing_interval IS NULL;

ALTER TABLE public.user_subscriptions
    ALTER COLUMN billing_interval SET DEFAULT 'month';

ALTER TABLE public.user_subscriptions
    ALTER COLUMN billing_interval SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_subscriptions_billing_interval_check'
      AND conrelid = 'public.user_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_billing_interval_check
      CHECK (billing_interval IN ('month', 'year'));
  END IF;
END;
$$;

ALTER TABLE public.subscription_transactions
    ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'month';

UPDATE public.subscription_transactions
SET billing_interval = 'month'
WHERE billing_interval IS NULL;

ALTER TABLE public.subscription_transactions
    ALTER COLUMN billing_interval SET DEFAULT 'month';

ALTER TABLE public.subscription_transactions
    ALTER COLUMN billing_interval SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_transactions_billing_interval_check'
      AND conrelid = 'public.subscription_transactions'::regclass
  ) THEN
    ALTER TABLE public.subscription_transactions
      ADD CONSTRAINT subscription_transactions_billing_interval_check
      CHECK (billing_interval IN ('month', 'year'));
  END IF;
END;
$$;
