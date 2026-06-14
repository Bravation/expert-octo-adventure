import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that clicking outside the booking dialog (on the overlay) closes
 * the dialog and restores keyboard focus to the originating Book Now button,
 * while `prefers-reduced-motion: reduce` is enabled. Runs across mobile,
 * tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000bbb";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "RM Outside Click Provider",
  avatar_url: null,
  city: "Chicago",
  state: "IL",
  average_rating: 4.5,
  total_reviews: 11,
  total_services_completed: 16,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "bbbbbbbb-2222-3333-4444-bbbbbbbbbbbb",
    title: "RM Outside Plumbing",
    description: "Plumbing for RM outside-click test.",
    price: 135,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cccccccc-3333-4444-5555-cccccccccccc",
    title: "RM Outside Lawn Care",
    description: "Lawn for RM outside-click test.",
    price: 78,
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

test.describe("Booking dialog — outside click closes & restores focus under reduced motion", () => {
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
    test(`outside click closes dialog and restores focus to Book Now (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["RM Outside Plumbing", "RM Outside Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await expect(bookBtn).toBeVisible();

        // Focus the originating Book Now first to verify focus restoration target.
        await bookBtn.focus();
        const before = await readFocus(page);
        expect(before?.cardTitle).toBe(title);
        expect(before?.tag).toBe("button");
        expect(before?.text).toMatch(/book/i);

        // Open the dialog.
        await bookBtn.click();
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Click on the overlay (Radix renders [data-radix-dialog-overlay] or
        // a sibling fixed-inset overlay). Use a corner of the viewport that
        // is guaranteed to be outside the dialog content but on the overlay.
        // Prefer locating the Radix overlay element if present; otherwise
        // click in the top-left corner of the page (overlay covers viewport).
        const overlay = page.locator(
          '[data-radix-dialog-overlay], [data-state="open"][class*="fixed"][class*="inset-0"]',
        ).first();
        const overlayCount = await overlay.count();
        if (overlayCount > 0) {
          // Click near the top-left of the overlay to avoid hitting dialog content.
          await overlay.click({ position: { x: 5, y: 5 }, force: true });
        } else {
          // Fallback: click near the top-left of the page.
          await page.mouse.click(5, 5);
        }

        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 3_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
          const after = await readFocus(page);
          expect(
            after,
            `[${vp.name}] focus should restore after outside click ("${title}")`,
          ).not.toBeNull();
          expect(after?.cardTitle).toBe(title);
          expect(after?.tag).toBe("button");
          expect(after?.text).toMatch(/book/i);
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });
      }
    });
  }
});
