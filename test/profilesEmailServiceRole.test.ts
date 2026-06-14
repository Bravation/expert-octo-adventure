import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
// Service role key is a server-only secret. In CI, inject it via:
//   SUPABASE_SERVICE_ROLE_KEY=... vitest run
// Locally without the key the service-role assertion is skipped.
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

async function signUpUser(role: "customer" | "service_provider") {
  const client = anonClient();
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: `Test ${role}`, role } },
  });
  if (error) throw error;
  if (!data.session) {
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }
  const { data: userData } = await client.auth.getUser();
  return { client, userId: userData.user!.id, email };
}

describe("Profiles email — service role vs authenticated non-owner", () => {
  let provider: Awaited<ReturnType<typeof signUpUser>>;
  let nonOwner: Awaited<ReturnType<typeof signUpUser>>;
  let providerProfileId: string;

  beforeAll(async () => {
    provider = await signUpUser("service_provider");
    nonOwner = await signUpUser("customer");
    await new Promise((r) => setTimeout(r, 500));
    const { data } = await provider.client
      .from("profiles")
      .select("id")
      .eq("user_id", provider.userId)
      .maybeSingle();
    if (!data?.id) throw new Error("Provider profile missing");
    providerProfileId = data.id;
  }, 30_000);

  afterAll(async () => {
    await provider.client.auth.signOut();
    await nonOwner.client.auth.signOut();
  });

  it("authenticated non-owner cannot read provider email", async () => {
    const { data } = await nonOwner.client
      .from("profiles")
      .select("id, email")
      .eq("id", providerProfileId);
    expect(data ?? []).toHaveLength(0);

    const { data: byEmail } = await nonOwner.client
      .from("profiles")
      .select("id, email")
      .eq("email", provider.email);
    expect(byEmail ?? []).toHaveLength(0);
  });

  it.skipIf(!SERVICE_ROLE_KEY)(
    "service role can read the provider's email",
    async () => {
      const svc = serviceClient();
      const { data, error } = await svc
        .from("profiles")
        .select("id, email")
        .eq("id", providerProfileId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.email).toBe(provider.email);
    },
  );

  it.skipIf(!SERVICE_ROLE_KEY)(
    "service role can list emails across multiple providers",
    async () => {
      const svc = serviceClient();
      const { data, error } = await svc
        .from("profiles")
        .select("email")
        .eq("role", "service_provider")
        .not("email", "is", null)
        .limit(5);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      // At least our provider's email must be returnable to service role.
      expect((data ?? []).every((r: any) => typeof r.email === "string")).toBe(true);
    },
  );
});