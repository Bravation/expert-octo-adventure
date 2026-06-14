import { afterEach, describe, expect, it } from "vitest";
import { attachLiveRegionTracker } from "./liveRegion";

const trackers: Array<{ detach: () => void }> = [];

function track(...args: Parameters<typeof attachLiveRegionTracker>) {
  const t = attachLiveRegionTracker(...args);
  trackers.push(t);
  return t;
}

afterEach(() => {
  while (trackers.length) trackers.pop()!.detach();
  document.body.innerHTML = "";
});

function makeRegion(attrs: Record<string, string>, text = ""): HTMLElement {
  const el = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

describe("attachLiveRegionTracker", () => {
  it("selects by explicit CSS selector and records mutations", async () => {
    makeRegion({ "aria-live": "polite", "data-testid": "other" }, "ignored");
    const target = makeRegion(
      { "aria-live": "polite", "data-testid": "target" },
      ""
    );

    const tracker = track({ selector: '[data-testid="target"]' });
    expect(tracker.count()).toBe(0);

    target.textContent = "hello";
    await tracker.waitForNext(0);
    expect(tracker.announcements[tracker.announcements.length - 1]).toBe(
      "hello"
    );
  });

  it("looks up the region by testId", async () => {
    makeRegion({ "aria-live": "polite", "data-testid": "a" }, "");
    const b = makeRegion({ "aria-live": "polite", "data-testid": "b" }, "");

    const tracker = track({ testId: "b" });
    b.textContent = "from b";
    await tracker.waitForNext(0);
    expect(tracker.announcements).toContain("from b");
  });

  it("scopes the search to a provided container", async () => {
    const outside = makeRegion(
      { "aria-live": "polite", "data-testid": "shared" },
      "outside"
    );
    const container = document.createElement("section");
    document.body.appendChild(container);
    const inside = document.createElement("div");
    inside.setAttribute("aria-live", "polite");
    inside.setAttribute("data-testid", "shared");
    container.appendChild(inside);

    const tracker = track({ testId: "shared", container });
    expect(tracker.count()).toBe(0);

    // Mutating the OUTSIDE region must not be recorded — the tracker is
    // bound to the inside region via the scoped container lookup.
    outside.textContent = "outside changed";
    inside.textContent = "inside changed";
    await tracker.waitForNext(0);

    expect(tracker.announcements).toEqual(["inside changed"]);
    expect(tracker.announcements).not.toContain("outside changed");
  });

  it("throws in strict mode when the selector matches multiple elements", () => {
    makeRegion({ "aria-live": "polite", "data-testid": "dup" });
    makeRegion({ "aria-live": "polite", "data-testid": "dup" });

    expect(() => attachLiveRegionTracker({ testId: "dup" })).toThrow(
      /matched 2 elements/
    );
  });

  it("falls back to the first match when strict is disabled", async () => {
    const first = makeRegion(
      { "aria-live": "polite", "data-testid": "dup" },
      ""
    );
    makeRegion({ "aria-live": "polite", "data-testid": "dup" }, "");

    const tracker = track({ testId: "dup", strict: false });
    first.textContent = "first wins";
    await tracker.waitForNext(0);
    expect(tracker.announcements).toContain("first wins");
  });

  it("throws when no element matches the selector", () => {
    expect(() =>
      attachLiveRegionTracker({ selector: '[data-testid="missing"]' })
    ).toThrow(/no element matched/);
  });

  it("rejects elements that are not aria-live regions", () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "not-live");
    document.body.appendChild(el);

    expect(() => attachLiveRegionTracker({ testId: "not-live" })).toThrow(
      /is not an aria-live region/
    );
  });

  it("accepts elements with role=status or role=alert as live regions", () => {
    makeRegion({ role: "status", "data-testid": "status-region" }, "ready");
    makeRegion({ role: "alert", "data-testid": "alert-region" }, "boom");

    expect(() => track({ testId: "status-region" })).not.toThrow();
    expect(() => track({ testId: "alert-region" })).not.toThrow();
  });
});

