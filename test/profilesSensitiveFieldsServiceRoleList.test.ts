import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SERVICE_ROLE_KEY =
  (typeof process !== "undefined" && process.env?.SUPABASE_SERVICE_ROLE_KEY) || "";

const SENSITIVE_COLUMNS = ["email", "latitude", "longitude"] as const;

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUpProvider(seed: { latitude: number; longitude: number }) {
  const client = anonClient();
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Test provider", role: "service_provider" } },
  });
  if (error) throw error;
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) {
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user!.id;

  // Wait for the profile row created by the auth trigger.
  await new Promise((r) => setTimeout(r, 500));
  const { error: updErr } = await client
    .from("profiles")
    .update({ latitude: seed.latitude, longitude: seed.longitude })
    .eq("user_id", userId);
  if (updErr) throw updErr;

  return { client, userId, email, ...seed };
}

async function signUpNonOwner() {
  const client = anonClient();
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Non owner", role: "customer" } },
  });
  if (error) throw error;
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) {
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }
  return { client };
}

describe.skipIf(!SERVICE_ROLE_KEY)(
  "Profiles sensitive fields — service role list across providers vs RLS-blocked filters",
  () => {
    let providerA: Awaited<ReturnType<typeof signUpProvider>>;
    let providerB: Awaited<ReturnType<typeof signUpProvider>>;
    let providerC: Awaited<ReturnType<typeof signUpProvider>>;
    let providerD: Awaited<ReturnType<typeof signUpProvider>>;
    let nonOwner: Awaited<ReturnType<typeof signUpNonOwner>>;

    beforeAll(async () => {
      [providerA, providerB, providerC, providerD, nonOwner] = await Promise.all([
        signUpProvider({ latitude: 40.712776, longitude: -74.005974 }),
        signUpProvider({ latitude: 34.052235, longitude: -118.243683 }),
        signUpProvider({ latitude: 41.878113, longitude: -87.629799 }),
        signUpProvider({ latitude: 29.760427, longitude: -95.369804 }),
        signUpNonOwner(),
      ]);
    }, 45_000);

    afterAll(async () => {
      await providerA.client.auth.signOut();
      await providerB.client.auth.signOut();
      await providerC.client.auth.signOut();
      await providerD.client.auth.signOut();
      await nonOwner.client.auth.signOut();
    });

    it("service role can list sensitive columns across multiple providers when explicitly selected", async () => {
      const svc = serviceClient();
      const ids = [providerA, providerB, providerC].map((p) => p);
      const emails = ids.map((p) => p.email);

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .in("email", emails);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect((data ?? []).length).toBe(3);

      for (const row of data ?? []) {
        expect(row).toHaveProperty("email");
        expect(row).toHaveProperty("latitude");
        expect(row).toHaveProperty("longitude");
        expect(emails).toContain((row as any).email);
        expect((row as any).latitude).not.toBeNull();
        expect((row as any).longitude).not.toBeNull();
      }

      // Returned rows must be exactly the three seeded providers — no extras.
      const returnedUserIds = (data ?? []).map((r: any) => r.user_id).sort();
      const expectedUserIds = ids.map((p) => p.userId).sort();
      expect(returnedUserIds).toEqual(expectedUserIds);

      // Each returned row must map back to exactly one seeded provider, and its
      // email/latitude/longitude must match that provider's seeded values. Also
      // assert no row references an unexpected user_id or email.
      const seededByUserId = new Map(ids.map((p) => [p.userId, p]));
      const seededEmails = new Set(emails);
      const matchedUserIds = new Set<string>();
      for (const row of data ?? []) {
        const r = row as any;
        expect(seededEmails.has(r.email)).toBe(true);
        const seeded = seededByUserId.get(r.user_id);
        expect(seeded, `unexpected user_id ${r.user_id} in results`).toBeDefined();
        expect(r.email).toBe(seeded!.email);
        expect(Number(r.latitude)).toBeCloseTo(seeded!.latitude, 5);
        expect(Number(r.longitude)).toBeCloseTo(seeded!.longitude, 5);
        matchedUserIds.add(r.user_id);
      }
      expect(matchedUserIds.size).toBe(ids.length);
    });

    it("service role explicitly selecting sensitive columns does not return rows for an unqueried fourth provider", async () => {
      const svc = serviceClient();
      const queriedEmails = [providerA.email, providerB.email, providerC.email];
      const excludedUserIds = new Set([providerD.userId]);

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .in("email", queriedEmails);

      expect(error).toBeNull();
      expect((data ?? []).length).toBe(3);
      for (const row of data ?? []) {
        const r = row as any;
        expect(excludedUserIds.has(r.user_id)).toBe(false);
        expect(r.email).not.toBe(providerD.email);
        // The seeded coords for providerD are unique to providerD; ensure no
        // returned row leaks them.
        expect(Number(r.latitude)).not.toBeCloseTo(providerD.latitude, 5);
        expect(Number(r.longitude)).not.toBeCloseTo(providerD.longitude, 5);
      }

      // Sanity: the fourth provider IS reachable by the service role when
      // explicitly queried — proving its absence above is due to the filter,
      // not a missing row.
      const { data: dData } = await svc
        .from("profiles")
        .select("user_id, email")
        .eq("user_id", providerD.userId)
        .maybeSingle();
      expect((dData as any)?.email).toBe(providerD.email);
    });

    it("service role .like probes on numeric latitude/longitude cannot infer the unseeded fourth provider's row", async () => {
      const svc = serviceClient();
      // Build patterns that would textually match providerD's seeded coords.
      const latPattern = `${providerD.latitude}%`;
      const lonPattern = `${providerD.longitude}%`;

      for (const [col, pattern] of [
        ["latitude", latPattern],
        ["longitude", lonPattern],
      ] as const) {
        const { data, error } = await svc
          .from("profiles")
          .select("id, user_id, email, latitude, longitude")
          .like(col, pattern);

        // Either Postgres rejects .like on a numeric column (expected), or the
        // request succeeds — in which case providerD's row MUST NOT appear,
        // since .like is a string-only operator and cannot legitimately match
        // numeric values.
        if (error) {
          expect(error.message).toMatch(/operator|type|like|text|character/i);
          continue;
        }
        const leaked = (data ?? []).some(
          (r: any) => r.user_id === providerD.userId || r.email === providerD.email,
        );
        expect(leaked).toBe(false);
      }
    });

    it("service role gte/lte range probes on latitude/longitude that exclude the fourth provider do not return its row", async () => {
      const svc = serviceClient();

      // Build a latitude range that intentionally excludes providerD (lat ~29.76)
      // while still being broad enough to potentially match providers A/B/C.
      const latLowerExcludingD = providerD.latitude + 1; // > 29.76
      const latUpperExcludingD = 90;

      const { data: latData, error: latErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", latLowerExcludingD)
        .lte("latitude", latUpperExcludingD);

      expect(latErr).toBeNull();
      for (const row of latData ?? []) {
        const r = row as any;
        expect(r.user_id).not.toBe(providerD.userId);
        expect(r.email).not.toBe(providerD.email);
        expect(Number(r.latitude)).toBeGreaterThanOrEqual(latLowerExcludingD);
      }

      // Same exercise on longitude — providerD lon ~-95.37; carve a range that
      // excludes it.
      const lonLowerExcludingD = providerD.longitude + 1; // > -95.37
      const lonUpperExcludingD = 180;

      const { data: lonData, error: lonErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("longitude", lonLowerExcludingD)
        .lte("longitude", lonUpperExcludingD);

      expect(lonErr).toBeNull();
      for (const row of lonData ?? []) {
        const r = row as any;
        expect(r.user_id).not.toBe(providerD.userId);
        expect(r.email).not.toBe(providerD.email);
        expect(Number(r.longitude)).toBeGreaterThanOrEqual(lonLowerExcludingD);
      }

      // Sanity: a tight range AROUND providerD's coords does return it — proves
      // the exclusions above are due to the range bounds, not a missing row.
      const eps = 0.01;
      const { data: tightData, error: tightErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", providerD.latitude - eps)
        .lte("latitude", providerD.latitude + eps)
        .gte("longitude", providerD.longitude - eps)
        .lte("longitude", providerD.longitude + eps);
      expect(tightErr).toBeNull();
      expect((tightData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role bounding-box (combined latitude + longitude gte/lte) that excludes the fourth provider does not return its row", async () => {
      const svc = serviceClient();

      // Bounding box chosen to keep providers A/B/C reachable while strictly
      // excluding providerD. ProviderD ≈ (29.76, -95.37); lat lower bound of
      // (D.lat + 1) excludes it, while the longitude band is broad enough to
      // include the other three.
      const bbox = {
        latMin: providerD.latitude + 1,
        latMax: 90,
        lonMin: -180,
        lonMax: 180,
      };

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);

      expect(error).toBeNull();
      for (const row of data ?? []) {
        const r = row as any;
        expect(r.user_id).not.toBe(providerD.userId);
        expect(r.email).not.toBe(providerD.email);
        expect(Number(r.latitude)).toBeGreaterThanOrEqual(bbox.latMin);
        expect(Number(r.latitude)).toBeLessThanOrEqual(bbox.latMax);
        expect(Number(r.longitude)).toBeGreaterThanOrEqual(bbox.lonMin);
        expect(Number(r.longitude)).toBeLessThanOrEqual(bbox.lonMax);
      }

      // Sanity: a tight bbox AROUND providerD's coords does return its row,
      // proving the exclusion above is due to the bounds, not a missing row.
      const eps = 0.01;
      const { data: tightData, error: tightErr } = await svc
        .from("profiles")
        .select("user_id, email, latitude, longitude")
        .gte("latitude", providerD.latitude - eps)
        .lte("latitude", providerD.latitude + eps)
        .gte("longitude", providerD.longitude - eps)
        .lte("longitude", providerD.longitude + eps);
      expect(tightErr).toBeNull();
      expect((tightData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role near-miss bounding box that would only include providerD if bounds were off does not return its row", async () => {
      const svc = serviceClient();

      // Construct a bbox whose lower latitude bound sits just ABOVE providerD's
      // latitude — a single-bit error in the bound (e.g. <= instead of <, or
      // shaving the epsilon) would flip providerD into the result set. The
      // longitude band is tight around providerD so the only thing keeping
      // providerD out is the latitude lower bound.
      const eps = 1e-6;
      const nearMiss = {
        latMin: providerD.latitude + eps,
        latMax: providerD.latitude + 0.5,
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude + 0.5,
      };

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", nearMiss.latMin)
        .lte("latitude", nearMiss.latMax)
        .gte("longitude", nearMiss.lonMin)
        .lte("longitude", nearMiss.lonMax);

      expect(error).toBeNull();
      for (const row of data ?? []) {
        const r = row as any;
        expect(r.user_id).not.toBe(providerD.userId);
        expect(r.email).not.toBe(providerD.email);
        expect(Number(r.latitude)).toBeGreaterThanOrEqual(nearMiss.latMin);
      }

      // Inverse sanity: dropping the lower latitude bound BELOW providerD's
      // latitude — i.e. the "off-by-one" version of the same bbox — must
      // include providerD. This proves the exclusion above hinges on the
      // exact bound, not on providerD being unreachable.
      const inclusive = { ...nearMiss, latMin: providerD.latitude - eps };
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", inclusive.latMin)
        .lte("latitude", inclusive.latMax)
        .gte("longitude", inclusive.lonMin)
        .lte("longitude", inclusive.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role near-miss bounding box where the longitude lower bound sits one epsilon above providerD's longitude does not return its row", async () => {
      const svc = serviceClient();

      // Mirror of the latitude near-miss test, but the off-by-one risk is on
      // the LONGITUDE lower bound. Latitude band is tight around providerD so
      // the only thing keeping providerD out is the longitude lower bound.
      const eps = 1e-6;
      const nearMiss = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude + 0.5,
        lonMin: providerD.longitude + eps,
        lonMax: providerD.longitude + 0.5,
      };

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", nearMiss.latMin)
        .lte("latitude", nearMiss.latMax)
        .gte("longitude", nearMiss.lonMin)
        .lte("longitude", nearMiss.lonMax);

      expect(error).toBeNull();
      for (const row of data ?? []) {
        const r = row as any;
        expect(r.user_id).not.toBe(providerD.userId);
        expect(r.email).not.toBe(providerD.email);
        expect(Number(r.longitude)).toBeGreaterThanOrEqual(nearMiss.lonMin);
      }

      // Inverse sanity: shifting the longitude lower bound BELOW providerD's
      // longitude — the off-by-one version of the same bbox — must include
      // providerD, proving the exclusion above hinges on the exact bound.
      const inclusive = { ...nearMiss, lonMin: providerD.longitude - eps };
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", inclusive.latMin)
        .lte("latitude", inclusive.latMax)
        .gte("longitude", inclusive.lonMin)
        .lte("longitude", inclusive.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role near-miss bounding box where the longitude upper bound sits one epsilon below providerD's longitude does not return its row", async () => {
      const svc = serviceClient();

      // Off-by-one risk on the LONGITUDE upper bound this time. Latitude band
      // is tight around providerD so the only thing keeping providerD out is
      // the longitude upper bound.
      const eps = 1e-6;
      const nearMiss = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude + 0.5,
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude - eps,
      };

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", nearMiss.latMin)
        .lte("latitude", nearMiss.latMax)
        .gte("longitude", nearMiss.lonMin)
        .lte("longitude", nearMiss.lonMax);

      expect(error).toBeNull();
      for (const row of data ?? []) {
        const r = row as any;
        expect(r.user_id).not.toBe(providerD.userId);
        expect(r.email).not.toBe(providerD.email);
        expect(Number(r.longitude)).toBeLessThanOrEqual(nearMiss.lonMax);
      }

      // Inverse sanity: shifting the longitude upper bound ABOVE providerD's
      // longitude — the off-by-one version of the same bbox — must include
      // providerD, proving the exclusion above hinges on the exact bound.
      const inclusive = { ...nearMiss, lonMax: providerD.longitude + eps };
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", inclusive.latMin)
        .lte("latitude", inclusive.latMax)
        .gte("longitude", inclusive.lonMin)
        .lte("longitude", inclusive.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role near-miss bounding box where the latitude upper bound sits one epsilon below providerD's latitude does not return its row", async () => {
      const svc = serviceClient();

      // Off-by-one risk on the LATITUDE upper bound. Longitude band is tight
      // around providerD so the only thing keeping providerD out is the
      // latitude upper bound.
      const eps = 1e-6;
      const nearMiss = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude - eps,
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude + 0.5,
      };

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", nearMiss.latMin)
        .lte("latitude", nearMiss.latMax)
        .gte("longitude", nearMiss.lonMin)
        .lte("longitude", nearMiss.lonMax);

      expect(error).toBeNull();
      for (const row of data ?? []) {
        const r = row as any;
        expect(r.user_id).not.toBe(providerD.userId);
        expect(r.email).not.toBe(providerD.email);
        expect(Number(r.latitude)).toBeLessThanOrEqual(nearMiss.latMax);
      }

      // Inverse sanity: shifting the latitude upper bound ABOVE providerD's
      // latitude — the off-by-one version of the same bbox — must include
      // providerD, proving the exclusion above hinges on the exact bound.
      const inclusive = { ...nearMiss, latMax: providerD.latitude + eps };
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", inclusive.latMin)
        .lte("latitude", inclusive.latMax)
        .gte("longitude", inclusive.lonMin)
        .lte("longitude", inclusive.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role bounding box with longitude upper bound EXACTLY equal to providerD's longitude includes providerD (lte is inclusive)", async () => {
      const svc = serviceClient();

      // .lte() maps to PostgREST `lte` which compiles to SQL `<=` — i.e. the
      // upper bound is INCLUSIVE. With lonMax set to providerD's exact
      // longitude (and a tight latitude band around providerD), the row MUST
      // be returned.
      const bbox = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude + 0.5,
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude, // exact equality
      };

      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);

      expect(error).toBeNull();
      const dRow = (data ?? []).find((r: any) => r.user_id === providerD.userId) as any;
      expect(dRow, "providerD must be included when lonMax === providerD.longitude (lte inclusive)").toBeDefined();
      expect(dRow.email).toBe(providerD.email);
      expect(Number(dRow.longitude)).toBeCloseTo(providerD.longitude, 5);

      // Every returned row must respect the inclusive bound.
      for (const row of data ?? []) {
        expect(Number((row as any).longitude)).toBeLessThanOrEqual(bbox.lonMax);
      }

      // Contrast: the strict-upper variant via .lt() (exclusive) must EXCLUDE
      // providerD, confirming the inclusivity semantics differ as expected.
      const { data: ltData, error: ltErr } = await svc
        .from("profiles")
        .select("user_id, email, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lt("longitude", bbox.lonMax); // exclusive upper bound
      expect(ltErr).toBeNull();
      expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
    });

    it("service role bounding box with latitude upper bound EXACTLY equal to providerD's latitude includes providerD with .lte and excludes with .lt", async () => {
      const svc = serviceClient();

      // Mirror of the longitude inclusivity test, but exercising the LATITUDE
      // upper bound. Longitude band is tight around providerD so the latitude
      // bound is the only thing controlling providerD's inclusion.
      const bbox = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude, // exact equality
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude + 0.5,
      };

      // .lte() (inclusive) — providerD MUST be returned.
      const { data, error } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);

      expect(error).toBeNull();
      const dRow = (data ?? []).find((r: any) => r.user_id === providerD.userId) as any;
      expect(dRow, "providerD must be included when latMax === providerD.latitude (lte inclusive)").toBeDefined();
      expect(dRow.email).toBe(providerD.email);
      expect(Number(dRow.latitude)).toBeCloseTo(providerD.latitude, 5);

      for (const row of data ?? []) {
        expect(Number((row as any).latitude)).toBeLessThanOrEqual(bbox.latMax);
      }

      // .lt() (exclusive) — providerD MUST be excluded.
      const { data: ltData, error: ltErr } = await svc
        .from("profiles")
        .select("user_id, email, latitude")
        .gte("latitude", bbox.latMin)
        .lt("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(ltErr).toBeNull();
      expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
    });

    it("service role bounding box with latitude upper bound one epsilon BELOW providerD's latitude excludes providerD with both .lte and .lt", async () => {
      const svc = serviceClient();

      // Upper bound sits ε below providerD.latitude — providerD's latitude is
      // strictly greater than the bound, so BOTH the inclusive (.lte) and
      // exclusive (.lt) variants must exclude it.
      const eps = 1e-6;
      const bbox = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude - eps,
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude + 0.5,
      };

      const { data: lteData, error: lteErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(lteErr).toBeNull();
      expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
      for (const row of lteData ?? []) {
        expect(Number((row as any).latitude)).toBeLessThanOrEqual(bbox.latMax);
      }

      const { data: ltData, error: ltErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lt("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(ltErr).toBeNull();
      expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
      for (const row of ltData ?? []) {
        expect(Number((row as any).latitude)).toBeLessThan(bbox.latMax);
      }

      // Sanity: relaxing the upper bound by 2ε (just above providerD.latitude)
      // makes providerD reachable under .lte, proving exclusion above is due
      // to the bound rather than a missing row.
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", bbox.latMin)
        .lte("latitude", providerD.latitude + eps)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role bounding box with longitude upper bound one epsilon BELOW providerD's longitude excludes providerD with both .lte and .lt", async () => {
      const svc = serviceClient();

      // Mirror of the latitude variant — providerD's longitude is strictly
      // greater than the bound, so BOTH .lte and .lt must exclude it.
      const eps = 1e-6;
      const bbox = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude + 0.5,
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude - eps,
      };

      const { data: lteData, error: lteErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(lteErr).toBeNull();
      expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
      for (const row of lteData ?? []) {
        expect(Number((row as any).longitude)).toBeLessThanOrEqual(bbox.lonMax);
      }

      const { data: ltData, error: ltErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lt("longitude", bbox.lonMax);
      expect(ltErr).toBeNull();
      expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
      for (const row of ltData ?? []) {
        expect(Number((row as any).longitude)).toBeLessThan(bbox.lonMax);
      }

      // Sanity: relax the upper bound past providerD's longitude — providerD
      // becomes reachable, proving exclusion above is bound-driven.
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", providerD.longitude + eps);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    it("service role bounding box with longitude lower bound one epsilon ABOVE providerD's longitude excludes providerD with both .gte and .gt", async () => {
      const svc = serviceClient();

      // Lower bound sits ε above providerD.longitude — providerD's longitude
      // is strictly less than the bound, so BOTH .gte and .gt must exclude it.
      const eps = 1e-6;
      const bbox = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude + 0.5,
        lonMin: providerD.longitude + eps,
        lonMax: providerD.longitude + 0.5,
      };

      const { data: gteData, error: gteErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(gteErr).toBeNull();
      expect((gteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
      for (const row of gteData ?? []) {
        expect(Number((row as any).longitude)).toBeGreaterThanOrEqual(bbox.lonMin);
      }

      const { data: gtData, error: gtErr } = await svc
        .from("profiles")
        .select("id, user_id, email, latitude, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gt("longitude", bbox.lonMin)
        .lt("longitude", bbox.lonMax);
      expect(gtErr).toBeNull();
      expect((gtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
      for (const row of gtData ?? []) {
        expect(Number((row as any).longitude)).toBeGreaterThan(bbox.lonMin);
      }

      // Sanity: relax the lower bound below providerD.longitude — providerD
      // becomes reachable, proving exclusion above is bound-driven.
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", providerD.longitude - eps)
        .lte("longitude", bbox.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
    });

    describe("longitude inclusivity/exclusivity is stable across smaller epsilons near providerD", () => {
      for (const eps of [1e-7, 1e-8]) {
        it(`epsilon=${eps}: lonMax = providerD.longitude - eps excludes providerD with both .lte and .lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude - eps,
          };

          const { data: lteData, error: lteErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(lteErr).toBeNull();
          expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: ltData, error: ltErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lt("longitude", bbox.lonMax);
          expect(ltErr).toBeNull();
          expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });

        it(`epsilon=${eps}: lonMin = providerD.longitude + eps excludes providerD with both .gte and .gt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude + eps,
            lonMax: providerD.longitude + 0.5,
          };

          const { data: gteData, error: gteErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(gteErr).toBeNull();
          expect((gteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: gtData, error: gtErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gt("longitude", bbox.lonMin)
            .lt("longitude", bbox.lonMax);
          expect(gtErr).toBeNull();
          expect((gtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });

        it(`epsilon=${eps}: lonMax = providerD.longitude (exact) includes providerD with .lte and excludes with .lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude - eps,
            lonMax: providerD.longitude,
          };

          const { data: lteData, error: lteErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(lteErr).toBeNull();
          expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);

          const { data: ltData, error: ltErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lt("longitude", bbox.lonMax);
          expect(ltErr).toBeNull();
          expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });
      }
    });

    describe("latitude inclusivity/exclusivity is stable across smaller epsilons near providerD", () => {
      for (const eps of [1e-7, 1e-8]) {
        it(`epsilon=${eps}: latMax = providerD.latitude - eps excludes providerD with both .lte and .lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude - eps,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude + 0.5,
          };

          const { data: lteData, error: lteErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(lteErr).toBeNull();
          expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: ltData, error: ltErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lt("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(ltErr).toBeNull();
          expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });

        it(`epsilon=${eps}: latMin = providerD.latitude + eps excludes providerD with both .gte and .gt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude + eps,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude + 0.5,
          };

          const { data: gteData, error: gteErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(gteErr).toBeNull();
          expect((gteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: gtData, error: gtErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gt("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(gtErr).toBeNull();
          expect((gtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });

        it(`epsilon=${eps}: latMax = providerD.latitude (exact) includes providerD with .lte and excludes with .lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - eps,
            latMax: providerD.latitude,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude + 0.5,
          };

          const { data: lteData, error: lteErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(lteErr).toBeNull();
          expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);

          const { data: ltData, error: ltErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lt("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(ltErr).toBeNull();
          expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });
      }
    });

    it("service role bounding box with lonMin AND lonMax exactly equal to providerD.longitude includes providerD only with .gte+.lte", async () => {
      const svc = serviceClient();
      const bbox = {
        latMin: providerD.latitude - 0.5,
        latMax: providerD.latitude + 0.5,
        lonMin: providerD.longitude,
        lonMax: providerD.longitude,
      };

      // .gte + .lte: inclusive on both sides → providerD included (point query)
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);

      // .gt + .lte: exclusive lower → providerD excluded
      const { data: gtLteData, error: gtLteErr } = await svc
        .from("profiles")
        .select("user_id, email, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gt("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(gtLteErr).toBeNull();
      expect((gtLteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

      // .gte + .lt: exclusive upper → providerD excluded
      const { data: gteLtData, error: gteLtErr } = await svc
        .from("profiles")
        .select("user_id, email, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lt("longitude", bbox.lonMax);
      expect(gteLtErr).toBeNull();
      expect((gteLtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

      // .gt + .lt: exclusive on both sides → providerD excluded
      const { data: gtLtData, error: gtLtErr } = await svc
        .from("profiles")
        .select("user_id, email, longitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gt("longitude", bbox.lonMin)
        .lt("longitude", bbox.lonMax);
      expect(gtLtErr).toBeNull();
      expect((gtLtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
    });

    it("service role bounding box with latMin AND latMax exactly equal to providerD.latitude includes providerD only with .gte+.lte", async () => {
      const svc = serviceClient();
      const bbox = {
        latMin: providerD.latitude,
        latMax: providerD.latitude,
        lonMin: providerD.longitude - 0.5,
        lonMax: providerD.longitude + 0.5,
      };

      // .gte + .lte: inclusive on both sides → providerD included (point query)
      const { data: incData, error: incErr } = await svc
        .from("profiles")
        .select("user_id, email, latitude")
        .gte("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(incErr).toBeNull();
      expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);

      // .gt + .lte: exclusive lower → providerD excluded
      const { data: gtLteData, error: gtLteErr } = await svc
        .from("profiles")
        .select("user_id, email, latitude")
        .gt("latitude", bbox.latMin)
        .lte("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(gtLteErr).toBeNull();
      expect((gtLteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

      // .gte + .lt: exclusive upper → providerD excluded
      const { data: gteLtData, error: gteLtErr } = await svc
        .from("profiles")
        .select("user_id, email, latitude")
        .gte("latitude", bbox.latMin)
        .lt("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(gteLtErr).toBeNull();
      expect((gteLtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

      // .gt + .lt: exclusive on both sides → providerD excluded
      const { data: gtLtData, error: gtLtErr } = await svc
        .from("profiles")
        .select("user_id, email, latitude")
        .gt("latitude", bbox.latMin)
        .lt("latitude", bbox.latMax)
        .gte("longitude", bbox.lonMin)
        .lte("longitude", bbox.lonMax);
      expect(gtLtErr).toBeNull();
      expect((gtLtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
    });

    describe("latitude boundary remains consistent with +/- eps offsets around providerD.latitude", () => {
      for (const eps of [1e-6, 1e-7, 1e-8]) {
        it(`epsilon=${eps}: latMin=lat-eps, latMax=lat+eps includes providerD with .gte/.lte AND .gt/.lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - eps,
            latMax: providerD.latitude + eps,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude + 0.5,
          };

          // .gte + .lte (inclusive): providerD strictly inside → included
          const { data: incData, error: incErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(incErr).toBeNull();
          expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);

          // .gt + .lt (exclusive): providerD strictly between bounds → still included
          const { data: excData, error: excErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gt("latitude", bbox.latMin)
            .lt("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(excErr).toBeNull();
          expect((excData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
        });

        it(`epsilon=${eps}: latMin=lat+eps (bbox shifted above) excludes providerD with .gte and .gt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude + eps,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude + 0.5,
          };

          const { data: gteData, error: gteErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(gteErr).toBeNull();
          expect((gteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: gtData, error: gtErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gt("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(gtErr).toBeNull();
          expect((gtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });

        it(`epsilon=${eps}: latMax=lat-eps (bbox shifted below) excludes providerD with .lte and .lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude - eps,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude + 0.5,
          };

          const { data: lteData, error: lteErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(lteErr).toBeNull();
          expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: ltData, error: ltErr } = await svc
            .from("profiles")
            .select("user_id, email, latitude")
            .gte("latitude", bbox.latMin)
            .lt("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(ltErr).toBeNull();
          expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });
      }
    });

    describe("longitude boundary remains consistent with +/- eps offsets around providerD.longitude", () => {
      for (const eps of [1e-6, 1e-7, 1e-8]) {
        it(`epsilon=${eps}: lonMin=lon-eps, lonMax=lon+eps includes providerD with .gte/.lte AND .gt/.lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude - eps,
            lonMax: providerD.longitude + eps,
          };

          const { data: incData, error: incErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(incErr).toBeNull();
          expect((incData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);

          const { data: excData, error: excErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gt("longitude", bbox.lonMin)
            .lt("longitude", bbox.lonMax);
          expect(excErr).toBeNull();
          expect((excData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
        });

        it(`epsilon=${eps}: lonMin=lon+eps (bbox shifted east) excludes providerD with .gte and .gt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude + eps,
            lonMax: providerD.longitude + 0.5,
          };

          const { data: gteData, error: gteErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(gteErr).toBeNull();
          expect((gteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: gtData, error: gtErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gt("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(gtErr).toBeNull();
          expect((gtData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });

        it(`epsilon=${eps}: lonMax=lon-eps (bbox shifted west) excludes providerD with .lte and .lt`, async () => {
          const svc = serviceClient();
          const bbox = {
            latMin: providerD.latitude - 0.5,
            latMax: providerD.latitude + 0.5,
            lonMin: providerD.longitude - 0.5,
            lonMax: providerD.longitude - eps,
          };

          const { data: lteData, error: lteErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(lteErr).toBeNull();
          expect((lteData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const { data: ltData, error: ltErr } = await svc
            .from("profiles")
            .select("user_id, email, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lt("longitude", bbox.lonMax);
          expect(ltErr).toBeNull();
          expect((ltData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
        });
      }
    });

    it("service role degenerate bounding box at exact providerD corner: only fully-inclusive .gte+.lte on both axes returns providerD", async () => {
      const svc = serviceClient();
      const lat = providerD.latitude;
      const lon = providerD.longitude;

      const latOps = [
        { name: "gte+lte", lo: "gte" as const, hi: "lte" as const, expectAxisIncludes: true },
        { name: "gt+lte", lo: "gt" as const, hi: "lte" as const, expectAxisIncludes: false },
        { name: "gte+lt", lo: "gte" as const, hi: "lt" as const, expectAxisIncludes: false },
        { name: "gt+lt", lo: "gt" as const, hi: "lt" as const, expectAxisIncludes: false },
      ];
      const lonOps = latOps;

      for (const la of latOps) {
        for (const lo of lonOps) {
          const q = svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [la.lo]("latitude", lat)
            [la.hi]("latitude", lat)
            [lo.lo]("longitude", lon)
            [lo.hi]("longitude", lon);

          const { data, error } = await q;
          expect(error).toBeNull();

          // providerD is included only when BOTH axes are fully inclusive (.gte + .lte).
          const expected = la.expectAxisIncludes && lo.expectAxisIncludes;
          expect(
            (data ?? []).some((r: any) => r.user_id === providerD.userId),
          ).toBe(expected);
        }
      }
    });

    describe("inverted bounding boxes (lo > hi) consistently return no rows", () => {
      it("latMin > latMax returns zero rows", async () => {
        const svc = serviceClient();
        const { data, error } = await svc
          .from("profiles")
          .select("user_id, email, latitude, longitude")
          .gte("latitude", providerD.latitude + 0.5)
          .lte("latitude", providerD.latitude - 0.5)
          .gte("longitude", providerD.longitude - 0.5)
          .lte("longitude", providerD.longitude + 0.5);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("lonMin > lonMax returns zero rows", async () => {
        const svc = serviceClient();
        const { data, error } = await svc
          .from("profiles")
          .select("user_id, email, latitude, longitude")
          .gte("latitude", providerD.latitude - 0.5)
          .lte("latitude", providerD.latitude + 0.5)
          .gte("longitude", providerD.longitude + 0.5)
          .lte("longitude", providerD.longitude - 0.5);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("both axes inverted returns zero rows", async () => {
        const svc = serviceClient();
        const { data, error } = await svc
          .from("profiles")
          .select("user_id, email, latitude, longitude")
          .gte("latitude", providerD.latitude + 0.5)
          .lte("latitude", providerD.latitude - 0.5)
          .gte("longitude", providerD.longitude + 0.5)
          .lte("longitude", providerD.longitude - 0.5);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("inverted by exactly one epsilon at providerD's coordinates returns zero rows", async () => {
        const svc = serviceClient();
        const eps = 1e-6;
        const { data, error } = await svc
          .from("profiles")
          .select("user_id, email, latitude, longitude")
          .gte("latitude", providerD.latitude + eps)
          .lte("latitude", providerD.latitude - eps)
          .gte("longitude", providerD.longitude + eps)
          .lte("longitude", providerD.longitude - eps);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });
    });

    describe("collapsed-axis bounding boxes at providerD's coordinates", () => {
      const opPairs = [
        { name: "gte+lte", lo: "gte" as const, hi: "lte" as const, includes: true },
        { name: "gt+lte", lo: "gt" as const, hi: "lte" as const, includes: false },
        { name: "gte+lt", lo: "gte" as const, hi: "lt" as const, includes: false },
        { name: "gt+lt", lo: "gt" as const, hi: "lt" as const, includes: false },
      ];

      for (const op of opPairs) {
        it(`latMin=latMax=providerD.latitude with ${op.name} (lon spans range) ${op.includes ? "includes" : "excludes"} providerD`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [op.lo]("latitude", providerD.latitude)
            [op.hi]("latitude", providerD.latitude)
            .gte("longitude", providerD.longitude - 0.5)
            .lte("longitude", providerD.longitude + 0.5);
          expect(error).toBeNull();
          expect(
            (data ?? []).some((r: any) => r.user_id === providerD.userId),
          ).toBe(op.includes);
        });

        it(`lonMin=lonMax=providerD.longitude with ${op.name} (lat spans range) ${op.includes ? "includes" : "excludes"} providerD`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            .gte("latitude", providerD.latitude - 0.5)
            .lte("latitude", providerD.latitude + 0.5)
            [op.lo]("longitude", providerD.longitude)
            [op.hi]("longitude", providerD.longitude);
          expect(error).toBeNull();
          expect(
            (data ?? []).some((r: any) => r.user_id === providerD.userId),
          ).toBe(op.includes);
        });
      }
    });

    describe("collapsed-axis with strict-exclusive operators returns zero rows (impossible range)", () => {
      const strictPairs = [
        { name: "gt+lt", lo: "gt" as const, hi: "lt" as const },
        { name: "gt+lte", lo: "gt" as const, hi: "lte" as const },
        { name: "gte+lt", lo: "gte" as const, hi: "lt" as const },
      ];

      for (const op of strictPairs) {
        it(`latMin=latMax=providerD.latitude with ${op.name} on latitude returns zero rows`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [op.lo]("latitude", providerD.latitude)
            [op.hi]("latitude", providerD.latitude);
          expect(error).toBeNull();
          expect(data ?? []).toHaveLength(0);
        });

        it(`lonMin=lonMax=providerD.longitude with ${op.name} on longitude returns zero rows`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [op.lo]("longitude", providerD.longitude)
            [op.hi]("longitude", providerD.longitude);
          expect(error).toBeNull();
          expect(data ?? []).toHaveLength(0);
        });
      }
    });

    describe("collapsed-axis strict-exclusive on one axis with inclusive .gte/.lte range on the other returns zero rows", () => {
      const strictPairs = [
        { name: "gt+lt", lo: "gt" as const, hi: "lt" as const },
        { name: "gt+lte", lo: "gt" as const, hi: "lte" as const },
        { name: "gte+lt", lo: "gte" as const, hi: "lt" as const },
      ];

      for (const op of strictPairs) {
        it(`latMin=latMax=providerD.latitude with ${op.name} on latitude AND .gte/.lte longitude range still returns zero rows`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [op.lo]("latitude", providerD.latitude)
            [op.hi]("latitude", providerD.latitude)
            .gte("longitude", providerD.longitude - 0.5)
            .lte("longitude", providerD.longitude + 0.5);
          expect(error).toBeNull();
          expect(data ?? []).toHaveLength(0);
        });

        it(`lonMin=lonMax=providerD.longitude with ${op.name} on longitude AND .gte/.lte latitude range still returns zero rows`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            .gte("latitude", providerD.latitude - 0.5)
            .lte("latitude", providerD.latitude + 0.5)
            [op.lo]("longitude", providerD.longitude)
            [op.hi]("longitude", providerD.longitude);
          expect(error).toBeNull();
          expect(data ?? []).toHaveLength(0);
        });
      }
    });

    it("service role degenerate corner with strict-exclusive operators on BOTH axes returns zero rows for every combination", async () => {
      const svc = serviceClient();
      const strictPairs = [
        { name: "gt+lt", lo: "gt" as const, hi: "lt" as const },
        { name: "gt+lte", lo: "gt" as const, hi: "lte" as const },
        { name: "gte+lt", lo: "gte" as const, hi: "lt" as const },
      ];

      for (const la of strictPairs) {
        for (const lo of strictPairs) {
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [la.lo]("latitude", providerD.latitude)
            [la.hi]("latitude", providerD.latitude)
            [lo.lo]("longitude", providerD.longitude)
            [lo.hi]("longitude", providerD.longitude);
          expect(error, `lat=${la.name}, lon=${lo.name}`).toBeNull();
          expect(
            data ?? [],
            `lat=${la.name}, lon=${lo.name} should return zero rows`,
          ).toHaveLength(0);
        }
      }
    });

    it("randomized boundary fuzz: strict-inclusive .gte/.lte includes providerD and strict-exclusive .gt/.lt excludes providerD at exact edges", async () => {
      const svc = serviceClient();

      // Deterministic LCG seeded for reproducibility across runs.
      let seed = 0x12345678;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };

      const ITERATIONS = 12;
      for (let i = 0; i < ITERATIONS; i++) {
        // Random non-zero half-extent for the OPEN edge (the one not touching providerD).
        const latExtent = 0.05 + rand() * 0.5;
        const lonExtent = 0.05 + rand() * 0.5;
        // Randomly choose which of the 4 edges to pin to providerD's coordinate.
        const pinned = Math.floor(rand() * 4); // 0=latMin, 1=latMax, 2=lonMin, 3=lonMax

        const bbox = {
          latMin: providerD.latitude - latExtent,
          latMax: providerD.latitude + latExtent,
          lonMin: providerD.longitude - lonExtent,
          lonMax: providerD.longitude + lonExtent,
        };
        if (pinned === 0) bbox.latMin = providerD.latitude;
        else if (pinned === 1) bbox.latMax = providerD.latitude;
        else if (pinned === 2) bbox.lonMin = providerD.longitude;
        else bbox.lonMax = providerD.longitude;

        const tag = `iter=${i} pinned=${pinned} bbox=${JSON.stringify(bbox)}`;

        // Strict-inclusive on both axes → providerD must be returned.
        const inc = await svc
          .from("profiles")
          .select("user_id, email, latitude, longitude")
          .gte("latitude", bbox.latMin)
          .lte("latitude", bbox.latMax)
          .gte("longitude", bbox.lonMin)
          .lte("longitude", bbox.lonMax);
        expect(inc.error, tag).toBeNull();
        expect(
          (inc.data ?? []).some((r: any) => r.user_id === providerD.userId),
          `${tag} — strict-inclusive should include providerD`,
        ).toBe(true);

        // Strict-exclusive on the pinned axis must drop providerD (boundary leak guard).
        const exc = await svc
          .from("profiles")
          .select("user_id, email, latitude, longitude")
          [pinned === 0 ? "gt" : "gte"]("latitude", bbox.latMin)
          [pinned === 1 ? "lt" : "lte"]("latitude", bbox.latMax)
          [pinned === 2 ? "gt" : "gte"]("longitude", bbox.lonMin)
          [pinned === 3 ? "lt" : "lte"]("longitude", bbox.lonMax);
        expect(exc.error, tag).toBeNull();
        expect(
          (exc.data ?? []).some((r: any) => r.user_id === providerD.userId),
          `${tag} — strict-exclusive on pinned edge should exclude providerD`,
        ).toBe(false);

        // Fully strict-exclusive on BOTH axes also must not leak providerD.
        const fullyExc = await svc
          .from("profiles")
          .select("user_id, email, latitude, longitude")
          .gt("latitude", bbox.latMin)
          .lt("latitude", bbox.latMax)
          .gt("longitude", bbox.lonMin)
          .lt("longitude", bbox.lonMax);
        expect(fullyExc.error, tag).toBeNull();
        expect(
          (fullyExc.data ?? []).some((r: any) => r.user_id === providerD.userId),
          `${tag} — fully strict-exclusive should exclude providerD when an edge is pinned`,
        ).toBe(false);
      }
    });

    it("randomized opposite-edge boundary fuzz: pinning providerD to each of two opposing edges yields symmetric inclusive/exclusive behavior", async () => {
      const svc = serviceClient();

      // Deterministic LCG (different seed than the prior fuzz test).
      let seed = 0xdeadbeef;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };

      // Each pair represents two opposite edges of the bbox on the same axis.
      // For every iteration we test BOTH ends of the chosen pair, asserting
      // strict-inclusive includes providerD and strict-exclusive (on the
      // pinned edge) excludes providerD — proving symmetric behavior.
      const oppositePairs: Array<"lat" | "lon"> = ["lat", "lon"];

      const ITERATIONS = 10;
      for (let i = 0; i < ITERATIONS; i++) {
        const axis = oppositePairs[Math.floor(rand() * oppositePairs.length)];
        const otherExtent = 0.05 + rand() * 0.5;
        const sameExtent = 0.05 + rand() * 0.5;

        for (const edge of ["min", "max"] as const) {
          const bbox = {
            latMin: providerD.latitude - (axis === "lat" ? sameExtent : otherExtent),
            latMax: providerD.latitude + (axis === "lat" ? sameExtent : otherExtent),
            lonMin: providerD.longitude - (axis === "lon" ? sameExtent : otherExtent),
            lonMax: providerD.longitude + (axis === "lon" ? sameExtent : otherExtent),
          };
          if (axis === "lat" && edge === "min") bbox.latMin = providerD.latitude;
          else if (axis === "lat" && edge === "max") bbox.latMax = providerD.latitude;
          else if (axis === "lon" && edge === "min") bbox.lonMin = providerD.longitude;
          else if (axis === "lon" && edge === "max") bbox.lonMax = providerD.longitude;

          const tag = `iter=${i} axis=${axis} edge=${edge} bbox=${JSON.stringify(bbox)}`;

          // Strict-inclusive .gte/.lte on both axes must include providerD.
          const inc = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(inc.error, tag).toBeNull();
          expect(
            (inc.data ?? []).some((r: any) => r.user_id === providerD.userId),
            `${tag} — strict-inclusive should include providerD`,
          ).toBe(true);

          // Strict-exclusive on the pinned edge must drop providerD.
          const exc = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [axis === "lat" && edge === "min" ? "gt" : "gte"]("latitude", bbox.latMin)
            [axis === "lat" && edge === "max" ? "lt" : "lte"]("latitude", bbox.latMax)
            [axis === "lon" && edge === "min" ? "gt" : "gte"]("longitude", bbox.lonMin)
            [axis === "lon" && edge === "max" ? "lt" : "lte"]("longitude", bbox.lonMax);
          expect(exc.error, tag).toBeNull();
          expect(
            (exc.data ?? []).some((r: any) => r.user_id === providerD.userId),
            `${tag} — strict-exclusive on pinned ${axis}.${edge} edge should exclude providerD`,
          ).toBe(false);
        }
      }
    });

    it("randomized opposite-corner boundary fuzz: pinning providerD to each of two diagonally opposite corners yields symmetric inclusive/exclusive behavior", async () => {
      const svc = serviceClient();

      // Deterministic LCG (distinct seed for this test).
      let seed = 0xfeedface;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };

      // Two diagonal corner pairs: SW↔NE and NW↔SE
      // Corner encoded as { lat: "min"|"max", lon: "min"|"max" }
      const diagonals: Array<
        [{ lat: "min" | "max"; lon: "min" | "max" }, { lat: "min" | "max"; lon: "min" | "max" }]
      > = [
        [{ lat: "min", lon: "min" }, { lat: "max", lon: "max" }],
        [{ lat: "min", lon: "max" }, { lat: "max", lon: "min" }],
      ];

      const ITERATIONS = 10;
      for (let i = 0; i < ITERATIONS; i++) {
        const diagonal = diagonals[Math.floor(rand() * diagonals.length)];
        const latExtent = 0.05 + rand() * 0.5;
        const lonExtent = 0.05 + rand() * 0.5;

        for (const corner of diagonal) {
          const bbox = {
            latMin: providerD.latitude - latExtent,
            latMax: providerD.latitude + latExtent,
            lonMin: providerD.longitude - lonExtent,
            lonMax: providerD.longitude + lonExtent,
          };
          // Pin both axes' chosen edges to providerD's coordinates → corner.
          if (corner.lat === "min") bbox.latMin = providerD.latitude;
          else bbox.latMax = providerD.latitude;
          if (corner.lon === "min") bbox.lonMin = providerD.longitude;
          else bbox.lonMax = providerD.longitude;

          const tag = `iter=${i} corner=lat-${corner.lat}/lon-${corner.lon} bbox=${JSON.stringify(bbox)}`;

          // Strict-inclusive .gte/.lte on both axes must include providerD.
          const inc = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(inc.error, tag).toBeNull();
          expect(
            (inc.data ?? []).some((r: any) => r.user_id === providerD.userId),
            `${tag} — strict-inclusive should include providerD at the corner`,
          ).toBe(true);

          // Strict-exclusive on the pinned latitude edge ONLY → excludes providerD.
          const excLat = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [corner.lat === "min" ? "gt" : "gte"]("latitude", bbox.latMin)
            [corner.lat === "max" ? "lt" : "lte"]("latitude", bbox.latMax)
            .gte("longitude", bbox.lonMin)
            .lte("longitude", bbox.lonMax);
          expect(excLat.error, tag).toBeNull();
          expect(
            (excLat.data ?? []).some((r: any) => r.user_id === providerD.userId),
            `${tag} — strict-exclusive on pinned latitude edge should exclude providerD`,
          ).toBe(false);

          // Strict-exclusive on the pinned longitude edge ONLY → excludes providerD.
          const excLon = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            .gte("latitude", bbox.latMin)
            .lte("latitude", bbox.latMax)
            [corner.lon === "min" ? "gt" : "gte"]("longitude", bbox.lonMin)
            [corner.lon === "max" ? "lt" : "lte"]("longitude", bbox.lonMax);
          expect(excLon.error, tag).toBeNull();
          expect(
            (excLon.data ?? []).some((r: any) => r.user_id === providerD.userId),
            `${tag} — strict-exclusive on pinned longitude edge should exclude providerD`,
          ).toBe(false);

          // Strict-exclusive on BOTH pinned edges → excludes providerD.
          const excBoth = await svc
            .from("profiles")
            .select("user_id, email, latitude, longitude")
            [corner.lat === "min" ? "gt" : "gte"]("latitude", bbox.latMin)
            [corner.lat === "max" ? "lt" : "lte"]("latitude", bbox.latMax)
            [corner.lon === "min" ? "gt" : "gte"]("longitude", bbox.lonMin)
            [corner.lon === "max" ? "lt" : "lte"]("longitude", bbox.lonMax);
          expect(excBoth.error, tag).toBeNull();
          expect(
            (excBoth.data ?? []).some((r: any) => r.user_id === providerD.userId),
            `${tag} — strict-exclusive on BOTH pinned edges should exclude providerD`,
          ).toBe(false);
        }
      }
    });

    describe("deterministic epsilon-offset corner boundary tests", () => {
      // All four corners of a bbox, expressed as which axis edge is "near" providerD.
      // For each corner we build a bbox whose two near-edges sit at providerD.coord +/- eps
      // (just inside) or at providerD.coord shifted past it by eps (just outside).
      const corners: Array<{
        name: string;
        lat: "min" | "max";
        lon: "min" | "max";
      }> = [
        { name: "SW", lat: "min", lon: "min" },
        { name: "NE", lat: "max", lon: "max" },
        { name: "NW", lat: "max", lon: "min" },
        { name: "SE", lat: "min", lon: "max" },
      ];
      const epsilons = [1e-6, 1e-7, 1e-8];
      const FAR = 0.5;

      for (const corner of corners) {
        for (const eps of epsilons) {
          it(`${corner.name} corner, eps=${eps}: providerD JUST INSIDE → strict-inclusive includes providerD`, async () => {
            const svc = serviceClient();
            const bbox = {
              latMin: providerD.latitude - FAR,
              latMax: providerD.latitude + FAR,
              lonMin: providerD.longitude - FAR,
              lonMax: providerD.longitude + FAR,
            };
            // Pull the near edges in toward providerD by eps so providerD remains strictly inside.
            if (corner.lat === "min") bbox.latMin = providerD.latitude - eps;
            else bbox.latMax = providerD.latitude + eps;
            if (corner.lon === "min") bbox.lonMin = providerD.longitude - eps;
            else bbox.lonMax = providerD.longitude + eps;

            const { data, error } = await svc
              .from("profiles")
              .select("user_id, email, latitude, longitude")
              .gte("latitude", bbox.latMin)
              .lte("latitude", bbox.latMax)
              .gte("longitude", bbox.lonMin)
              .lte("longitude", bbox.lonMax);
            expect(error).toBeNull();
            expect((data ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
          });

          it(`${corner.name} corner, eps=${eps}: providerD JUST OUTSIDE → strict-inclusive excludes providerD`, async () => {
            const svc = serviceClient();
            const bbox = {
              latMin: providerD.latitude - FAR,
              latMax: providerD.latitude + FAR,
              lonMin: providerD.longitude - FAR,
              lonMax: providerD.longitude + FAR,
            };
            // Push the near edges past providerD by eps so providerD lies just outside on both axes.
            if (corner.lat === "min") bbox.latMin = providerD.latitude + eps;
            else bbox.latMax = providerD.latitude - eps;
            if (corner.lon === "min") bbox.lonMin = providerD.longitude + eps;
            else bbox.lonMax = providerD.longitude - eps;

            const { data, error } = await svc
              .from("profiles")
              .select("user_id, email, latitude, longitude")
              .gte("latitude", bbox.latMin)
              .lte("latitude", bbox.latMax)
              .gte("longitude", bbox.lonMin)
              .lte("longitude", bbox.lonMax);
            expect(error).toBeNull();
            expect((data ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
          });
        }
      }
    });

    describe("deterministic epsilon-offset corner boundary tests with strict-exclusive operators", () => {
      const corners: Array<{
        name: string;
        lat: "min" | "max";
        lon: "min" | "max";
      }> = [
        { name: "SW", lat: "min", lon: "min" },
        { name: "NE", lat: "max", lon: "max" },
        { name: "NW", lat: "max", lon: "min" },
        { name: "SE", lat: "min", lon: "max" },
      ];
      const epsilons = [1e-6, 1e-7, 1e-8];
      const FAR = 0.5;

      for (const corner of corners) {
        for (const eps of epsilons) {
          // JUST INSIDE: providerD lies strictly between bounds → strict-exclusive INCLUDES.
          it(`${corner.name} corner, eps=${eps}: providerD JUST INSIDE → strict-exclusive .gt/.lt INCLUDES providerD (strictly interior)`, async () => {
            const svc = serviceClient();
            const bbox = {
              latMin: providerD.latitude - FAR,
              latMax: providerD.latitude + FAR,
              lonMin: providerD.longitude - FAR,
              lonMax: providerD.longitude + FAR,
            };
            if (corner.lat === "min") bbox.latMin = providerD.latitude - eps;
            else bbox.latMax = providerD.latitude + eps;
            if (corner.lon === "min") bbox.lonMin = providerD.longitude - eps;
            else bbox.lonMax = providerD.longitude + eps;

            const { data, error } = await svc
              .from("profiles")
              .select("user_id, email, latitude, longitude")
              .gt("latitude", bbox.latMin)
              .lt("latitude", bbox.latMax)
              .gt("longitude", bbox.lonMin)
              .lt("longitude", bbox.lonMax);
            expect(error).toBeNull();
            expect((data ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
          });

          // JUST OUTSIDE: providerD lies strictly outside on both pinned axes → strict-exclusive EXCLUDES.
          it(`${corner.name} corner, eps=${eps}: providerD JUST OUTSIDE → strict-exclusive .gt/.lt EXCLUDES providerD`, async () => {
            const svc = serviceClient();
            const bbox = {
              latMin: providerD.latitude - FAR,
              latMax: providerD.latitude + FAR,
              lonMin: providerD.longitude - FAR,
              lonMax: providerD.longitude + FAR,
            };
            if (corner.lat === "min") bbox.latMin = providerD.latitude + eps;
            else bbox.latMax = providerD.latitude - eps;
            if (corner.lon === "min") bbox.lonMin = providerD.longitude + eps;
            else bbox.lonMax = providerD.longitude - eps;

            const { data, error } = await svc
              .from("profiles")
              .select("user_id, email, latitude, longitude")
              .gt("latitude", bbox.latMin)
              .lt("latitude", bbox.latMax)
              .gt("longitude", bbox.lonMin)
              .lt("longitude", bbox.lonMax);
            expect(error).toBeNull();
            expect((data ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
          });

          // Mixed: inside with strict-exclusive on the corner edges only (other edges inclusive) still INCLUDES.
          it(`${corner.name} corner, eps=${eps}: providerD JUST INSIDE → strict-exclusive on corner edges only INCLUDES providerD`, async () => {
            const svc = serviceClient();
            const bbox = {
              latMin: providerD.latitude - FAR,
              latMax: providerD.latitude + FAR,
              lonMin: providerD.longitude - FAR,
              lonMax: providerD.longitude + FAR,
            };
            if (corner.lat === "min") bbox.latMin = providerD.latitude - eps;
            else bbox.latMax = providerD.latitude + eps;
            if (corner.lon === "min") bbox.lonMin = providerD.longitude - eps;
            else bbox.lonMax = providerD.longitude + eps;

            const { data, error } = await svc
              .from("profiles")
              .select("user_id, email, latitude, longitude")
              [corner.lat === "min" ? "gt" : "gte"]("latitude", bbox.latMin)
              [corner.lat === "max" ? "lt" : "lte"]("latitude", bbox.latMax)
              [corner.lon === "min" ? "gt" : "gte"]("longitude", bbox.lonMin)
              [corner.lon === "max" ? "lt" : "lte"]("longitude", bbox.lonMax);
            expect(error).toBeNull();
            expect((data ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
          });

          // Mixed: outside with strict-exclusive on the corner edges only still EXCLUDES.
          it(`${corner.name} corner, eps=${eps}: providerD JUST OUTSIDE → strict-exclusive on corner edges only EXCLUDES providerD`, async () => {
            const svc = serviceClient();
            const bbox = {
              latMin: providerD.latitude - FAR,
              latMax: providerD.latitude + FAR,
              lonMin: providerD.longitude - FAR,
              lonMax: providerD.longitude + FAR,
            };
            if (corner.lat === "min") bbox.latMin = providerD.latitude + eps;
            else bbox.latMax = providerD.latitude - eps;
            if (corner.lon === "min") bbox.lonMin = providerD.longitude + eps;
            else bbox.lonMax = providerD.longitude - eps;

            const { data, error } = await svc
              .from("profiles")
              .select("user_id, email, latitude, longitude")
              [corner.lat === "min" ? "gt" : "gte"]("latitude", bbox.latMin)
              [corner.lat === "max" ? "lt" : "lte"]("latitude", bbox.latMax)
              [corner.lon === "min" ? "gt" : "gte"]("longitude", bbox.lonMin)
              [corner.lon === "max" ? "lt" : "lte"]("longitude", bbox.lonMax);
            expect(error).toBeNull();
            expect((data ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);
          });
        }
      }
    });

    it("service role select WITHOUT requesting sensitive columns does not return them in the payload", async () => {
      const svc = serviceClient();
      const { data, error } = await svc
        .from("profiles")
        .select("id, full_name, role")
        .in("email", [providerA.email, providerB.email, providerC.email]);

      expect(error).toBeNull();
      expect((data ?? []).length).toBe(3);
      for (const row of data ?? []) {
        const keys = Object.keys(row as any);
        for (const col of SENSITIVE_COLUMNS) {
          expect(keys).not.toContain(col);
        }
      }
    });

    describe("RLS-blocked filters cannot be used to infer rows", () => {
      for (const col of SENSITIVE_COLUMNS) {
        const probeValue = (p: typeof providerA) =>
          col === "email"
            ? p.email
            : col === "latitude"
              ? p.latitude
              : p.longitude;

        it(`anonymous client filtering profiles by "${col}" returns no rows`, async () => {
          const anon = anonClient();
          const { data } = await anon
            .from("profiles")
            .select("id")
            .eq(col, probeValue(providerA) as any);
          expect(data ?? []).toHaveLength(0);
        });

        it(`authenticated non-owner filtering profiles by "${col}" returns no rows`, async () => {
          const { data } = await nonOwner.client
            .from("profiles")
            .select("id")
            .eq(col, probeValue(providerA) as any);
          expect(data ?? []).toHaveLength(0);
        });

        it(`service role filtering profiles by "${col}" still finds the matching provider (sanity)`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("id, user_id, email, latitude, longitude")
            .eq(col, probeValue(providerA) as any);
          expect(error).toBeNull();
          expect((data ?? []).some((r) => (r as any).user_id === providerA.userId)).toBe(true);
        });
      }
    });

    describe("executed bbox snapshot — providerD inclusion/exclusion across gt/gte/lt/lte permutations", () => {
      // Pin the bbox bounds exactly to providerD's coordinates. ProviderD is
      // included iff BOTH lat ops AND BOTH lon ops are inclusive (gte/lte).
      // Any single strict (gt/lt) bound on the corner excludes providerD.
      const ops = [
        { name: "gte+lte", lo: "gte" as const, hi: "lte" as const },
        { name: "gt+lte", lo: "gt" as const, hi: "lte" as const },
        { name: "gte+lt", lo: "gte" as const, hi: "lt" as const },
        { name: "gt+lt", lo: "gt" as const, hi: "lt" as const },
      ];

      for (const la of ops) {
        for (const lo of ops) {
          it(`lat=${la.name}, lon=${lo.name} executed bbox snapshot of providerD membership`, async () => {
            const svc = serviceClient();
            const { data, error } = await svc
              .from("profiles")
              .select("user_id, latitude, longitude")
              [la.lo]("latitude", providerD.latitude)
              [la.hi]("latitude", providerD.latitude)
              [lo.lo]("longitude", providerD.longitude)
              [lo.hi]("longitude", providerD.longitude);

            expect(error).toBeNull();
            const includesProviderD = (data ?? []).some(
              (r: any) => r.user_id === providerD.userId,
            );

            const expectedInclusion =
              la.lo === "gte" && la.hi === "lte" && lo.lo === "gte" && lo.hi === "lte";
            expect(includesProviderD).toBe(expectedInclusion);

            expect({
              permutation: { lat: la.name, lon: lo.name },
              includesProviderD,
            }).toMatchSnapshot();
          });
        }
      }
    });

    describe("single strict bound + corners moved off providerD coords still excludes providerD", () => {
      // For each axis bound, build a bbox where THAT bound is strict (gt/lt)
      // and is positioned past providerD on the corresponding axis so providerD
      // sits outside the bbox. The other three bounds are wide and inclusive
      // (gte/lte) so the only thing keeping providerD out is the corner shift,
      // not the strictness. ProviderD must be excluded in all four cases.
      const DELTA = 0.01;
      const WIDE = 1;

      type Case = {
        name: string;
        bounds: () => {
          latMinOp: "gte" | "gt";
          latMin: number;
          latMaxOp: "lte" | "lt";
          latMax: number;
          lonMinOp: "gte" | "gt";
          lonMin: number;
          lonMaxOp: "lte" | "lt";
          lonMax: number;
        };
      };

      const cases: Case[] = [
        {
          name: "latMin strict (gt), corner shifted ABOVE providerD latitude",
          bounds: () => ({
            latMinOp: "gt",
            latMin: providerD.latitude + DELTA,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
        },
        {
          name: "latMax strict (lt), corner shifted BELOW providerD latitude",
          bounds: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lt",
            latMax: providerD.latitude - DELTA,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
        },
        {
          name: "lonMin strict (gt), corner shifted ABOVE providerD longitude",
          bounds: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gt",
            lonMin: providerD.longitude + DELTA,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
        },
        {
          name: "lonMax strict (lt), corner shifted BELOW providerD longitude",
          bounds: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lt",
            lonMax: providerD.longitude - DELTA,
          }),
        },
      ];

      for (const c of cases) {
        it(`${c.name} excludes providerD`, async () => {
          const svc = serviceClient();
          const b = c.bounds();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            [b.latMinOp]("latitude", b.latMin)
            [b.latMaxOp]("latitude", b.latMax)
            [b.lonMinOp]("longitude", b.lonMin)
            [b.lonMaxOp]("longitude", b.lonMax);

          expect(error).toBeNull();
          const includesProviderD = (data ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(includesProviderD).toBe(false);

          // Inverse sanity: making the strict bound inclusive AND pulling the
          // shifted corner back past providerD must include providerD again,
          // proving the exclusion above is driven by the corner shift rather
          // than by providerD being unreachable for unrelated reasons.
          const inv = { ...b };
          if (inv.latMinOp === "gt") {
            inv.latMinOp = "gte";
            inv.latMin = providerD.latitude - DELTA;
          } else if (inv.latMaxOp === "lt") {
            inv.latMaxOp = "lte";
            inv.latMax = providerD.latitude + DELTA;
          } else if (inv.lonMinOp === "gt") {
            inv.lonMinOp = "gte";
            inv.lonMin = providerD.longitude - DELTA;
          } else if (inv.lonMaxOp === "lt") {
            inv.lonMaxOp = "lte";
            inv.lonMax = providerD.longitude + DELTA;
          }
          const { data: invData, error: invErr } = await svc
            .from("profiles")
            .select("user_id")
            [inv.latMinOp]("latitude", inv.latMin)
            [inv.latMaxOp]("latitude", inv.latMax)
            [inv.lonMinOp]("longitude", inv.lonMin)
            [inv.lonMaxOp]("longitude", inv.lonMax);
          expect(invErr).toBeNull();
          expect((invData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
        });
      }
    });

    describe("two opposite strict bounds + corresponding corners shifted off providerD coords excludes providerD", () => {
      // "Opposite bounds" = the min AND max bounds on the SAME axis are both
      // strict (gt/lt). The two corners on that axis are also shifted to the
      // SAME side of providerD so providerD sits outside the bbox on that axis.
      // The other axis is wide and inclusive. ProviderD must be excluded.
      const DELTA = 0.01;
      const WIDE = 1;

      type Case = {
        name: string;
        bounds: () => {
          latMinOp: "gte" | "gt";
          latMin: number;
          latMaxOp: "lte" | "lt";
          latMax: number;
          lonMinOp: "gte" | "gt";
          lonMin: number;
          lonMaxOp: "lte" | "lt";
          lonMax: number;
        };
        // Inverse: relax both strict bounds AND pull both corners back so
        // providerD lands inside, proving the exclusion was driven by the
        // shift, not by providerD being unreachable.
        inverse: () => ReturnType<Case["bounds"]>;
      };

      const cases: Case[] = [
        {
          name: "lat both strict (gt+lt), corners ABOVE providerD latitude",
          bounds: () => ({
            latMinOp: "gt",
            latMin: providerD.latitude + DELTA,
            latMaxOp: "lt",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
          inverse: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - DELTA,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
        },
        {
          name: "lat both strict (gt+lt), corners BELOW providerD latitude",
          bounds: () => ({
            latMinOp: "gt",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lt",
            latMax: providerD.latitude - DELTA,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
          inverse: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lte",
            latMax: providerD.latitude + DELTA,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
        },
        {
          name: "lon both strict (gt+lt), corners ABOVE providerD longitude",
          bounds: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gt",
            lonMin: providerD.longitude + DELTA,
            lonMaxOp: "lt",
            lonMax: providerD.longitude + WIDE,
          }),
          inverse: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gte",
            lonMin: providerD.longitude - DELTA,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + WIDE,
          }),
        },
        {
          name: "lon both strict (gt+lt), corners BELOW providerD longitude",
          bounds: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gt",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lt",
            lonMax: providerD.longitude - DELTA,
          }),
          inverse: () => ({
            latMinOp: "gte",
            latMin: providerD.latitude - WIDE,
            latMaxOp: "lte",
            latMax: providerD.latitude + WIDE,
            lonMinOp: "gte",
            lonMin: providerD.longitude - WIDE,
            lonMaxOp: "lte",
            lonMax: providerD.longitude + DELTA,
          }),
        },
      ];

      for (const c of cases) {
        it(`${c.name} excludes providerD`, async () => {
          const svc = serviceClient();
          const b = c.bounds();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            [b.latMinOp]("latitude", b.latMin)
            [b.latMaxOp]("latitude", b.latMax)
            [b.lonMinOp]("longitude", b.lonMin)
            [b.lonMaxOp]("longitude", b.lonMax);
          expect(error).toBeNull();
          expect((data ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(false);

          const inv = c.inverse();
          const { data: invData, error: invErr } = await svc
            .from("profiles")
            .select("user_id")
            [inv.latMinOp]("latitude", inv.latMin)
            [inv.latMaxOp]("latitude", inv.latMax)
            [inv.lonMinOp]("longitude", inv.lonMin)
            [inv.lonMaxOp]("longitude", inv.lonMax);
          expect(invErr).toBeNull();
          expect((invData ?? []).some((r: any) => r.user_id === providerD.userId)).toBe(true);
        });
      }
    });

    describe("lat strict (gt+lt) + lon inclusive (gte+lte): all 4 latitude corner combinations", () => {
      // latMin/latMax are STRICT (gt/lt). lonMin/lonMax are INCLUSIVE (gte/lte)
      // and wide so the longitude band always contains providerD.
      // The 4 combinations enumerate latMin and latMax on either side of
      // providerD's latitude:
      //   1. latMin BELOW & latMax ABOVE  → D inside band  → INCLUDED
      //   2. latMin ABOVE & latMax ABOVE  → band above D   → EXCLUDED
      //   3. latMin BELOW & latMax BELOW  → band below D   → EXCLUDED
      //   4. latMin ABOVE & latMax BELOW  → inverted/empty → EXCLUDED
      const DELTA = 0.01;
      const WIDE = 1;

      const cases: Array<{
        name: string;
        latMin: () => number;
        latMax: () => number;
        expectIncluded: boolean;
      }> = [
        {
          name: "latMin BELOW + latMax ABOVE providerD (band straddles D)",
          latMin: () => providerD.latitude - DELTA,
          latMax: () => providerD.latitude + DELTA,
          expectIncluded: true,
        },
        {
          name: "latMin ABOVE + latMax ABOVE providerD (band entirely above D)",
          latMin: () => providerD.latitude + DELTA,
          latMax: () => providerD.latitude + WIDE,
          expectIncluded: false,
        },
        {
          name: "latMin BELOW + latMax BELOW providerD (band entirely below D)",
          latMin: () => providerD.latitude - WIDE,
          latMax: () => providerD.latitude - DELTA,
          expectIncluded: false,
        },
        {
          name: "latMin ABOVE + latMax BELOW providerD (inverted/empty band)",
          latMin: () => providerD.latitude + DELTA,
          latMax: () => providerD.latitude - DELTA,
          expectIncluded: false,
        },
      ];

      for (const c of cases) {
        it(`${c.name} → ${c.expectIncluded ? "includes" : "excludes"} providerD`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gt("latitude", c.latMin())
            .lt("latitude", c.latMax())
            .gte("longitude", providerD.longitude - WIDE)
            .lte("longitude", providerD.longitude + WIDE);
          expect(error).toBeNull();
          const includesProviderD = (data ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(includesProviderD).toBe(c.expectIncluded);
        });
      }
    });

    describe("lon strict (gt+lt) + lat inclusive (gte+lte): all 4 longitude corner combinations", () => {
      // lonMin/lonMax are STRICT (gt/lt). latMin/latMax are INCLUSIVE (gte/lte)
      // and wide so the latitude band always contains providerD.
      // The 4 combinations enumerate lonMin and lonMax on either side of
      // providerD's longitude:
      //   1. lonMin BELOW & lonMax ABOVE  → D inside band  → INCLUDED
      //   2. lonMin ABOVE & lonMax ABOVE  → band above D   → EXCLUDED
      //   3. lonMin BELOW & lonMax BELOW  → band below D   → EXCLUDED
      //   4. lonMin ABOVE & lonMax BELOW  → inverted/empty → EXCLUDED
      const DELTA = 0.01;
      const WIDE = 1;

      const cases: Array<{
        name: string;
        lonMin: () => number;
        lonMax: () => number;
        expectIncluded: boolean;
      }> = [
        {
          name: "lonMin BELOW + lonMax ABOVE providerD (band straddles D)",
          lonMin: () => providerD.longitude - DELTA,
          lonMax: () => providerD.longitude + DELTA,
          expectIncluded: true,
        },
        {
          name: "lonMin ABOVE + lonMax ABOVE providerD (band entirely above D)",
          lonMin: () => providerD.longitude + DELTA,
          lonMax: () => providerD.longitude + WIDE,
          expectIncluded: false,
        },
        {
          name: "lonMin BELOW + lonMax BELOW providerD (band entirely below D)",
          lonMin: () => providerD.longitude - WIDE,
          lonMax: () => providerD.longitude - DELTA,
          expectIncluded: false,
        },
        {
          name: "lonMin ABOVE + lonMax BELOW providerD (inverted/empty band)",
          lonMin: () => providerD.longitude + DELTA,
          lonMax: () => providerD.longitude - DELTA,
          expectIncluded: false,
        },
      ];

      for (const c of cases) {
        it(`${c.name} → ${c.expectIncluded ? "includes" : "excludes"} providerD`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gte("latitude", providerD.latitude - WIDE)
            .lte("latitude", providerD.latitude + WIDE)
            .gt("longitude", c.lonMin())
            .lt("longitude", c.lonMax());
          expect(error).toBeNull();
          const includesProviderD = (data ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(includesProviderD).toBe(c.expectIncluded);
        });
      }
    });

    describe("lon inclusive (gte+lte) inverse: boundary corner shifts flip providerD inclusion vs strict", () => {
      // Mirror of the strict-longitude block above, but lonMin/lonMax now use
      // INCLUSIVE operators (gte/lte). Corner shifts are placed exactly AT or
      // around providerD's longitude so that flipping gt→gte and lt→lte
      // actually changes the membership outcome on the boundary. Latitude
      // band stays wide+inclusive so longitude is the only deciding axis.
      const WIDE = 1;

      const cases: Array<{
        name: string;
        lonMin: () => number;
        lonMax: () => number;
        expectIncluded: boolean;
        flipNote: string;
      }> = [
        {
          name: "lonMin BELOW + lonMax ABOVE providerD (band straddles D)",
          lonMin: () => providerD.longitude - WIDE,
          lonMax: () => providerD.longitude + WIDE,
          expectIncluded: true,
          flipNote: "control — D strictly interior, included under both strict and inclusive",
        },
        {
          name: "lonMin AT providerD + lonMax ABOVE (D on lower edge)",
          lonMin: () => providerD.longitude,
          lonMax: () => providerD.longitude + WIDE,
          expectIncluded: true,
          flipNote: "FLIPS vs strict gt — gte includes the lower edge",
        },
        {
          name: "lonMin BELOW + lonMax AT providerD (D on upper edge)",
          lonMin: () => providerD.longitude - WIDE,
          lonMax: () => providerD.longitude,
          expectIncluded: true,
          flipNote: "FLIPS vs strict lt — lte includes the upper edge",
        },
        {
          name: "lonMin AT providerD + lonMax AT providerD (degenerate point band)",
          lonMin: () => providerD.longitude,
          lonMax: () => providerD.longitude,
          expectIncluded: true,
          flipNote: "FLIPS vs strict — gte+lte at the same point matches D exactly",
        },
      ];

      for (const c of cases) {
        it(`${c.name} → ${c.expectIncluded ? "includes" : "excludes"} providerD (${c.flipNote})`, async () => {
          const svc = serviceClient();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gte("latitude", providerD.latitude - WIDE)
            .lte("latitude", providerD.latitude + WIDE)
            .gte("longitude", c.lonMin())
            .lte("longitude", c.lonMax());
          expect(error).toBeNull();
          const includesProviderD = (data ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(includesProviderD).toBe(c.expectIncluded);

          // Cross-check: same exact corners with STRICT operators must EXCLUDE
          // providerD for any case where the inclusive version sits on a
          // boundary (i.e., lonMin === D.lon or lonMax === D.lon). For the
          // strictly-interior straddle case, both operator variants include D.
          const onBoundary =
            c.lonMin() === providerD.longitude || c.lonMax() === providerD.longitude;
          const { data: strictData, error: strictErr } = await svc
            .from("profiles")
            .select("user_id")
            .gte("latitude", providerD.latitude - WIDE)
            .lte("latitude", providerD.latitude + WIDE)
            .gt("longitude", c.lonMin())
            .lt("longitude", c.lonMax());
          expect(strictErr).toBeNull();
          const strictIncludes = (strictData ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          if (onBoundary) {
            expect(strictIncludes).toBe(false);
            expect(includesProviderD).not.toBe(strictIncludes);
          } else {
            expect(strictIncludes).toBe(includesProviderD);
          }
        });
      }
    });

    describe("lonMin === lonMax (point longitude): gte/lte vs strict gt/lt", () => {
      // Pin lonMin and lonMax to the exact same longitude. Latitude band is
      // wide+inclusive so longitude is the only deciding axis. With inclusive
      // operators (gte+lte) and lon === providerD.longitude the degenerate
      // point band must MATCH providerD; with strict operators (gt+lt) it
      // must EXCLUDE providerD because no value can be both > x and < x.
      const WIDE = 1;
      const OFFSET = 0.01;

      const cases: Array<{
        name: string;
        point: () => number;
        expectInclusive: boolean;
        expectStrict: boolean;
      }> = [
        {
          name: "point AT providerD.longitude",
          point: () => providerD.longitude,
          expectInclusive: true, // gte+lte at D.lon matches D
          expectStrict: false, // gt+lt at D.lon is empty interval
        },
        {
          name: "point ABOVE providerD.longitude",
          point: () => providerD.longitude + OFFSET,
          expectInclusive: false, // gte+lte at non-D point only matches that point
          expectStrict: false, // gt+lt is empty regardless
        },
        {
          name: "point BELOW providerD.longitude",
          point: () => providerD.longitude - OFFSET,
          expectInclusive: false,
          expectStrict: false,
        },
      ];

      for (const c of cases) {
        it(`${c.name} → inclusive ${c.expectInclusive ? "includes" : "excludes"}, strict ${c.expectStrict ? "includes" : "excludes"} providerD`, async () => {
          const svc = serviceClient();
          const lon = c.point();

          // Inclusive: gte + lte at the same longitude.
          const { data: incData, error: incErr } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gte("latitude", providerD.latitude - WIDE)
            .lte("latitude", providerD.latitude + WIDE)
            .gte("longitude", lon)
            .lte("longitude", lon);
          expect(incErr).toBeNull();
          const inclusiveIncludes = (incData ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(inclusiveIncludes).toBe(c.expectInclusive);

          // Strict: gt + lt at the same longitude → always empty interval.
          const { data: strictData, error: strictErr } = await svc
            .from("profiles")
            .select("user_id")
            .gte("latitude", providerD.latitude - WIDE)
            .lte("latitude", providerD.latitude + WIDE)
            .gt("longitude", lon)
            .lt("longitude", lon);
          expect(strictErr).toBeNull();
          const strictIncludes = (strictData ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(strictIncludes).toBe(c.expectStrict);

          // Cross-axis sanity: when point sits exactly at D.lon the operator
          // choice is what flips the outcome; otherwise both must agree.
          if (lon === providerD.longitude) {
            expect(inclusiveIncludes).not.toBe(strictIncludes);
          } else {
            expect(inclusiveIncludes).toBe(strictIncludes);
          }
        });
      }
    });

    describe("latMin === latMax (point latitude): gte/lte vs strict gt/lt", () => {
      // Mirror of the point-longitude block, but on the latitude axis.
      // Pin latMin and latMax to the exact same latitude. Longitude band is
      // wide+inclusive so latitude is the only deciding axis. With inclusive
      // operators (gte+lte) and lat === providerD.latitude the degenerate
      // point band must MATCH providerD; with strict operators (gt+lt) it
      // must EXCLUDE providerD because no value can be both > x and < x.
      const WIDE = 1;
      const OFFSET = 0.01;

      const cases: Array<{
        name: string;
        point: () => number;
        expectInclusive: boolean;
        expectStrict: boolean;
      }> = [
        {
          name: "point AT providerD.latitude",
          point: () => providerD.latitude,
          expectInclusive: true, // gte+lte at D.lat matches D
          expectStrict: false, // gt+lt at D.lat is empty interval
        },
        {
          name: "point ABOVE providerD.latitude",
          point: () => providerD.latitude + OFFSET,
          expectInclusive: false,
          expectStrict: false,
        },
        {
          name: "point BELOW providerD.latitude",
          point: () => providerD.latitude - OFFSET,
          expectInclusive: false,
          expectStrict: false,
        },
      ];

      for (const c of cases) {
        it(`${c.name} → inclusive ${c.expectInclusive ? "includes" : "excludes"}, strict ${c.expectStrict ? "includes" : "excludes"} providerD`, async () => {
          const svc = serviceClient();
          const lat = c.point();

          // Inclusive: gte + lte at the same latitude.
          const { data: incData, error: incErr } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gte("longitude", providerD.longitude - WIDE)
            .lte("longitude", providerD.longitude + WIDE)
            .gte("latitude", lat)
            .lte("latitude", lat);
          expect(incErr).toBeNull();
          const inclusiveIncludes = (incData ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(inclusiveIncludes).toBe(c.expectInclusive);

          // Strict: gt + lt at the same latitude → always empty interval.
          const { data: strictData, error: strictErr } = await svc
            .from("profiles")
            .select("user_id")
            .gte("longitude", providerD.longitude - WIDE)
            .lte("longitude", providerD.longitude + WIDE)
            .gt("latitude", lat)
            .lt("latitude", lat);
          expect(strictErr).toBeNull();
          const strictIncludes = (strictData ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(strictIncludes).toBe(c.expectStrict);

          // Cross-axis sanity: when point sits exactly at D.lat the operator
          // choice is what flips the outcome; otherwise both must agree.
          if (lat === providerD.latitude) {
            expect(inclusiveIncludes).not.toBe(strictIncludes);
          } else {
            expect(inclusiveIncludes).toBe(strictIncludes);
          }
        });
      }
    });

    describe("latMin === latMax AND lonMin === lonMax (point bbox): gte/lte vs strict gt/lt", () => {
      // Fully degenerate bbox: pin both axes to a single (lat, lon) point.
      // Inclusive (gte+lte on both axes) matches providerD only when the
      // point equals (D.lat, D.lon). Strict (gt+lt on both axes) is empty
      // for any point because no value can be both > x and < x.
      const OFFSET = 0.01;

      const cases: Array<{
        name: string;
        lat: () => number;
        lon: () => number;
        expectInclusive: boolean;
        expectStrict: boolean;
      }> = [
        {
          name: "point AT (D.lat, D.lon)",
          lat: () => providerD.latitude,
          lon: () => providerD.longitude,
          expectInclusive: true, // gte+lte at exact point matches D
          expectStrict: false, // gt+lt empty regardless
        },
        {
          name: "point AT D.lat, lon OFFSET away",
          lat: () => providerD.latitude,
          lon: () => providerD.longitude + OFFSET,
          expectInclusive: false,
          expectStrict: false,
        },
        {
          name: "lat OFFSET away, point AT D.lon",
          lat: () => providerD.latitude + OFFSET,
          lon: () => providerD.longitude,
          expectInclusive: false,
          expectStrict: false,
        },
        {
          name: "both axes OFFSET away from D",
          lat: () => providerD.latitude + OFFSET,
          lon: () => providerD.longitude - OFFSET,
          expectInclusive: false,
          expectStrict: false,
        },
      ];

      for (const c of cases) {
        it(`${c.name} → inclusive ${c.expectInclusive ? "includes" : "excludes"}, strict ${c.expectStrict ? "includes" : "excludes"} providerD`, async () => {
          const svc = serviceClient();
          const lat = c.lat();
          const lon = c.lon();

          // Inclusive: gte + lte on BOTH axes at the same point.
          const { data: incData, error: incErr } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gte("latitude", lat)
            .lte("latitude", lat)
            .gte("longitude", lon)
            .lte("longitude", lon);
          expect(incErr).toBeNull();
          const inclusiveIncludes = (incData ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(inclusiveIncludes).toBe(c.expectInclusive);

          // Strict: gt + lt on BOTH axes at the same point → always empty.
          const { data: strictData, error: strictErr } = await svc
            .from("profiles")
            .select("user_id")
            .gt("latitude", lat)
            .lt("latitude", lat)
            .gt("longitude", lon)
            .lt("longitude", lon);
          expect(strictErr).toBeNull();
          const strictIncludes = (strictData ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          expect(strictIncludes).toBe(c.expectStrict);

          // Cross-check: strict point bbox is unconditionally empty, so it
          // can never include providerD. The flip vs inclusive only happens
          // when the point is exactly (D.lat, D.lon).
          const atExactPoint =
            lat === providerD.latitude && lon === providerD.longitude;
          expect(strictIncludes).toBe(false);
          if (atExactPoint) {
            expect(inclusiveIncludes).not.toBe(strictIncludes);
          } else {
            expect(inclusiveIncludes).toBe(strictIncludes);
          }
        });
      }
    });

    describe("point bbox with MIXED operators across axes (lat gte/lte vs lon gt/lt and vice versa)", () => {
      // Degenerate point bbox where one axis uses inclusive operators
      // (gte+lte) and the OTHER axis uses strict operators (gt+lt). The
      // strict axis collapses to an empty interval at any pinned value,
      // so the overall bbox is empty regardless of where the point sits
      // — providerD must NEVER be included, even at (D.lat, D.lon).
      const OFFSET = 0.01;

      const points: Array<{
        name: string;
        lat: () => number;
        lon: () => number;
      }> = [
        {
          name: "exact (D.lat, D.lon)",
          lat: () => providerD.latitude,
          lon: () => providerD.longitude,
        },
        {
          name: "lat OFFSET, lon AT D.lon",
          lat: () => providerD.latitude + OFFSET,
          lon: () => providerD.longitude,
        },
        {
          name: "lat AT D.lat, lon OFFSET",
          lat: () => providerD.latitude,
          lon: () => providerD.longitude - OFFSET,
        },
        {
          name: "both axes OFFSET away from D",
          lat: () => providerD.latitude - OFFSET,
          lon: () => providerD.longitude + OFFSET,
        },
      ];

      for (const p of points) {
        it(`lat=gte/lte + lon=gt/lt at ${p.name} → excludes providerD`, async () => {
          const svc = serviceClient();
          const lat = p.lat();
          const lon = p.lon();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gte("latitude", lat)
            .lte("latitude", lat)
            .gt("longitude", lon)
            .lt("longitude", lon);
          expect(error).toBeNull();
          const includesProviderD = (data ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          // Strict longitude collapses to empty → bbox is empty regardless
          // of where lat is pinned.
          expect(includesProviderD).toBe(false);
        });

        it(`lat=gt/lt + lon=gte/lte at ${p.name} → excludes providerD`, async () => {
          const svc = serviceClient();
          const lat = p.lat();
          const lon = p.lon();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id, latitude, longitude")
            .gt("latitude", lat)
            .lt("latitude", lat)
            .gte("longitude", lon)
            .lte("longitude", lon);
          expect(error).toBeNull();
          const includesProviderD = (data ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          // Strict latitude collapses to empty → bbox is empty regardless
          // of where lon is pinned.
          expect(includesProviderD).toBe(false);
        });

        it(`mixed-axis flip parity: fully-inclusive at ${p.name} matches D iff point is exact`, async () => {
          // Sanity: the all-inclusive variant of the same point must match
          // providerD only at (D.lat, D.lon). This anchors the mixed-axis
          // assertions above by proving the row exists and is reachable.
          const svc = serviceClient();
          const lat = p.lat();
          const lon = p.lon();
          const { data, error } = await svc
            .from("profiles")
            .select("user_id")
            .gte("latitude", lat)
            .lte("latitude", lat)
            .gte("longitude", lon)
            .lte("longitude", lon);
          expect(error).toBeNull();
          const includesProviderD = (data ?? []).some(
            (r: any) => r.user_id === providerD.userId,
          );
          const atExactPoint =
            lat === providerD.latitude && lon === providerD.longitude;
          expect(includesProviderD).toBe(atExactPoint);
        });
      }
    });

    describe("mixed-operator point bbox parameterized by float tolerance (inclusion flips only when inclusive axis matches D exactly)", () => {
      // One axis is pinned with inclusive operators (gte+lte) at a single
      // value — that axis matches providerD only when the pin equals D's
      // exact coordinate on that axis. The OTHER axis uses strict operators
      // (gt+lt) bracketing D's coordinate by ±EPS, so the strict axis is a
      // tiny non-empty interval that always contains providerD on that axis.
      // Net effect: inclusion of providerD flips purely based on whether
      // the inclusive-axis pin equals providerD's coordinate exactly.
      // Parameterized float tolerances. Each EPS is exercised against both
      // axis orientations (lat-inclusive/lon-strict and lon-inclusive/lat-
      // strict) and across 3 pin offsets (0, +EPS, -EPS). Inclusion must
      // flip ONLY when the inclusive-axis pin is the exact D coordinate,
      // regardless of how small EPS becomes — proving the boundary
      // semantics are not a coarse-tolerance artifact.
      const EPSILONS = [1e-6, 1e-7, 1e-9] as const;
      const pinOffsets: Array<{ label: string; delta: (eps: number) => number; expect: boolean }> = [
        { label: "AT exact", delta: () => 0, expect: true },
        { label: "+EPS", delta: (eps) => eps, expect: false },
        { label: "-EPS", delta: (eps) => -eps, expect: false },
      ];

      for (const EPS of EPSILONS) {
        describe(`EPS=${EPS}`, () => {
          for (const off of pinOffsets) {
            it(`lat=gte/lte ${off.label} D.lat, lon=gt/lt ±EPS around D.lon → ${off.expect ? "INCLUDES" : "EXCLUDES"}`, async () => {
              const svc = serviceClient();
              const latPin = providerD.latitude + off.delta(EPS);
              const { data, error } = await svc
                .from("profiles")
                .select("user_id, latitude, longitude")
                .gte("latitude", latPin)
                .lte("latitude", latPin)
                .gt("longitude", providerD.longitude - EPS)
                .lt("longitude", providerD.longitude + EPS);
              expect(error).toBeNull();
              const includes = (data ?? []).some(
                (r: any) => r.user_id === providerD.userId,
              );
              expect(includes).toBe(off.expect);
            });

            it(`lon=gte/lte ${off.label} D.lon, lat=gt/lt ±EPS around D.lat → ${off.expect ? "INCLUDES" : "EXCLUDES"}`, async () => {
              const svc = serviceClient();
              const lonPin = providerD.longitude + off.delta(EPS);
              const { data, error } = await svc
                .from("profiles")
                .select("user_id, latitude, longitude")
                .gt("latitude", providerD.latitude - EPS)
                .lt("latitude", providerD.latitude + EPS)
                .gte("longitude", lonPin)
                .lte("longitude", lonPin);
              expect(error).toBeNull();
              const includes = (data ?? []).some(
                (r: any) => r.user_id === providerD.userId,
              );
              expect(includes).toBe(off.expect);
            });
          }
        });
      }
    });
  },
);

describe("bbox query operator URL snapshots (regression guard for gt/gte/lt/lte mapping)", () => {
  // These tests build the PostgREST query but never execute it (no network).
  // They snapshot the URL search params so any regression in operator mapping
  // (e.g., supabase-js renaming gt→gt., or a typo swapping lt and lte) fails loudly.
  const FIXED_LAT = 12.3456;
  const FIXED_LON = -65.4321;

  const latOps = [
    { name: "gte+lte", lo: "gte" as const, hi: "lte" as const },
    { name: "gt+lte", lo: "gt" as const, hi: "lte" as const },
    { name: "gte+lt", lo: "gte" as const, hi: "lt" as const },
    { name: "gt+lt", lo: "gt" as const, hi: "lt" as const },
  ];
  const lonOps = latOps;

  function buildUrl(la: typeof latOps[number], lo: typeof lonOps[number]) {
    const client = anonClient();
    const builder = client
      .from("profiles")
      .select("user_id, email, latitude, longitude")
      [la.lo]("latitude", FIXED_LAT)
      [la.hi]("latitude", FIXED_LAT)
      [lo.lo]("longitude", FIXED_LON)
      [lo.hi]("longitude", FIXED_LON);
    // PostgrestBuilder exposes the URL on `.url` before being awaited.
    const url = (builder as any).url as URL;
    // Sort search params for stable snapshots regardless of insertion order quirks.
    const params = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return params.map(([k, v]) => `${k}=${v}`).join("&");
  }

  for (const la of latOps) {
    for (const lo of lonOps) {
      it(`lat=${la.name}, lon=${lo.name} produces stable PostgREST operator URL`, () => {
        expect(buildUrl(la, lo)).toMatchSnapshot();
      });
    }
  }
});