import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const BUCKETS = ["avatars", "service-photos"] as const;

function makeClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUpUser() {
  const client = makeClient();
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Test User", role: "customer" } },
  });
  if (error) throw error;
  // If session not returned (email confirmation on), sign in.
  if (!data.session) {
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }
  const { data: userData } = await client.auth.getUser();
  return { client, userId: userData.user!.id, email };
}

describe("Authenticated users can list only their own storage folders", () => {
  const created: Array<{ client: ReturnType<typeof makeClient>; userId: string }> = [];

  let userA: { client: ReturnType<typeof makeClient>; userId: string };
  let userB: { client: ReturnType<typeof makeClient>; userId: string };

  beforeAll(async () => {
    userA = await signUpUser();
    userB = await signUpUser();
    created.push(userA, userB);

    // Upload via raw fetch (jsdom Blob is flaky with supabase-js storage).
    for (const bucket of BUCKETS) {
      for (const u of [userA, userB]) {
        const path = `${u.userId}/probe-${Date.now()}.txt`;
        const { data: { session } } = await u.client.auth.getSession();
        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
          {
            method: "POST",
            headers: {
              apikey: ANON_KEY,
              Authorization: `Bearer ${session!.access_token}`,
              "Content-Type": "text/plain",
              "x-upsert": "true",
            },
            body: `owner:${u.userId}`,
          },
        );
        expect(res.ok, `upload ${bucket}/${path} -> ${res.status}`).toBe(true);
      }
    }
  }, 60000);

  afterAll(async () => {
    for (const u of created) {
      for (const bucket of BUCKETS) {
        const { data: list } = await u.client.storage.from(bucket).list(u.userId);
        if (list?.length) {
          await u.client.storage
            .from(bucket)
            .remove(list.map((f) => `${u.userId}/${f.name}`));
        }
      }
      await u.client.auth.signOut();
    }
  }, 60000);

  for (const bucket of BUCKETS) {
    it(`user A sees only their own folder in '${bucket}'`, async () => {
      const { data, error } = await userA.client.storage.from(bucket).list(userA.userId);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    }, 30000);

    it(`user A cannot list user B's folder in '${bucket}'`, async () => {
      const { data, error } = await userA.client.storage.from(bucket).list(userB.userId);
      // RLS should either error or return an empty array.
      if (error) {
        expect(error).toBeTruthy();
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    }, 30000);

    it(`user A cannot list bucket root of '${bucket}'`, async () => {
      const { data, error } = await userA.client.storage.from(bucket).list("");
      if (error) {
        expect(error).toBeTruthy();
      } else {
        // Root listing must not expose user B's folder.
        const names = (data ?? []).map((f) => f.name);
        expect(names).not.toContain(userB.userId);
      }
    }, 30000);
  }
});