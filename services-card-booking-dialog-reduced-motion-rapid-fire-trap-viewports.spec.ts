import { test, expect, type Page } from "@playwright/test";

/**
 * High-volume rapid-fire focus-trap stress test.
 *
 * After opening the booking dialog under `prefers-reduced-motion: reduce`,
 * fires 250 Tab presses followed by 250 Shift+Tab presses with NO awaits
 * between keypresses (using CDP-level dispatch via page.keyboard with
 * Promise.all batching). Then asserts:
 *   1. Focus is still inside the dialog.
 *   2. Focus is NOT on any underlying Services page control (cards, navbar,
 *      filters, search inputs, etc.) — verified by snapshotting the set of
 *      focusable elements outside the dialog before opening, and proving
 *      the final activeElement is not one of them.
 *
 * Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000eee";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "RM Rapid Fire Provider",
  avatar_url: null,
  city: "San Diego",
  state: "CA",
  average_rating: 4.7,
  total_reviews: 17,
  total_services_completed: 23,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "22222222-8888-9999-aaaa-222222222222",
    title: "RM Rapid Plumbing",
    description: "Plumbing for RM rapid-fire trap test.",
    price: 142,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "33333333-9999-aaaa-bbbb-333333333333",
    title: "RM Rapid Lawn Care",
    description: "Lawn for RM rapid-fire trap test.",
    price: 81,
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

const PRESS_COUNT = 250;

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
 * Tags every focusable element currently outside any dialog with a unique
 * data-rm-outside attribute and returns the count tagged. After the dialog
 * opens, we can later check whether activeElement carries a tagged
 * attribute — proving focus reached an underlying page control.
 */
async function tagOutsideFocusables(page: Page): Promise<number> {
  return page.evaluate(() => {
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
      // Must be visible / interactable.
      return el.offsetParent !== null;
    });
    focusables.forEach((el, idx) => {
      el.setAttribute("data-rm-outside", String(idx));
    });
    return focusables.length;
  });
}

async function activeElementInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      return { tag: el?.tagName.toLowerCase() ?? "body", inDialog: false, outsideTag: null };
    }
    const dialog = document.querySelector('[role="dialog"]');
    return {
      tag: el.tagName.toLowerCase(),
      inDialog: !!dialog && dialog.contains(el),
      outsideTag: el.getAttribute("data-rm-outside"),
      ariaLabel: el.getAttribute("aria-label"),
      text: (el.textContent || "").trim().slice(0, 60),
    };
  });
}

test.describe("Booking dialog — rapid-fire Tab/Shift+Tab cannot escape under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced, "prefers-reduced-motion: reduce should be active").toBe(true);

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
    test(`${PRESS_COUNT}× Tab + ${PRESS_COUNT}× Shift+Tab never escape dialog (${vp.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["RM Rapid Plumbing", "RM Rapid Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        // Tag every focusable currently OUTSIDE any dialog (i.e. underlying
        // Services page controls). After opening the dialog, focus must
        // never land on an element carrying data-rm-outside.
        const taggedCount = await tagOutsideFocusables(page);
        expect(
          taggedCount,
          `[${vp.name}] should tag at least 1 outside focusable ("${title}")`,
        ).toBeGreaterThan(0);

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Wait for Radix to seed focus inside the dialog.
        await expect
          .poll(() => focusInsideDialog(page), {
            timeout: 5_000,
            intervals: [50, 100, 250],
          })
          .toBe(true);

        // Sanity sample function: assert focus is inside dialog AND not on
        // any tagged outside focusable.
        const assertNoEscape = async (label: string) => {
          const info = await activeElementInfo(page);
          expect(
            info.inDialog,
            `[${vp.name}] ${label} — focus escaped dialog ("${title}"); info=${JSON.stringify(info)}`,
          ).toBe(true);
          expect(
            info.outsideTag,
            `[${vp.name}] ${label} — focus on tagged outside control ("${title}"); info=${JSON.stringify(info)}`,
          ).toBeNull();
        };

        // FORWARD: PRESS_COUNT rapid Tab presses with no awaits between.
        // Use a single page.evaluate to dispatch many keys without the
        // per-press protocol overhead, simulating a held-down Tab key.
        // We still issue real key events via page.keyboard in tight loop
        // (Promise-batched) to exercise actual focus handlers.
        const forwardPromises: Promise<void>[] = [];
        for (let i = 0; i < PRESS_COUNT; i++) {
          forwardPromises.push(page.keyboard.press("Tab"));
        }
        await Promise.all(forwardPromises);
        await assertNoEscape(`after ${PRESS_COUNT} forward Tab presses`);

        // Sample a few times during the burst tail to be safe.
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press("Tab");
          await assertNoEscape(`forward tail Tab ${i + 1}`);
        }

        // BACKWARD: PRESS_COUNT rapid Shift+Tab presses.
        const backwardPromises: Promise<void>[] = [];
        for (let i = 0; i < PRESS_COUNT; i++) {
          backwardPromises.push(page.keyboard.press("Shift+Tab"));
        }
        await Promise.all(backwardPromises);
        await assertNoEscape(`after ${PRESS_COUNT} Shift+Tab presses`);

        for (let i = 0; i < 5; i++) {
          await page.keyboard.press("Shift+Tab");
          await assertNoEscape(`backward tail Shift+Tab ${i + 1}`);
        }

        // Dialog must still be open after the entire stress burst.
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute("data-state", "open");

        // Cleanly close before the next iteration.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }
    });
  }
});
