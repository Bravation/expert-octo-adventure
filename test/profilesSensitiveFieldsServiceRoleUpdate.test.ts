import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SERVICE_ROLE_KEY =
  (typeof process !== "undefined" && process.env?.SUPABASE_SERVICE_ROLE_KEY) || "";

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

async function signUpProvider() {
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
  return { client, userId: userData.user!.id, email };
}

async function getProfileId(client: SupabaseClient, userId: string) {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

describe.skipIf(!SERVICE_ROLE_KEY)(
  "Profiles sensitive fields — service role can UPDATE under RLS",
  () => {
    let provider: Awaited<ReturnType<typeof signUpProvider>>;
    let providerProfileId: string;

    beforeAll(async () => {
      provider = await signUpProvider();
      await new Promise((r) => setTimeout(r, 500));
      const id = await getProfileId(provider.client, provider.userId);
      if (!id) throw new Error("Provider profile not created by trigger");
      providerProfileId = id;
    }, 30_000);

    afterAll(async () => {
      await provider.client.auth.signOut();
    });

    it("can update provider's email", async () => {
      const svc = serviceClient();
      const newEmail = `svc-updated-${crypto.randomUUID()}@example.com`;
      const { data, error } = await svc
        .from("profiles")
        .update({ email: newEmail })
        .eq("id", providerProfileId)
        .select("id, email")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.email).toBe(newEmail);
    });

    it("can update provider's latitude and longitude", async () => {
      const svc = serviceClient();
      const newLat = 51.507351;
      const newLng = -0.127758;
      const { data, error } = await svc
        .from("profiles")
        .update({ latitude: newLat, longitude: newLng })
        .eq("id", providerProfileId)
        .select("id, latitude, longitude")
        .maybeSingle();
      expect(error).toBeNull();
      expect(Number(data?.latitude)).toBe(newLat);
      expect(Number(data?.longitude)).toBe(newLng);
    });

    it("can update all three sensitive fields atomically", async () => {
      const svc = serviceClient();
      const updates = {
        email: `svc-atomic-${crypto.randomUUID()}@example.com`,
        latitude: 35.6895,
        longitude: 139.6917,
      };
      const { data, error } = await svc
        .from("profiles")
        .update(updates)
        .eq("id", providerProfileId)
        .select("id, email, latitude, longitude")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.email).toBe(updates.email);
      expect(Number(data?.latitude)).toBe(updates.latitude);
      expect(Number(data?.longitude)).toBe(updates.longitude);

      // Re-read with the service client to confirm persistence (independent of update RETURNING).
      const { data: refetched, error: refetchErr } = await svc
        .from("profiles")
        .select("email, latitude, longitude")
        .eq("id", providerProfileId)
        .maybeSingle();
      expect(refetchErr).toBeNull();
      expect(refetched?.email).toBe(updates.email);
      expect(Number(refetched?.latitude)).toBe(updates.latitude);
      expect(Number(refetched?.longitude)).toBe(updates.longitude);
    });
  },
);