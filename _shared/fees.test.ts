import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { commissionRateForCompleted, computeAmounts } from "./fees.ts";

Deno.test("commissionRateForCompleted: starts at 15% with zero bookings", () => {
  assertEquals(commissionRateForCompleted(0), 15);
});

Deno.test("commissionRateForCompleted: holds 15% across the first tier (0-19)", () => {
  for (const n of [1, 5, 10, 19]) assertEquals(commissionRateForCompleted(n), 15);
});

Deno.test("commissionRateForCompleted: drops 1% at each 20-booking boundary", () => {
  assertEquals(commissionRateForCompleted(20), 14);
  assertEquals(commissionRateForCompleted(40), 13);
  assertEquals(commissionRateForCompleted(60), 12);
  assertEquals(commissionRateForCompleted(80), 11);
  assertEquals(commissionRateForCompleted(100), 10);
  assertEquals(commissionRateForCompleted(120), 9);
  assertEquals(commissionRateForCompleted(140), 8);
  assertEquals(commissionRateForCompleted(160), 7);
  assertEquals(commissionRateForCompleted(180), 6);
  assertEquals(commissionRateForCompleted(200), 5);
});

Deno.test("commissionRateForCompleted: clamps at the 5% floor beyond 200 bookings", () => {
  for (const n of [220, 500, 10_000]) assertEquals(commissionRateForCompleted(n), 5);
});

Deno.test("commissionRateForCompleted: rate decreases monotonically", () => {
  let prev = commissionRateForCompleted(0);
  for (let n = 1; n <= 250; n++) {
    const r = commissionRateForCompleted(n);
    if (r > prev) throw new Error(`rate increased at n=${n}: ${prev} -> ${r}`);
    prev = r;
  }
});

// --- Gross-up formula -------------------------------------------------------

Deno.test("computeAmounts: $100 @ 15% matches documented worked example", () => {
  const a = computeAmounts(100, 15);
  assertEquals(a.providerNet, 100);
  assertEquals(a.customerCharge, 118.74);
  assertEquals(a.platformNet, 15);
  assertEquals(a.stripeFee, 3.74);
  assertEquals(a.applicationFee, 18.74);
  assertEquals(a.customerChargeCents, 11874);
  assertEquals(a.applicationFeeCents, 1874);
  assertEquals(a.commissionRatePct, 15);
});

Deno.test("computeAmounts: $100 @ 5% (floor tier) grosses up correctly", () => {
  const a = computeAmounts(100, 5);
  // C = (1.05 * 100 + 0.30) / 0.971 = 108.4449...
  assertEquals(a.customerCharge, 108.44);
  assertEquals(a.platformNet, 5);
  assertEquals(a.commissionRatePct, 5);
});

Deno.test("computeAmounts: clamps rates outside [5,15] into the allowed band", () => {
  assertEquals(computeAmounts(100, 25).commissionRatePct, 15); // capped
  assertEquals(computeAmounts(100, 1).commissionRatePct, 5);   // floored
});

Deno.test("computeAmounts: provider always nets P, platform always nets r*P (penny-accurate)", () => {
  const prices = [20, 49.99, 100, 123.45, 999.99, 5000];
  const rates = [15, 14, 10, 7, 5];
  for (const P of prices) {
    for (const ratePct of rates) {
      const a = computeAmounts(P, ratePct);
      assertEquals(a.providerNet, Math.round(P * 100) / 100, `providerNet for P=${P}`);
      const expectedPlatform = Math.round((ratePct / 100) * P * 100) / 100;
      assertEquals(a.platformNet, expectedPlatform, `platformNet P=${P} r=${ratePct}`);
      // applicationFee = platformNet + stripeFee, within 1 cent rounding
      const delta = Math.abs(a.applicationFee - (a.platformNet + a.stripeFee));
      if (delta > 0.005) throw new Error(`applicationFee mismatch P=${P} r=${ratePct} delta=${delta}`);
    }
  }
});

Deno.test("computeAmounts: customerCharge satisfies C*(1-0.029) - 0.30 ≈ (1+r)*P", () => {
  const cases = [[100, 15], [250, 10], [49.99, 8], [1000, 5]];
  for (const [P, ratePct] of cases) {
    const a = computeAmounts(P, ratePct);
    const r = ratePct / 100;
    const lhs = a.customerCharge * (1 - 0.029) - 0.30;
    const rhs = (1 + r) * P;
    const delta = Math.abs(lhs - rhs);
    if (delta > 0.02) throw new Error(`gross-up off for P=${P} r=${ratePct}: ${lhs} vs ${rhs}`);
  }
});