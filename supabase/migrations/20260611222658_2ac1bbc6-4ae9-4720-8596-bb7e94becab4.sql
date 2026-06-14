
-- Stripe Connect Express: accounts table + booking columns

CREATE TABLE IF NOT EXISTS public.connect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.connect_accounts TO authenticated;
GRANT ALL ON public.connect_accounts TO service_role;

ALTER TABLE public.connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view own connect account"
  ON public.connect_accounts FOR SELECT
  TO authenticated
  USING (provider_id = public.get_profile_id(auth.uid()));

CREATE TRIGGER connect_accounts_updated_at
  BEFORE UPDATE ON public.connect_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS application_fee_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS connect_account_id text;