describe("attachLiveRegionTracker — edge cases", () => {
  it("isolates trackers across multiple containers with the same testId", async () => {
    const containerA = document.createElement("section");
    const containerB = document.createElement("section");
    document.body.append(containerA, containerB);

    const regionA = document.createElement("div");
    regionA.setAttribute("aria-live", "polite");
    regionA.setAttribute("data-testid", "region");
    containerA.appendChild(regionA);

    const regionB = document.createElement("div");
    regionB.setAttribute("aria-live", "polite");
    regionB.setAttribute("data-testid", "region");
    containerB.appendChild(regionB);

    const trackerA = track({ testId: "region", container: containerA });
    const trackerB = track({ testId: "region", container: containerB });

    regionA.textContent = "a-1";
    await trackerA.waitForNext(0);
    expect(trackerA.announcements).toContain("a-1");
    expect(trackerB.announcements).not.toContain("a-1");

    regionB.textContent = "b-1";
    await trackerB.waitForNext(0);
    expect(trackerB.announcements).toContain("b-1");
    expect(trackerA.announcements).not.toContain("b-1");
  });

  it("stops recording after detach() is called, even if the region still mutates", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "detachable" },
      ""
    );
    const tracker = track({ testId: "detachable" });

    region.textContent = "before detach";
    await tracker.waitForNext(0);
    await new Promise((r) => setTimeout(r, 20));
    const countBefore = tracker.count();

    tracker.detach();
    region.remove();
    region.textContent = "after detach";
    // Re-attach to DOM and mutate again to be sure observer is fully disconnected.
    document.body.appendChild(region);
    region.textContent = "still after detach";

    await new Promise((r) => setTimeout(r, 50));
    expect(tracker.count()).toBe(countBefore);
  });

  it("does not throw when detach() is called after the region is removed", () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "removable" },
      "x"
    );
    const tracker = attachLiveRegionTracker({ testId: "removable" });
    region.remove();
    expect(() => tracker.detach()).not.toThrow();
  });

  it("records every step of rapid consecutive focus/open/close updates in order", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "rapid" },
      ""
    );
    const tracker = track({ testId: "rapid" });

    await tracker.assertMonotonicSequence([
      {
        label: "focus",
        action: () => {
          region.textContent = "focused";
        },
        expect: /focused/,
      },
      {
        label: "open",
        action: () => {
          region.textContent = "opened";
        },
        expect: /opened/,
      },
      {
        label: "close",
        action: () => {
          region.textContent = "closed";
        },
        expect: /closed/,
      },
    ]);

    expect(tracker.count()).toBeGreaterThanOrEqual(3);
    const tail = tracker.announcements.slice(-3);
    expect(tail).toEqual(["focused", "opened", "closed"]);
  });

  it("records repeated identical text when forced via attribute mutations", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "repeat" },
      "same"
    );
    const tracker = track({ testId: "repeat" });
    const start = tracker.count();

    region.setAttribute("data-announcement-seq", "1");
    await tracker.waitForNext(start);
    region.setAttribute("data-announcement-seq", "2");
    await tracker.waitForNext(start + 1);
    region.setAttribute("data-announcement-seq", "3");
    await tracker.waitForNext(start + 2);

    expect(tracker.count()).toBeGreaterThanOrEqual(start + 3);
  });

  it("waitForNext rejects if no mutation occurs within the timeout", async () => {
    makeRegion({ "aria-live": "polite", "data-testid": "idle" }, "x");
    const tracker = track({ testId: "idle" });
    await expect(tracker.waitForNext(tracker.count(), 50)).rejects.toThrow(
      /Expected announcement count to exceed/
    );
  });
});

describe("attachLiveRegionTracker — detach race", () => {
  it("records no further announcements when detach() is followed immediately by focus/open/close", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "race" },
      ""
    );
    const tracker = attachLiveRegionTracker({ testId: "race" });

    region.textContent = "initial";
    await tracker.waitForNext(0);
    await new Promise((r) => setTimeout(r, 20));
    const countAtDetach = tracker.count();

    // Detach and immediately fire a rapid focus → open → close sequence
    // synchronously, the way a keyboard interaction might in the real UI.
    tracker.detach();
    region.textContent = "focused";
    region.setAttribute("data-announcement-seq", "1");
    region.textContent = "opened";
    region.setAttribute("data-announcement-seq", "2");
    region.textContent = "closed";
    region.setAttribute("data-announcement-seq", "3");

    // Allow any queued MutationObserver microtasks to flush.
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 50));

    expect(tracker.count()).toBe(countAtDetach);
    expect(tracker.announcements).not.toContain("focused");
    expect(tracker.announcements).not.toContain("opened");
    expect(tracker.announcements).not.toContain("closed");
  });

  it("is safe to call detach() multiple times in rapid succession", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "double-detach" },
      "x"
    );
    const tracker = attachLiveRegionTracker({ testId: "double-detach" });
    const before = tracker.count();

    expect(() => {
      tracker.detach();
      tracker.detach();
      tracker.detach();
    }).not.toThrow();

    region.textContent = "should be ignored";
    await new Promise((r) => setTimeout(r, 50));
    expect(tracker.count()).toBe(before);
  });
});

