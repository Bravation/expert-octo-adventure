import { waitFor } from "@testing-library/react";

/**
 * Test helper for asserting aria-live region updates with a monotonic
 * sequence. Tracks every mutation to the live region so tests can assert
 * that distinct interactions (focus, open, close) each trigger their own
 * announcement, and that the sequence count is strictly increasing.
 */
export interface LiveRegionTracker {
  /** Every announcement text recorded since attach() was called. */
  readonly announcements: ReadonlyArray<string>;
  /** Current number of recorded announcements. */
  count(): number;
  /**
   * Wait for the announcement count to grow strictly beyond `previousCount`.
   * Returns the new count once the assertion succeeds.
   */
  waitForNext(previousCount: number, timeout?: number): Promise<number>;
  /**
   * Assert that a sequence of interactions produced strictly increasing
   * counts. Each step is awaited in order. Throws if any step fails to
   * grow the count, or if a step's recorded message does not match its
   * optional `expect` matcher.
   */
  assertMonotonicSequence(
    steps: Array<{
      label: string;
      action: () => void | Promise<void>;
      expect?: RegExp;
    }>,
    timeout?: number
  ): Promise<void>;
  /** Stop observing and release the MutationObserver. */
  detach(): void;
}

/**
 * Options for {@link attachLiveRegionTracker}. Prefer `testId` (or an
 * explicit `selector`) when more than one aria-live region may exist on
 * the page, so the tracker is bound to the exact element under test
 * instead of silently picking the first match.
 */
export interface AttachLiveRegionOptions {
  /** Explicit CSS selector. Takes precedence over `testId`. */
  selector?: string;
  /** Convenience: matches `[data-testid="<value>"]`. */
  testId?: string;
  /**
   * When true (default), throw if the selector matches more than one
   * element. Set to false to fall back to the first match.
   */
  strict?: boolean;
  /** Optional root to scope the query (defaults to `document`). */
  container?: ParentNode;
}

/**
 * Attach a MutationObserver to the first matching aria-live region and
 * return a tracker that records every textContent update.
 *
 * Pass a string to use it as a CSS selector, or an options object to
 * select by `testId`, scope the query to a container, or relax the
 * strict single-match check.
 *
 * Defaults to the first `[aria-live="polite"]` element in the document.
 */
export function attachLiveRegionTracker(
  selectorOrOptions: string | AttachLiveRegionOptions = '[aria-live="polite"]'
): LiveRegionTracker {
  const options: AttachLiveRegionOptions =
    typeof selectorOrOptions === "string"
      ? { selector: selectorOrOptions }
      : selectorOrOptions;

  const { testId, container = document, strict = true } = options;
  let { selector } = options;

  if (!selector && testId) {
    selector = `[data-testid="${testId}"]`;
  }
  if (!selector) {
    selector = '[aria-live="polite"]';
  }

  const matches = Array.from(
    container.querySelectorAll(selector)
  ) as HTMLElement[];

  if (matches.length === 0) {
    throw new Error(
      `attachLiveRegionTracker: no element matched selector "${selector}"`
    );
  }
  if (strict && matches.length > 1) {
    throw new Error(
      `attachLiveRegionTracker: selector "${selector}" matched ${matches.length} elements; pass a more specific selector or testId, or set strict: false`
    );
  }

  const region = matches[0];
  // Sanity-check that the chosen element is actually a live region so
  // misconfigured selectors fail loudly instead of recording nothing.
  const ariaLive = region.getAttribute("aria-live");
  const role = region.getAttribute("role");
  if (!ariaLive && role !== "status" && role !== "alert") {
    throw new Error(
      `attachLiveRegionTracker: element matched by "${selector}" is not an aria-live region (missing aria-live / role="status" / role="alert")`
    );
  }

  const announcements: string[] = [];
  // Note: we intentionally do NOT seed `announcements` with the initial
  // textContent snapshot. The tracker records post-mutation announcements
  // only, so callers can rely on count() === 0 immediately after attach
  // even when the live region already contains text.

  let detached = false;
  const observer = new MutationObserver(() => {
    if (detached) return;
    const text = (region.textContent ?? "").trim();
    if (text.length > 0) {
      announcements.push(text);
    }
  });
  observer.observe(region, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-announcement-seq"],
  });

  const tracker: LiveRegionTracker = {
    announcements,
    count: () => announcements.length,
    waitForNext: async (previousCount, timeout = 2000) => {
      await waitFor(
        () => {
          if (announcements.length <= previousCount) {
            throw new Error(
              `Expected announcement count to exceed ${previousCount}, got ${announcements.length}`
            );
          }
        },
        { timeout }
      );
      return announcements.length;
    },
    assertMonotonicSequence: async (steps, timeout = 2000) => {
      let previousCount = announcements.length;
      for (const step of steps) {
        await step.action();
        const newCount = await tracker.waitForNext(previousCount, timeout).catch(
          (err) => {
            throw new Error(
              `[${step.label}] live-region count did not increase: ${(err as Error).message}`
            );
          }
        );
        if (step.expect) {
          const latest = announcements[announcements.length - 1];
          if (!step.expect.test(latest)) {
            throw new Error(
              `[${step.label}] latest announcement "${latest}" did not match ${step.expect}`
            );
          }
        }
        previousCount = newCount;
      }
    },
    detach: () => {
      detached = true;
      observer.disconnect();
    },
  };

  return tracker;
}