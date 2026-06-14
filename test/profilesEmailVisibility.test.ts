import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function makeClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUpUser(role: "customer" | "service_provider") {
  const client = makeClient();
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

async function getProfileId(client: SupabaseClient, userId: string) {
  const { data } = await client.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id as string | undefined;
}

describe("Profiles email visibility", () => {
  let provider: Awaited<ReturnType<typeof signUpUser>>;
  let otherUser: Awaited<ReturnType<typeof signUpUser>>;
  let providerProfileId: string;

  beforeAll(async () => {
    provider = await signUpUser("service_provider");
    otherUser = await signUpUser("customer");
    // Allow trigger-created profile row to settle.
    await new Promise((r) => setTimeout(r, 500));
    const id = await getProfileId(provider.client, provider.userId);
    if (!id) throw new Error("Provider profile not created");
    providerProfileId = id;
  }, 30_000);

  afterAll(async () => {
    await provider.client.auth.signOut();
    await otherUser.client.auth.signOut();
  });

  it("anonymous client cannot read any provider email from profiles", async () => {
    const anon = makeClient();
    const { data, error } = await anon
      .from("profiles")
      .select("id, email")
      .eq("id", providerProfileId);
    // Either RLS returns empty rows or a permission error — both are acceptable.
    expect(error?.message ?? "").not.toMatch(/email/i);
    expect(data ?? []).toHaveLength(0);
  });

  it("a different authenticated user cannot read the provider's email via profiles", async () => {
    const { data, error } = await otherUser.client
      .from("profiles")
      .select("id, email")
      .eq("id", providerProfileId);
    expect(error?.message ?? "").not.toMatch(/email/i);
    expect(data ?? []).toHaveLength(0);
  });

  it("a different authenticated user cannot read provider email via the public view", async () => {
    const { data, error } = await otherUser.client
      .from("public_provider_profiles" as any)
      .select("*")
      .eq("id", providerProfileId)
      .maybeSingle();
    expect(error).toBeNull();
    if (data) {
      expect(Object.keys(data)).not.toContain("email");
    }
  });

  it("the owner can read their own email from profiles", async () => {
    const { data, error } = await provider.client
      .from("profiles")
      .select("id, email")
      .eq("user_id", provider.userId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.email).toBe(provider.email);
  });

  it("a different authenticated user cannot read provider email by filtering on email", async () => {
    const { data } = await otherUser.client
      .from("profiles")
      .select("id, email")
      .eq("email", provider.email);
    expect(data ?? []).toHaveLength(0);
  });
});