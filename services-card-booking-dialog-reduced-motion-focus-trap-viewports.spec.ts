import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that keyboard focus remains trapped inside the booking dialog
 * while it is open when the user has `prefers-reduced-motion: reduce`
 * enabled. Tab and Shift+Tab cycles must never escape the dialog. Runs
 * across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000888";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Reduced Motion Trap Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.6,
  total_reviews: 14,
  total_services_completed: 20,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "55555555-bbbb-bbbb-bbbb-555555555555",
    title: "RM Trap Plumbing",
    description: "Plumbing for reduced-motion focus-trap test.",
    price: 145,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "66666666-cccc-cccc-cccc-666666666666",
    title: "RM Trap Lawn Care",
    description: "Lawn for reduced-motion focus-trap test.",
    price: 75,
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

async function focusedInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type ?? null,
      name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
    };
  });
}

test.describe("Booking dialog — focus trap holds under prefers-reduced-motion", () => {
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
    test(`Tab and Shift+Tab stay inside dialog with reduced motion (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["RM Trap Plumbing", "RM Trap Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await expect(bookBtn).toBeVisible();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Wait until focus has actually moved inside the dialog before
        // exercising the trap (Radix moves focus on mount).
        await expect
          .poll(async () => focusInsideDialog(page), {
            timeout: 5_000,
            intervals: [50, 100, 250],
          })
          .toBe(true);

        // 30 forward Tab presses — focus must stay inside the dialog.
        for (let i = 0; i < 30; i++) {
          await page.keyboard.press("Tab");
          const inside = await focusInsideDialog(page);
          if (!inside) {
            const f = await focusedInfo(page);
            expect(
              inside,
              `[${vp.name}] forward Tab #${i + 1} escaped dialog ("${title}"); focus=${JSON.stringify(f)}`,
            ).toBe(true);
          }
        }

        // 30 backward Shift+Tab presses — focus must stay inside the dialog.
        for (let i = 0; i < 30; i++) {
          await page.keyboard.press("Shift+Tab");
          const inside = await focusInsideDialog(page);
          if (!inside) {
            const f = await focusedInfo(page);
            expect(
              inside,
              `[${vp.name}] Shift+Tab #${i + 1} escaped dialog ("${title}"); focus=${JSON.stringify(f)}`,
            ).toBe(true);
          }
        }

        // Sanity: dialog still open and focus still inside after 60 cycles.
        await expect(dialog).toBeVisible();
        expect(await focusInsideDialog(page)).toBe(true);

        // Cleanly close so the next iteration starts fresh.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }
    });
  }
});
