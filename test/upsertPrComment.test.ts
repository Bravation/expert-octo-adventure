import { describe, it, expect, vi } from "vitest";

// CommonJS module — Vitest loads it through Node's resolver.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  upsertPrComment,
  hashContent,
  buildIdempotencyTag,
  MARKER,
} = require("../../.github/workflows/scripts/upsertPrComment.cjs");

type Comment = {
  id: number;
  body: string;
  updated_at: string;
};

const PR = { owner: "acme", repo: "widgets", issue_number: 42 };
const HEAD_SHA = "deadbeefcafef00d";
const BODY = "# bbox mixed-operator matrix summary\n\n| EPS | ... |\n";

function makeCore() {
  return {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };
}

/** Build a mock @actions/github client backed by an in-memory comment store. */
function makeGithub(initialComments: Comment[] = []) {
  const store = new Map<number, Comment>();
  for (const c of initialComments) store.set(c.id, { ...c });
  let nextId = (initialComments.at(-1)?.id ?? 100) + 1;

  const listComments = vi.fn(async () => ({ data: Array.from(store.values()) }));
  const getComment = vi.fn(async ({ comment_id }: { comment_id: number }) => {
    const c = store.get(comment_id);
    if (!c) {
      const err: Error & { status?: number } = new Error("Not Found");
      err.status = 404;
      throw err;
    }
    return { data: { ...c } };
  });
  const updateComment = vi.fn(
    async ({ comment_id, body }: { comment_id: number; body: string }) => {
      const c = store.get(comment_id);
      if (!c) throw new Error(`no comment ${comment_id}`);
      const updated = {
        ...c,
        body,
        updated_at: new Date(Date.now() + 1000).toISOString(),
      };
      store.set(comment_id, updated);
      return { data: { ...updated, html_url: `https://gh/${comment_id}` } };
    },
  );
  const createComment = vi.fn(async ({ body }: { body: string }) => {
    const id = nextId++;
    const created: Comment = {
      id,
      body,
      updated_at: new Date().toISOString(),
    };
    store.set(id, created);
    return { data: { ...created, html_url: `https://gh/${id}` } };
  });

  const paginate = vi.fn(async (fn: typeof listComments) => {
    const res = await fn();
    return res.data;
  });

  return {
    client: {
      paginate,
      rest: {
        issues: { listComments, getComment, updateComment, createComment },
      },
    },
    spies: { listComments, getComment, updateComment, createComment },
    store,
  };
}

function commentForRun(runId: string, body = BODY): Comment {
  const tag = buildIdempotencyTag({
    headSha: HEAD_SHA,
    contentHash: hashContent(body),
    runId,
    runAttempt: "1",
  });
  return {
    id: 555,
    body: `${MARKER}\n${tag}\n${body}`,
    updated_at: "2026-05-17T10:00:00Z",
  };
}

const baseArgs = (runId: string, gh: ReturnType<typeof makeGithub>) => ({
  github: gh.client,
  core: makeCore(),
  body: BODY,
  ...PR,
  headSha: HEAD_SHA,
  runId,
  runAttempt: "1",
  sleep: () => Promise.resolve(),
});