describe("attachLiveRegionTracker — stress", () => {
  it("never records announcements after detach across many rapid focus/open/close cycles", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "stress" },
      ""
    );

    const CYCLES = 200;
    const DETACH_EVERY = 7;
    const trackers: Array<ReturnType<typeof attachLiveRegionTracker>> = [];
    const detached: Array<{
      tracker: ReturnType<typeof attachLiveRegionTracker>;
      countAtDetach: number;
      baseline: number;
    }> = [];

    let active = attachLiveRegionTracker({ testId: "stress" });
    trackers.push(active);
    let baseline = active.count();

    for (let i = 0; i < CYCLES; i++) {
      // Rapid synchronous focus → open → close burst, with attribute
      // mutations to force the observer to record even identical text.
      region.textContent = `focused-${i}`;
      region.setAttribute("data-announcement-seq", `${i}-f`);
      region.textContent = `opened-${i}`;
      region.setAttribute("data-announcement-seq", `${i}-o`);
      region.textContent = `closed-${i}`;
      region.setAttribute("data-announcement-seq", `${i}-c`);

      if (i % DETACH_EVERY === 0) {
        // Fully drain any queued MutationObserver records from the burst
        // above before detaching so the post-detach burst is the only thing
        // that could leak into the tracker.
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 5));
        active.detach();
        const countAtDetach = active.count();
        detached.push({ tracker: active, countAtDetach, baseline });

        region.textContent = `post-detach-focus-${i}`;
        region.setAttribute("data-announcement-seq", `${i}-pf`);
        region.textContent = `post-detach-open-${i}`;
        region.setAttribute("data-announcement-seq", `${i}-po`);
        region.textContent = `post-detach-close-${i}`;
        region.setAttribute("data-announcement-seq", `${i}-pc`);

        active = attachLiveRegionTracker({ testId: "stress" });
        trackers.push(active);
        baseline = active.count();
      }
    }

    // Allow any pending MutationObserver microtasks to flush.
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 50));

    for (const { tracker, countAtDetach, baseline } of detached) {
      // The tracker must not have grown after detach.
      expect(tracker.count()).toBe(countAtDetach);
      // None of the post-detach payloads should have leaked into a detached
      // tracker via mutations recorded *after* it was attached. The
      // initial textContent snapshot (index 0..baseline) is excluded
      // because that value reflects whatever was in the DOM at attach
      // time, not a recorded mutation.
      const recordedAfterAttach = tracker.announcements.slice(baseline);
      const leaked = recordedAfterAttach.filter((a) =>
        /^post-detach-/.test(a)
      );
      expect(leaked).toEqual([]);
    }

    // Cleanup: detach any still-active tracker.
    for (const t of trackers) {
      try {
        t.detach();
      } catch {
        // ignore — already detached
      }
    }
  });
});

describe("attachLiveRegionTracker initial snapshot handling", () => {
  it("does not treat the initial textContent as a post-mutation announcement", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "preloaded" },
      "preexisting content"
    );

    const tracker = track({ testId: "preloaded" });

    // The region already contained text at attach time, but the tracker
    // records post-mutation announcements only — so the initial snapshot
    // must NOT be present in `announcements`, and count() must be 0.
    expect(tracker.count()).toBe(0);
    expect(tracker.announcements).not.toContain("preexisting content");

    // First real mutation produces the first recorded announcement.
    region.textContent = "first update";
    await tracker.waitForNext(0);

    expect(tracker.count()).toBe(1);
    expect(tracker.announcements).toEqual(["first update"]);
    expect(tracker.announcements).not.toContain("preexisting content");
  });

  it("waitForNext(0) waits for a real mutation even when initial text exists", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "preloaded-2" },
      "stale snapshot"
    );

    const tracker = track({ testId: "preloaded-2" });

    // With the previous (buggy) behavior, `announcements` would already
    // contain "stale snapshot" and waitForNext(0) would resolve immediately
    // without any mutation. Verify it actually waits for a mutation.
    const pending = tracker.waitForNext(0, 200);
    let resolved = false;
    pending.then(() => {
      resolved = true;
    }).catch(() => {
      // ignore — see assertion below
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    region.textContent = "real mutation";
    const newCount = await pending;
    expect(newCount).toBe(1);
    expect(tracker.announcements).toEqual(["real mutation"]);
  });
});

describe("attachLiveRegionTracker async update recording", () => {
  it("records only async updates that happen after attach, ignoring synchronous setup mutations", async () => {
    const region = makeRegion(
      { "aria-live": "polite", "data-testid": "async-target" },
      ""
    );

    // Synchronous "setup" mutations performed BEFORE attach. These mutate
    // the DOM but happen prior to the MutationObserver being wired up, so
    // they must never appear in `announcements`.
    region.textContent = "setup-1";
    region.textContent = "setup-2";
    region.textContent = "setup-final";

    const tracker = track({ testId: "async-target" });

    // Immediately after attach: nothing recorded yet, even though the
    // region has non-empty textContent from the synchronous setup.
    expect(tracker.count()).toBe(0);
    expect(tracker.announcements).not.toContain("setup-1");
    expect(tracker.announcements).not.toContain("setup-2");
    expect(tracker.announcements).not.toContain("setup-final");

    // Schedule an asynchronous update via setTimeout. The tracker must
    // record this one because it occurs after attach, off the current tick.
    setTimeout(() => {
      region.textContent = "async-update";
    }, 10);

    // Before the timer fires, still nothing recorded.
    expect(tracker.count()).toBe(0);

    await tracker.waitForNext(0);

    expect(tracker.count()).toBe(1);
    expect(tracker.announcements).toEqual(["async-update"]);
    expect(tracker.announcements).not.toContain("setup-final");
  });
});
