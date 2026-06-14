import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that pressing Enter on the booking dialog's first focusable
 * element does NOT close the dialog or move focus outside of it (i.e., the
 * dialog remains open and focus stays trapped inside), while
 * `prefers-reduced-motion: reduce` is enabled. Runs across mobile, tablet,
 * and desktop viewports.
 *
 * The "first focusable element" is whatever Radix moves focus to on open
 * (typically the Close (X) button). Pressing Enter on Close would dismiss
 * the dialog — so we explicitly walk to the first focusable element that
 * is NOT a close/dismiss control before pressing Enter, and assert:
 *   1. The dialog is still open.
 *   2. Focus remains inside the dialog.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000ccc";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "RM Enter First Focusable Provider",
  avatar_url: null,
  city: "Atlanta",
  state: "GA",
  average_rating: 4.6,
  total_reviews: 13,
  total_services_completed: 19,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "dddddddd-4444-5555-6666-dddddddddddd",
    title: "RM Enter Plumbing",
    description: "Plumbing for RM enter-first-focusable test.",
    price: 140,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eeeeeeee-5555-6666-7777-eeeeeeeeeeee",
    title: "RM Enter Lawn Care",
    description: "Lawn for RM enter-first-focusable test.",
    price: 82,
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

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

async function focusedDescriptor(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type ?? null,
      ariaLabel: el.getAttribute("aria-label"),
      text: (el.textContent || "").trim().slice(0, 80),
    };
  });
}

function isCloseLike(d: { tag: string; ariaLabel: string | null; text: string }) {
  const label = `${d.ariaLabel ?? ""} ${d.text}`.toLowerCase();
  return d.tag === "button" && /close|dismiss/.test(label);
}

test.describe("Booking dialog — Enter on first focusable keeps focus inside under reduced motion", () => {
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
    test(`Enter on first non-close focusable keeps focus in dialog (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["RM Enter Plumbing", "RM Enter Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

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

        // Walk forward via Tab until focus lands on the first focusable
        // element that is NOT a close/dismiss control. Cap the walk to
        // avoid a full cycle.
        let landedOnSafe = false;
        let descriptor = await focusedDescriptor(page);
        if (descriptor && !isCloseLike(descriptor)) {
          landedOnSafe = true;
        } else {
          for (let i = 0; i < 10; i++) {
            await page.keyboard.press("Tab");
            const next = await focusedDescriptor(page);
            if (!next) continue;
            if (!isCloseLike(next)) {
              descriptor = next;
              landedOnSafe = true;
              break;
            }
          }
        }
        expect(
          landedOnSafe,
          `[${vp.name}] should find a non-close first focusable in dialog ("${title}")`,
        ).toBe(true);
        expect(
          await focusInsideDialog(page),
          `[${vp.name}] precondition: focus should be inside dialog ("${title}")`,
        ).toBe(true);

        // Press Enter on the first non-close focusable element.
        await page.keyboard.press("Enter");

        // The dialog must still be open and focus must remain inside it.
        // Poll briefly to absorb any React state churn from the keypress.
        await expect(async () => {
          await expect(dialog).toBeVisible();
          await expect(dialog).toHaveAttribute("data-state", "open");
          expect(
            await focusInsideDialog(page),
            `[${vp.name}] focus should stay inside dialog after Enter ("${title}")`,
          ).toBe(true);
        }).toPass({ intervals: [50, 100, 250], timeout: 5_000 });

        // Cleanly close so subsequent iterations start fresh.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }
    });
  }
});
