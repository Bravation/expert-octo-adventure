# Stripe Connect Express + Application Fees (PayPal kept alongside)

## Fee math (provider nets exactly their price P)

Customer charge `C` is grossed up so that, after Stripe takes its processing fee, the platform's 15% cut leaves the provider with exactly `P`:

```text
C * (1 - 0.029) - 0.30 = 1.15 * P
C = (1.15 * P + 0.30) / 0.971
```

- Stripe processing fee:  `0.029 * C + 0.30` (deducted by Stripe from the platform balance via `application_fee_amount`)
- Application fee (to platform): `0.15 * P + stripe_fee` → platform nets exactly `0.15 * P`
- Transferred to provider's connected account: exactly `P`

Example: P = $100 → C = $118.74, Stripe fee ≈ $3.74, platform nets $15.00, provider nets $100.00.

## Backend

### Migration
- New table `connect_accounts`: provider_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements (jsonb), environment ('sandbox'|'live'), timestamps. RLS: provider reads own row; service_role full access.
- Add columns to `bookings`: `payment_provider` ('paypal'|'stripe'), `stripe_payment_intent_id`, `stripe_checkout_session_id`, `customer_charge_cents`, `provider_net_cents`, `platform_fee_cents`, `stripe_fee_estimate_cents`, `application_fee_cents`, `payment_status`, `connect_account_id`.

### Edge functions (new)
- `stripe-connect-onboard` — creates Express account (if missing) for the calling provider, returns AccountLink onboarding URL.
- `stripe-connect-status` — fetches Stripe account, upserts `connect_accounts` row, returns status flags.
- `stripe-create-booking-checkout` — server-computes gross-up math, creates Checkout Session with `payment_intent_data.application_fee_amount` and `payment_intent_data.transfer_data.destination = stripe_account_id`, metadata `{ booking_id }`, success/cancel URLs to `/booking-payment-return`.

### Webhook (`my-endpoint`)
- On `checkout.session.completed` / `payment_intent.succeeded` with `metadata.booking_id`: mark booking paid, persist amounts/ids.
- On `account.updated`: refresh `connect_accounts` row.
- PayPal webhook path untouched.

## Frontend

### Provider Dashboard
- New "Payouts" card: if no `connect_accounts` row or `details_submitted=false`, show "Connect Stripe" button → invokes `stripe-connect-onboard` → redirects to Stripe. Otherwise show charges/payouts status badges + "Manage on Stripe" link.

### BookingDialog
- Keep existing PayPal flow intact.
- Add payment method selector (radio): **PayPal (booking fee)** vs **Card via Stripe (full payment)**.
  - PayPal branch: unchanged — 10% booking-fee math, existing `payWithPayPal: true` path.
  - Stripe branch: show Service price, Platform fee (15%), Processing fee (2.9% + $0.30), **Total you pay = C**. Disabled if provider has no active Connect account (with helpful tooltip). On confirm → invoke `stripe-create-booking-checkout` → redirect to Checkout.
- Bilingual i18n strings for new labels.

### New page
- `src/pages/BookingPaymentReturn.tsx` — polls `bookings.payment_status` after Stripe redirect, shows success/failure UI; route added in `App.tsx`.

## Out of scope (deferred)
- Refund UI (DB + webhook ready; admin tooling later).
- Provider payout dashboard beyond Stripe Express's own.
- Removing PayPal — explicitly kept in parallel per your request.
- Changes to custom-quote / price-adjustment flows (they continue to feed `bookings.service_price`, which the Stripe math uses).

## Technical notes
- All Stripe calls go through `createStripeClient(env)` shared util (gateway-proxied); `env` derived per-function (sandbox default; live when claimed).
- `application_fee_amount` and `transfer_data.destination` are set at Checkout Session creation, not after. Provider's connected account must have `charges_enabled` before `stripe-create-booking-checkout` will succeed.
- Webhook already verifies signatures and routes by `?env=`. No webhook re-registration needed.

Reply "go" to build, or tell me what to tweak (e.g. make Stripe the default selection, hide PayPal once Connect is set up, different gross-up rounding).
