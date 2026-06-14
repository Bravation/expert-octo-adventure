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
  "Profiles sensitive fields — service role updates a DIFFERENT provider's row under RLS",
  () => {
    // The "actor" is an authenticated provider whose session we ignore — we use it
    // only to prove the service-role client is acting on behalf of nobody, and
    // is therefore able to mutate a row it does not own.
    let actor: Awaited<ReturnType<typeof signUpProvider>>;
    let target: Awaited<ReturnType<typeof signUpProvider>>;
    let targetProfileId: string;

    beforeAll(async () => {
      [actor, target] = await Promise.all([signUpProvider(), signUpProvider()]);
      await new Promise((r) => setTimeout(r, 500));
      const id = await getProfileId(target.client, target.userId);
      if (!id) throw new Error("Target provider profile not created by trigger");
      targetProfileId = id;
    }, 30_000);

    afterAll(async () => {
      await actor.client.auth.signOut();
      await target.client.auth.signOut();
    });

    it("sanity: the actor (a different authenticated provider) CANNOT update the target's sensitive fields", async () => {
      const { data } = await actor.client
        .from("profiles")
        .update({
          email: `actor-attempt-${crypto.randomUUID()}@example.com`,
          latitude: 1.234567,
          longitude: 7.654321,
        })
        .eq("id", targetProfileId)
        .select();
      // RLS should prevent any rows from being affected.
      expect(data ?? []).toHaveLength(0);

      // Confirm the target's row was not mutated by re-reading via service role.
      const svc = serviceClient();
      const { data: snap, error } = await svc
        .from("profiles")
        .select("email")
        .eq("id", targetProfileId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(snap?.email).toBe(target.email);
    });

    it("service role CAN update the target provider's email/latitude/longitude", async () => {
      const svc = serviceClient();
      const updates = {
        email: `svc-other-${crypto.randomUUID()}@example.com`,
        latitude: 48.8566,
        longitude: 2.3522,
      };
      const { data, error } = await svc
        .from("profiles")
        .update(updates)
        .eq("id", targetProfileId)
        .select("id, email, latitude, longitude")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(targetProfileId);
      expect(data?.email).toBe(updates.email);
      expect(Number(data?.latitude)).toBe(updates.latitude);
      expect(Number(data?.longitude)).toBe(updates.longitude);

      // Re-read independently to confirm the write persisted on the target row.
      const { data: refetched, error: refetchErr } = await svc
        .from("profiles")
        .select("email, latitude, longitude")
        .eq("id", targetProfileId)
        .maybeSingle();
      expect(refetchErr).toBeNull();
      expect(refetched?.email).toBe(updates.email);
      expect(Number(refetched?.latitude)).toBe(updates.latitude);
      expect(Number(refetched?.longitude)).toBe(updates.longitude);
    });
  },
);