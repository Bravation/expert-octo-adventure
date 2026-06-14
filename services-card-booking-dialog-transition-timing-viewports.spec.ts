import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that the booking dialog's open and close transitions (animations,
 * mount/unmount, Radix data-state changes) fully complete BEFORE focus
 * assertions run. This guards against flaky focus checks that race the
 * dialog's enter/exit animation.
 *
 * For each viewport (mobile/tablet/desktop) and for each of two services we:
 *   1. Click Book Now.
 *   2. Wait for the dialog to be present, visible, and have data-state="open".
 *   3. Wait for any CSS transitions/animations on the dialog to finish.
 *   4. Assert focus is inside the dialog.
 *   5. Click Close (X).
 *   6. Wait for the dialog to leave the DOM (Radix unmounts after the close
 *      transition completes).
 *   7. Assert focus is restored to the originating Book Now button.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000666";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Transition Timing Provider",
  avatar_url: null,
  city: "Seattle",
  state: "WA",
  average_rating: 4.8,
  total_reviews: 30,
  total_services_completed: 40,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "11111111-7777-7777-7777-111111111111",
    title: "Transition Plumbing",
    description: "Plumbing for transition timing test.",
    price: 160,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "22222222-8888-8888-8888-222222222222",
    title: "Transition Lawn Care",
    description: "Lawn for transition timing test.",
    price: 85,
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

function cardLocator(page: Page, title: string) {
  return page
    .locator('[class*="overflow-hidden"]')
    .filter({ has: page.locator("h3", { hasText: title }) })
    .first();
}

async function readFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const card = el.closest('[class*="overflow-hidden"]') as HTMLElement | null;
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim(),
      cardTitle: card?.querySelector("h3")?.textContent?.trim() ?? "",
    };
  });
}

/**
 * Waits for all running CSS transitions and animations on the given element
 * (and its descendants) to finish. Returns true when settled, false on
 * timeout.
 */
async function waitForTransitionsToSettle(page: Page, selector: string, timeoutMs = 5000) {
  return page.evaluate(
    async ([sel, timeout]: [string, number]) => {
      const root = document.querySelector(sel as string);
      if (!root) return false;
      const deadline = Date.now() + (timeout as number);
      while (Date.now() < deadline) {
        const animating = (root as Element).getAnimations({ subtree: true });
        if (animating.length === 0) return true;
        try {
          await Promise.race([
            Promise.all(animating.map((a) => a.finished.catch(() => undefined))),
            new Promise((r) => setTimeout(r, 250)),
          ]);
        } catch {
          /* ignore */
        }
      }
      return false;
    },
    [selector, timeoutMs] as [string, number],
  );
}

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

test.describe("Booking dialog — open/close transitions complete before focus assertions", () => {
  // Automatically retry the entire test when CSS animations or Radix
  // unmounts are delayed (e.g., slow mobile emulation, animation jank).
  // Playwright will retry failed tests up to this many times in addition to
  // the original run, isolating each attempt with a fresh page/context.
  test.describe.configure({ retries: 3 });

  test.beforeEach(async ({ page }) => {
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
    test(`open and close transitions settle before focus checks (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Transition Plumbing", "Transition Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await expect(bookBtn).toBeVisible();
        await bookBtn.click();

        // Dialog should mount, become visible, and reach data-state="open".
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeAttached({ timeout: 10_000 });
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Retry the open-settled + focus check until the open animation
        // finishes and Radix moves focus into the dialog. This auto-recovers
        // when CSS transitions are slow on emulated mobile/tablet.
        await expect(async () => {
          const openSettled = await waitForTransitionsToSettle(page, '[role="dialog"]');
          expect(openSettled, `[${vp.name}] open transition should settle ("${title}")`).toBe(true);
          expect(
            await focusInsideDialog(page),
            `[${vp.name}] focus should be inside dialog after open settles ("${title}")`,
          ).toBe(true);
        }).toPass({ intervals: [100, 250, 500, 1000], timeout: 15_000 });

        // Trigger close via X button.
        const closeBtn = dialog.getByRole("button", { name: /close/i }).first();
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();

        // Retry the close-unmount + focus restore check until Radix completes
        // the exit animation and unmounts the dialog. This auto-recovers when
        // unmounts are delayed by transition jitter.
        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 5_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5_000 });
          const after = await readFocus(page);
          expect(
            after,
            `[${vp.name}] focus should restore after close transition completes ("${title}")`,
          ).not.toBeNull();
          expect(after?.cardTitle).toBe(title);
          expect(after?.tag).toBe("button");
          expect(after?.text).toMatch(/book/i);
        }).toPass({ intervals: [100, 250, 500, 1000], timeout: 15_000 });
      }
    });
  }
});
