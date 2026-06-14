import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const SENSITIVE_UPDATES = {
  email: "attacker-injected@example.com",
  latitude: 12.345678,
  longitude: -98.765432,
} as const;

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
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

describe("Profiles sensitive fields — UPDATE RLS for non-owners", () => {
  let provider: Awaited<ReturnType<typeof signUpUser>>;
  let nonOwner: Awaited<ReturnType<typeof signUpUser>>;
  let providerProfileId: string;
  let originalEmail: string;
  const originalLat = 40.712776;
  const originalLng = -74.005974;

  beforeAll(async () => {
    provider = await signUpUser("service_provider");
    nonOwner = await signUpUser("customer");
    await new Promise((r) => setTimeout(r, 500));

    const id = await getProfileId(provider.client, provider.userId);
    if (!id) throw new Error("Provider profile not created by trigger");
    providerProfileId = id;
    originalEmail = provider.email;

    // Seed precise GPS coordinates so we can detect any non-owner mutation.
    const { error } = await provider.client
      .from("profiles")
      .update({ latitude: originalLat, longitude: originalLng })
      .eq("id", providerProfileId);
    if (error) throw error;
  }, 30_000);

  afterAll(async () => {
    await provider.client.auth.signOut();
    await nonOwner.client.auth.signOut();
  });

  async function readOwnerSnapshot() {
    const { data, error } = await provider.client
      .from("profiles")
      .select("email, latitude, longitude")
      .eq("id", providerProfileId)
      .maybeSingle();
    expect(error).toBeNull();
    return data as { email: string; latitude: number | null; longitude: number | null };
  }

  describe("Anonymous client", () => {
    for (const [col, value] of Object.entries(SENSITIVE_UPDATES)) {
      it(`cannot update provider's "${col}"`, async () => {
        const anon = anonClient();
        const { data } = await anon
          .from("profiles")
          .update({ [col]: value } as any)
          .eq("id", providerProfileId)
          .select();
        // RLS may return an error or simply no affected rows — either is acceptable
        // as long as the row was not actually mutated.
        expect(data ?? []).toHaveLength(0);

        const snap = await readOwnerSnapshot();
        expect(snap.email).toBe(originalEmail);
        expect(snap.latitude).toBe(originalLat);
        expect(snap.longitude).toBe(originalLng);
      });
    }
  });

  describe("Authenticated non-owner", () => {
    for (const [col, value] of Object.entries(SENSITIVE_UPDATES)) {
      it(`cannot update provider's "${col}"`, async () => {
        const { data } = await nonOwner.client
          .from("profiles")
          .update({ [col]: value } as any)
          .eq("id", providerProfileId)
          .select();
        expect(data ?? []).toHaveLength(0);

        const snap = await readOwnerSnapshot();
        expect(snap.email).toBe(originalEmail);
        expect(snap.latitude).toBe(originalLat);
        expect(snap.longitude).toBe(originalLng);
      });
    }

    it("cannot update sensitive fields by filtering on user_id either", async () => {
      const { data } = await nonOwner.client
        .from("profiles")
        .update({
          email: SENSITIVE_UPDATES.email,
          latitude: SENSITIVE_UPDATES.latitude,
          longitude: SENSITIVE_UPDATES.longitude,
        })
        .eq("user_id", provider.userId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const snap = await readOwnerSnapshot();
      expect(snap.email).toBe(originalEmail);
      expect(snap.latitude).toBe(originalLat);
      expect(snap.longitude).toBe(originalLng);
    });
  });

  describe("Owner", () => {
    it("can update their own latitude/longitude (sanity check that RLS allows owner writes)", async () => {
      const newLat = 41.0;
      const newLng = -75.0;
      const { error } = await provider.client
        .from("profiles")
        .update({ latitude: newLat, longitude: newLng })
        .eq("id", providerProfileId);
      expect(error).toBeNull();

      const snap = await readOwnerSnapshot();
      expect(snap.latitude).toBe(newLat);
      expect(snap.longitude).toBe(newLng);

      // Restore so other assertions in this file remain stable if reordered.
      await provider.client
        .from("profiles")
        .update({ latitude: originalLat, longitude: originalLng })
        .eq("id", providerProfileId);
    });
  });
});