import { describe, it, expect } from "vitest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const PUBLIC_BUCKETS = ["avatars", "service-photos"] as const;

async function listAsAnon(bucket: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 100, offset: 0 }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("Public storage buckets block anonymous listing", () => {
  for (const bucket of PUBLIC_BUCKETS) {
    it(`returns no objects when an anonymous client lists '${bucket}'`, async () => {
      const { status, body } = await listAsAnon(bucket);
      // Either RLS denies (403) or returns an empty array — both prove listing is blocked.
      expect([200, 400, 401, 403]).toContain(status);
      if (status === 200) {
        expect(Array.isArray(body)).toBe(true);
        expect(body).toHaveLength(0);
      }
    }, 15000);
  }
});