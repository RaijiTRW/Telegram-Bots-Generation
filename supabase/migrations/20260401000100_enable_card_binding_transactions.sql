ALTER TABLE public.subscription_transactions
  DROP CONSTRAINT IF EXISTS subscription_transactions_kind_check;

ALTER TABLE public.subscription_transactions
  ADD CONSTRAINT subscription_transactions_kind_check
  CHECK (kind IN ('initial', 'renewal', 'change', 'card_binding'));
