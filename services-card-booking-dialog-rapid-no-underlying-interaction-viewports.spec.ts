import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that while the booking dialog is open under
 * `prefers-reduced-motion: no-preference`, neither keyboard focus nor mouse
 * clicks can reach underlying Services page controls during a rapid
 * Tab/Shift+Tab sequence. Specifically:
 *
 *   1. At every checkpoint between bursts of Tab / Shift+Tab presses,
 *      `document.activeElement` must be inside the dialog.
 *   2. Attempting to click each previously-tagged underlying control via
 *      page.mouse.click() must NOT trigger that control (we wire native
 *      capture-phase listeners that count interactions; the count must
 *      remain 0). The dialog must stay open after every click attempt.
 *
 * Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000a2";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "NM No Underlying Provider",
  avatar_url: null,
  city: "Houston",
  state: "TX",
  average_rating: 4.6,
  total_reviews: 14,
  total_services_completed: 19,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "88888888-eeee-ffff-1111-888888888888",
    title: "NM Block Plumbing",
    description: "Plumbing for normal-motion no-underlying-interaction test.",
    price: 158,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "99999999-ffff-1111-2222-999999999999",
    title: "NM Block Lawn Care",
    description: "Lawn for normal-motion no-underlying-interaction test.",
    price: 88,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

const CHUNK_SIZE = 25;
const CHUNKS = 8; // 8 × 25 = 200 per direction

function cardLocator(page: Page, title: string) {
  return page
    .locator('[class*="overflow-hidden"]')
    .filter({ has: page.locator("h3", { hasText: title }) })
    .first();
}

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

/**
 * Tags every focusable currently OUTSIDE any dialog with data-rm-outside
 * and a capture-phase click+focus counter. Returns the array of bounding
 * rects + ids so we can attempt clicks on each later.
 */
async function instrumentOutsideControls(page: Page): Promise<
  { id: number; x: number; y: number }[]
> {
  return page.evaluate(() => {
    type Win = Window & { __rmOutsideHits?: Record<string, number> };
    (window as Win).__rmOutsideHits = {};
    const hits = (window as Win).__rmOutsideHits!;
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled]):not([type=hidden])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    ).filter((el) => {
      if (el.closest('[role="dialog"]')) return false;
      return el.offsetParent !== null;
    });
    const out: { id: number; x: number; y: number }[] = [];
    focusables.forEach((el, idx) => {
      el.setAttribute("data-rm-outside", String(idx));
      hits[String(idx)] = 0;
      const bump = (e: Event) => {
        // Only count if the dialog is open at the time of the event.
        if (document.querySelector('[role="dialog"]')) {
          hits[String(idx)] = (hits[String(idx)] || 0) + 1;
          // Best-effort: prevent any state change side effects in tests.
          e.preventDefault?.();
        }
      };
      el.addEventListener("click", bump, true);
      el.addEventListener("focus", bump, true);
      const r = el.getBoundingClientRect();
      out.push({
        id: idx,
        x: Math.max(1, Math.floor(r.left + r.width / 2)),
        y: Math.max(1, Math.floor(r.top + r.height / 2)),
      });
    });
    return out;
  });
}

async function readHits(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    type Win = Window & { __rmOutsideHits?: Record<string, number> };
    return { ...((window as Win).__rmOutsideHits || {}) };
  });
}

async function dialogIsOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return false;
    const style = window.getComputedStyle(d as HTMLElement);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      (d as HTMLElement).offsetParent !== null &&
      d.getAttribute("data-state") === "open"
    );
  });
}

