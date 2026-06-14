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
  if (!data.session) {
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }
  const { data: userData } = await client.auth.getUser();
  return { client, userId: userData.user!.id, email };
}

async function uploadProbe(
  user: { client: ReturnType<typeof makeClient>; userId: string },
  bucket: string,
  filename: string,
) {
  const path = `${user.userId}/${filename}`;
  const { data: { session } } = await user.client.auth.getSession();
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
      body: `owner:${user.userId}`,
    },
  );
  expect(res.ok, `upload ${bucket}/${path} -> ${res.status}`).toBe(true);
  return path;
}

async function objectExists(
  user: { client: ReturnType<typeof makeClient> },
  bucket: string,
  folder: string,
  filename: string,
) {
  const { data } = await user.client.storage.from(bucket).list(folder);
  return (data ?? []).some((f) => f.name === filename);
}

describe("Authenticated users can delete only their own storage objects", () => {
  const created: Array<{ client: ReturnType<typeof makeClient>; userId: string }> = [];

  let userA: { client: ReturnType<typeof makeClient>; userId: string };
  let userB: { client: ReturnType<typeof makeClient>; userId: string };

  beforeAll(async () => {
    userA = await signUpUser();
    userB = await signUpUser();
    created.push(userA, userB);
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
    it(`user A can delete their own object in '${bucket}'`, async () => {
      const filename = `own-${Date.now()}.txt`;
      const path = await uploadProbe(userA, bucket, filename);

      const { error } = await userA.client.storage.from(bucket).remove([path]);
      expect(error).toBeNull();

      const stillThere = await objectExists(userA, bucket, userA.userId, filename);
      expect(stillThere).toBe(false);
    }, 30000);

    it(`user A cannot delete user B's object in '${bucket}'`, async () => {
      const filename = `b-owned-${Date.now()}.txt`;
      const path = await uploadProbe(userB, bucket, filename);

      // Attempt deletion as user A (should be blocked by RLS).
      const { data, error } = await userA.client.storage.from(bucket).remove([path]);
      // RLS may either return an error or return an empty/no-op result.
      if (!error) {
        expect((data ?? []).length).toBe(0);
      }

      // Verify the object still exists from user B's perspective.
      const stillThere = await objectExists(userB, bucket, userB.userId, filename);
      expect(stillThere).toBe(true);
    }, 30000);

    it(`anonymous client cannot delete user B's object in '${bucket}'`, async () => {
      const filename = `anon-target-${Date.now()}.txt`;
      const path = await uploadProbe(userB, bucket, filename);

      const anon = makeClient();
      const { data, error } = await anon.storage.from(bucket).remove([path]);
      if (!error) {
        expect((data ?? []).length).toBe(0);
      }

      const stillThere = await objectExists(userB, bucket, userB.userId, filename);
      expect(stillThere).toBe(true);
    }, 30000);
  }
});