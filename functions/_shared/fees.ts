// Provider commission tier: starts at 15%, drops 1% per 20 completed bookings, floor 5%.
// Mirrors the SQL trigger `handle_booking_completion` and `provider_milestones` default.
export function commissionRateForCompleted(completed: number): number {
  const n = Math.max(0, Math.floor(completed));
  return Math.max(5, 15 - Math.floor(n / 20));
}

// Gross-up math (USD): provider nets exactly P after Stripe fee (2.9% + $0.30)
// and a dynamic platform application fee `r` (decimal, e.g. 0.15 or 0.05):
//   C * (1 - 0.029) - 0.30 = (1 + r) * P  =>  C = ((1 + r) * P + 0.30) / 0.971
export function computeAmounts(providerPrice: number, commissionRatePct: number) {
  const P = Math.round(providerPrice * 100) / 100;
  const r = Math.max(0.05, Math.min(0.15, commissionRatePct / 100));
  const customerCharge = Math.round((((1 + r) * P + 0.30) / 0.971) * 100) / 100;
  const stripeFee = Math.round((0.029 * customerCharge + 0.30) * 100) / 100;
  const platformCut = Math.round(r * P * 100) / 100;
  const applicationFee = Math.round((platformCut + stripeFee) * 100) / 100;
  return {
    providerNet: P,
    customerCharge,
    stripeFee,
    platformNet: platformCut,
    applicationFee,
    commissionRatePct: Math.round(r * 10000) / 100,
    customerChargeCents: Math.round(customerCharge * 100),
    applicationFeeCents: Math.round(applicationFee * 100),
  };
}