test.describe("Booking dialog — no underlying clicks/focus during rapid burst (normal motion)", () => {
  test.use({ reducedMotion: "no-preference" });
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced, "prefers-reduced-motion should NOT be reduce").toBe(false);

    await page.route(/\/rest\/v1\/services(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "content-range": `0-${FAKE_SERVICES.length - 1}/${FAKE_SERVICES.length}`,
        },
        body: JSON.stringify(FAKE_SERVICES),
      });
    });
    await page.route(/\/rest\/v1\/public_provider_profiles(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([FAKE_PROVIDER]),
      });
    });
  });

  for (const vp of VIEWPORTS) {
    test(`focus + clicks cannot reach underlying controls during burst (${vp.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["NM Block Plumbing", "NM Block Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        // Tag and instrument every underlying focusable BEFORE opening.
        const targets = await instrumentOutsideControls(page);
        expect(
          targets.length,
          `[${vp.name}] should instrument at least 1 outside control ("${title}")`,
        ).toBeGreaterThan(0);

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Wait for open animation (normal motion) to settle and focus to land.
        await expect
          .poll(() => focusInsideDialog(page), {
            timeout: 5_000,
            intervals: [50, 100, 250],
          })
          .toBe(true);
        await page.evaluate(async () => {
          const root = document.querySelector('[role="dialog"]');
          if (!root) return;
          const anims = (root as Element).getAnimations({ subtree: true });
          await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
        });

        // Pick a small sample of targets to click between bursts (clicking
        // every target on every checkpoint would balloon runtime). Cap at 5,
        // spread across the array.
        const sample =
          targets.length <= 5
            ? targets
            : [0, 1, Math.floor(targets.length / 2), targets.length - 2, targets.length - 1]
                .filter((i, k, a) => a.indexOf(i) === k)
                .map((i) => targets[i]);

        const checkpoint = async (label: string) => {
          // Dialog still open.
          expect(
            await dialogIsOpen(page),
            `[${vp.name}] dialog not open at ${label} ("${title}")`,
          ).toBe(true);
          // Focus inside dialog.
          expect(
            await focusInsideDialog(page),
            `[${vp.name}] focus escaped at ${label} ("${title}")`,
          ).toBe(true);
          // Try clicking each sampled underlying control. The overlay must
          // intercept — none of them should report a hit while the dialog
          // is open.
          for (const t of sample) {
            await page.mouse.click(t.x, t.y, { delay: 0 });
          }
          const hits = await readHits(page);
          for (const t of sample) {
            expect(
              hits[String(t.id)] ?? 0,
              `[${vp.name}] underlying control id=${t.id} was activated at ${label} ("${title}")`,
            ).toBe(0);
          }
          // Dialog still open after click attempts.
          expect(
            await dialogIsOpen(page),
            `[${vp.name}] dialog closed by underlying click at ${label} ("${title}")`,
          ).toBe(true);
          // Focus must still be inside (clicks may close via overlay; if so
          // the previous assertion would already have failed).
          expect(
            await focusInsideDialog(page),
            `[${vp.name}] focus escaped after click attempts at ${label} ("${title}")`,
          ).toBe(true);
        };

        // FORWARD chunks.
        for (let c = 0; c < CHUNKS; c++) {
          const presses: Promise<void>[] = [];
          for (let i = 0; i < CHUNK_SIZE; i++) {
            presses.push(page.keyboard.press("Tab"));
          }
          await Promise.all(presses);
          await checkpoint(`forward chunk ${c + 1}/${CHUNKS}`);
        }

        // BACKWARD chunks.
        for (let c = 0; c < CHUNKS; c++) {
          const presses: Promise<void>[] = [];
          for (let i = 0; i < CHUNK_SIZE; i++) {
            presses.push(page.keyboard.press("Shift+Tab"));
          }
          await Promise.all(presses);
          await checkpoint(`backward chunk ${c + 1}/${CHUNKS}`);
        }

        // Final assertion: no underlying control received any hit at any
        // point during the entire burst.
        const finalHits = await readHits(page);
        const violators = Object.entries(finalHits).filter(([, n]) => n > 0);
        expect(
          violators,
          `[${vp.name}] underlying controls were activated during burst ("${title}"): ${JSON.stringify(violators)}`,
        ).toHaveLength(0);

        // Cleanly close.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }
    });
  }
});
