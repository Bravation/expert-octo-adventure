import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SERVICE_ROLE_KEY =
  (typeof process !== "undefined" && process.env?.SUPABASE_SERVICE_ROLE_KEY) || "";

/** Sensitive columns on `profiles` that must NEVER be visible to non-owners. */
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

async function signUpUser(role: "customer" | "service_provider") {
  const client = anonClient();
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: `Test ${role}`, role } },
  });
  if (error) throw error;
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) {
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }
  const { data: userData } = await client.auth.getUser();
  return { client, userId: userData.user!.id, email, password };
}

async function getProfileId(client: SupabaseClient, userId: string) {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

describe("Profiles sensitive fields — RLS for non-owners vs service role", () => {
  let provider: Awaited<ReturnType<typeof signUpUser>>;
  let nonOwner: Awaited<ReturnType<typeof signUpUser>>;
  let providerProfileId: string;

  beforeAll(async () => {
    provider = await signUpUser("service_provider");
    nonOwner = await signUpUser("customer");
    await new Promise((r) => setTimeout(r, 500));

    const id = await getProfileId(provider.client, provider.userId);
    if (!id) throw new Error("Provider profile not created by trigger");
    providerProfileId = id;

    // Seed precise GPS coordinates on the provider profile to make the
    // latitude/longitude non-owner exposure tests meaningful.
    const { error } = await provider.client
      .from("profiles")
      .update({ latitude: 40.712776, longitude: -74.005974 })
      .eq("id", providerProfileId);
    if (error) throw error;
  }, 30_000);

  afterAll(async () => {
    await provider.client.auth.signOut();
    await nonOwner.client.auth.signOut();
  });

  describe("Anonymous client", () => {
    for (const col of SENSITIVE_COLUMNS) {
      it(`cannot read provider's "${col}" from profiles`, async () => {
        const anon = anonClient();
        const { data } = await anon
          .from("profiles")
          .select(`id, ${col}`)
          .eq("id", providerProfileId);
        expect(data ?? []).toHaveLength(0);
      });
    }
  });

  describe("Authenticated non-owner", () => {
    for (const col of SENSITIVE_COLUMNS) {
      it(`cannot read provider's "${col}" from profiles`, async () => {
        const { data } = await nonOwner.client
          .from("profiles")
          .select(`id, ${col}`)
          .eq("id", providerProfileId);
        expect(data ?? []).toHaveLength(0);
      });

      it(`cannot filter profiles by provider's "${col}" to discover their row`, async () => {
        // Using the column in a filter must also not leak rows.
        const filterValue =
          col === "email" ? provider.email : col === "latitude" ? 40.712776 : -74.005974;
        const { data } = await nonOwner.client
          .from("profiles")
          .select("id")
          .eq(col, filterValue as any);
        expect(data ?? []).toHaveLength(0);
      });
    }

    it("cannot read sensitive columns via the public_provider_profiles view", async () => {
      const { data, error } = await nonOwner.client
        .from("public_provider_profiles" as any)
        .select("*")
        .eq("id", providerProfileId)
        .maybeSingle();
      expect(error).toBeNull();
      if (data) {
        const keys = Object.keys(data);
        expect(keys).not.toContain("email");
        // Precise GPS columns must not be exposed; only the rounded *_public versions.
        expect(keys).not.toContain("longitude_public");
        expect(keys).not.toContain("latitude_public");
        // The view aliases the rounded columns as latitude/longitude — verify they
        // are NOT the precise seeded values (i.e. they were rounded server-side).
        if (typeof data.latitude === "number") {
          expect(data.latitude).not.toBe(40.712776);
        }
        if (typeof data.longitude === "number") {
          expect(data.longitude).not.toBe(-74.005974);
        }
      }
    });
  });

  describe("Owner", () => {
    for (const col of SENSITIVE_COLUMNS) {
      it(`can read their own "${col}" from profiles`, async () => {
        const { data, error } = await provider.client
          .from("profiles")
          .select(`id, ${col}`)
          .eq("id", providerProfileId)
          .maybeSingle();
        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect((data as any)?.[col]).not.toBeNull();
        expect((data as any)?.[col]).not.toBeUndefined();
      });
    }
  });

  describe.skipIf(!SERVICE_ROLE_KEY)("Service role", () => {
    for (const col of SENSITIVE_COLUMNS) {
      it(`can read provider's "${col}" from profiles`, async () => {
        const svc = serviceClient();
        const { data, error } = await svc
          .from("profiles")
          .select(`id, ${col}`)
          .eq("id", providerProfileId)
          .maybeSingle();
        expect(error).toBeNull();
        expect((data as any)?.[col]).not.toBeNull();
        expect((data as any)?.[col]).not.toBeUndefined();
      });
    }

    it("can list sensitive fields across multiple providers", async () => {
      const svc = serviceClient();
      const { data, error } = await svc
        .from("profiles")
        .select("id, email, latitude, longitude")
        .eq("role", "service_provider")
        .limit(5);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect((data ?? []).length).toBeGreaterThan(0);
    });
  });
});