describe("upsertPrComment idempotency guard", () => {
  it("creates exactly one comment when no existing comment is present", async () => {
    const gh = makeGithub([]);
    const args = baseArgs("run-A", gh);
    const result = await upsertPrComment(args);

    expect(result.status).toBe("created");
    expect(gh.spies.createComment).toHaveBeenCalledTimes(1);
    expect(gh.spies.updateComment).not.toHaveBeenCalled();
    expect(gh.store.size).toBe(1);
  });

  it("skips at list-time when a concurrent run already posted identical content (no update call, no duplicate)", async () => {
    // Concurrent run "run-A" already posted the same body for the same head sha.
    const gh = makeGithub([commentForRun("run-A")]);
    const args = baseArgs("run-B", gh);
    const result = await upsertPrComment(args);

    expect(result.status).toBe("skipped-current");
    expect(result.commentId).toBe(555);
    expect(args.core.info).toHaveBeenCalledWith(
      expect.stringContaining("Skipping PR comment update"),
    );
    // The critical assertion: no write happened.
    expect(gh.spies.updateComment).not.toHaveBeenCalled();
    expect(gh.spies.createComment).not.toHaveBeenCalled();
    // And we did not create a duplicate comment.
    expect(gh.store.size).toBe(1);
  });

  it("does NOT skip when the existing comment was posted by the same run (allows self-update)", async () => {
    const gh = makeGithub([commentForRun("run-A")]);
    const args = baseArgs("run-A", gh);
    const result = await upsertPrComment(args);

    expect(result.status).toBe("updated");
    expect(gh.spies.updateComment).toHaveBeenCalledTimes(1);
    expect(gh.store.size).toBe(1);
  });

  it("skips at race-time when another run lands an identical update between list and write", async () => {
    // List returns the stale snapshot (different sha / hash).
    // getComment returns the *winning* concurrent version (run-A landed
    // identical content between our list and write).
    const stale: Comment = {
      id: 555,
      body: `${MARKER}\n<!-- bbox-summary-meta sha=oldsha hash=oldhash run=run-X attempt=1 -->\nold body`,
      updated_at: "2026-05-01T10:00:00Z",
    };
    const winning = commentForRun("run-A");
    winning.updated_at = "2026-05-17T11:00:00Z";

    const gh = makeGithub([winning]);
    // Override paginate to return the stale snapshot we observed at list time.
    gh.client.paginate = vi.fn(async () => [stale]) as never;

    const args = baseArgs("run-B", gh);
    const result = await upsertPrComment(args);

    expect(result.status).toBe("skipped-concurrent");
    expect(gh.spies.getComment).toHaveBeenCalledTimes(1);
    expect(gh.spies.updateComment).not.toHaveBeenCalled();
    expect(args.core.info).toHaveBeenCalledWith(
      expect.stringContaining("Concurrent run run-A"),
    );
  });

  it("proceeds with a warning when the comment was modified by a run with different content (no silent clobber, but progresses)", async () => {
    const stale: Comment = {
      id: 555,
      body: `${MARKER}\n<!-- bbox-summary-meta sha=${HEAD_SHA} hash=oldhash run=run-X attempt=1 -->\nold body`,
      updated_at: "2026-05-01T10:00:00Z",
    };
    const divergent = commentForRun("run-A", "different body");
    divergent.updated_at = "2026-05-17T11:00:00Z";

    const gh = makeGithub([divergent]);
    gh.client.paginate = vi.fn(async () => [stale]) as never;

    const args = baseArgs("run-B", gh);
    const result = await upsertPrComment(args);

    expect(result.status).toBe("updated");
    expect(args.core.warning).toHaveBeenCalledWith(
      expect.stringContaining("modified between list and update"),
    );
    expect(gh.spies.updateComment).toHaveBeenCalledTimes(1);
    // Still only one comment on the PR — no duplicate.
    expect(gh.store.size).toBe(1);
  });

  it("two sequential runs with identical content produce exactly one PR comment (end-to-end concurrency simulation)", async () => {
    const gh = makeGithub([]);

    // Run A: creates the comment.
    const resA = await upsertPrComment(baseArgs("run-A", gh));
    // Run B: starts after A finished; sees A's comment with matching hash → skip.
    const resB = await upsertPrComment(baseArgs("run-B", gh));

    expect(resA.status).toBe("created");
    expect(resB.status).toBe("skipped-current");
    expect(gh.spies.createComment).toHaveBeenCalledTimes(1);
    expect(gh.spies.updateComment).not.toHaveBeenCalled();
    expect(gh.store.size).toBe(1);
  });
});

/** Build a github mock whose createComment fails N times with a given status,
 * then (optionally) succeeds. Lets us drive the retry loop deterministically. */
function makeFlakyGithub(failures: Array<number>) {
  const paginate = vi.fn(async () => []);
  let call = 0;
  const createComment = vi.fn(async ({ body }: { body: string }) => {
    if (call < failures.length) {
      const status = failures[call++];
      const err: Error & { status?: number } = new Error(`boom ${status}`);
      err.status = status;
      throw err;
    }
    call++;
    return { data: { id: 999, body, html_url: "https://gh/999" } };
  });
  const updateComment = vi.fn();
  const getComment = vi.fn();
  const listComments = vi.fn(async () => ({ data: [] }));

  return {
    client: {
      paginate,
      rest: {
        issues: { listComments, getComment, updateComment, createComment },
      },
    },
    spies: { listComments, getComment, updateComment, createComment },
  };
}

describe("upsertPrComment retry/backoff behavior", () => {
  const retryArgs = (
    gh: ReturnType<typeof makeFlakyGithub>,
    overrides: Record<string, unknown> = {},
  ) => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    return {
      args: {
        github: gh.client,
        core: makeCore(),
        body: BODY,
        ...PR,
        headSha: HEAD_SHA,
        runId: "run-R",
        runAttempt: "1",
        maxAttempts: 4,
        baseDelayMs: 1000,
        sleep,
        ...overrides,
      },
      sleep,
    };
  };

  it.each([403, 429, 500, 502, 503, 504])(
    "retries transient %s errors and eventually succeeds within maxAttempts",
    async (status) => {
      const gh = makeFlakyGithub([status, status, status]);
      const { args, sleep } = retryArgs(gh);
      const result = await upsertPrComment(args);

      expect(result.status).toBe("created");
      expect(gh.spies.createComment).toHaveBeenCalledTimes(4);
      // 3 failures → 3 backoff sleeps before the 4th (successful) attempt.
      expect(sleep).toHaveBeenCalledTimes(3);
      // Bounded exponential backoff: each delay >= baseDelay * 2^(i-1).
      const delays = sleep.mock.calls.map((c) => c[0] as number);
      expect(delays[0]).toBeGreaterThanOrEqual(1000);
      expect(delays[1]).toBeGreaterThanOrEqual(2000);
      expect(delays[2]).toBeGreaterThanOrEqual(4000);
      // Each retry should have been logged as a warning with PR + marker.
      expect(args.core.warning).toHaveBeenCalledTimes(3);
      for (const call of args.core.warning.mock.calls) {
        expect(call[0]).toMatch(/PR #42/);
        expect(call[0]).toMatch(/bbox-mixed-operator-matrix-summary/);
      }
    },
  );

  it("gives up after maxAttempts on persistent transient errors and rethrows", async () => {
    const gh = makeFlakyGithub([500, 500, 500, 500]);
    const { args, sleep } = retryArgs(gh);

    await expect(upsertPrComment(args)).rejects.toMatchObject({ status: 500 });
    expect(gh.spies.createComment).toHaveBeenCalledTimes(4);
    // Only 3 sleeps between 4 attempts — no sleep after the final failure.
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(args.core.error).toHaveBeenCalledWith(
      expect.stringContaining("Retries exhausted"),
    );
  });

  it.each([400, 401, 404, 422])(
    "does NOT retry non-transient %s errors and fails fast",
    async (status) => {
      const gh = makeFlakyGithub([status, status, status, status]);
      const { args, sleep } = retryArgs(gh);

      await expect(upsertPrComment(args)).rejects.toMatchObject({ status });
      expect(gh.spies.createComment).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(args.core.warning).not.toHaveBeenCalled();
      expect(args.core.error).toHaveBeenCalledWith(
        expect.stringContaining("Non-transient error"),
      );
    },
  );

  it("respects a custom maxAttempts bound", async () => {
    const gh = makeFlakyGithub([429, 429]);
    const { args, sleep } = retryArgs(gh, { maxAttempts: 2, baseDelayMs: 10 });

    await expect(upsertPrComment(args)).rejects.toMatchObject({ status: 429 });
    expect(gh.spies.createComment).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

/** Build a github mock that has one existing matching comment posted by a
 * different run, and whose `updateComment` fails N times with given statuses
 * before succeeding. `getComment` always returns the original (unchanged
 * `updated_at`) so the race-detection branch is bypassed and we exercise the
 * pure retry path on update. */
function makeFlakyUpdateGithub(failures: Array<number>) {
  const existing: Comment = {
    ...commentForRun("run-OTHER", "previous body"),
    updated_at: "2026-05-17T09:00:00Z",
  };

  const paginate = vi.fn(async () => [existing]);
  const listComments = vi.fn(async () => ({ data: [existing] }));
  const getComment = vi.fn(async () => ({ data: { ...existing } }));

  let call = 0;
  const updateComment = vi.fn(
    async ({ comment_id, body }: { comment_id: number; body: string }) => {
      if (call < failures.length) {
        const status = failures[call++];
        const err: Error & { status?: number } = new Error(`boom ${status}`);
        err.status = status;
        throw err;
      }
      call++;
      return {
        data: {
          id: comment_id,
          body,
          updated_at: new Date().toISOString(),
          html_url: `https://gh/${comment_id}`,
        },
      };
    },
  );
  const createComment = vi.fn();

  return {
    client: {
      paginate,
      rest: {
        issues: { listComments, getComment, updateComment, createComment },
      },
    },
    spies: { listComments, getComment, updateComment, createComment },
    existing,
  };
}

describe("upsertPrComment update-path retry behavior", () => {
  const retryArgs = (
    gh: ReturnType<typeof makeFlakyUpdateGithub>,
    overrides: Record<string, unknown> = {},
  ) => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    return {
      args: {
        github: gh.client,
        core: makeCore(),
        body: BODY,
        ...PR,
        headSha: HEAD_SHA,
        runId: "run-U",
        runAttempt: "1",
        maxAttempts: 4,
        baseDelayMs: 1000,
        sleep,
        ...overrides,
      },
      sleep,
    };
  };

  it.each([403, 429, 500, 502, 503, 504])(
    "retries transient %s errors on updateComment and eventually succeeds",
    async (status) => {
      const gh = makeFlakyUpdateGithub([status, status, status]);
      const { args, sleep } = retryArgs(gh);
      const result = await upsertPrComment(args);

      expect(result.status).toBe("updated");
      expect(result.commentId).toBe(gh.existing.id);
      expect(gh.spies.updateComment).toHaveBeenCalledTimes(4);
      // Each update attempt re-fetches the comment before writing.
      expect(gh.spies.getComment).toHaveBeenCalledTimes(4);
      expect(gh.spies.createComment).not.toHaveBeenCalled();
      // 3 failures → 3 backoff sleeps before the 4th (successful) attempt.
      expect(sleep).toHaveBeenCalledTimes(3);
      const delays = sleep.mock.calls.map((c) => c[0] as number);
      expect(delays[0]).toBeGreaterThanOrEqual(1000);
      expect(delays[1]).toBeGreaterThanOrEqual(2000);
      expect(delays[2]).toBeGreaterThanOrEqual(4000);
      expect(args.core.warning).toHaveBeenCalledTimes(3);
      for (const call of args.core.warning.mock.calls) {
        expect(call[0]).toMatch(/PR #42/);
        expect(call[0]).toMatch(new RegExp(`update comment id=${gh.existing.id}`));
        expect(call[0]).toMatch(/bbox-mixed-operator-matrix-summary/);
      }
    },
  );

  it("gives up after maxAttempts on persistent transient update errors and rethrows", async () => {
    const gh = makeFlakyUpdateGithub([500, 500, 500, 500]);
    const { args, sleep } = retryArgs(gh);

    await expect(upsertPrComment(args)).rejects.toMatchObject({ status: 500 });
    expect(gh.spies.updateComment).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(args.core.error).toHaveBeenCalledWith(
      expect.stringContaining("Retries exhausted"),
    );
  });

  it("does NOT retry non-transient update errors and fails fast", async () => {
    const gh = makeFlakyUpdateGithub([422, 422, 422, 422]);
    const { args, sleep } = retryArgs(gh);

    await expect(upsertPrComment(args)).rejects.toMatchObject({ status: 422 });
    expect(gh.spies.updateComment).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(args.core.error).toHaveBeenCalledWith(
      expect.stringContaining("Non-transient error"),
    );
  });
});