import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that opening the booking dialog by clicking the Book Now button
 * via different interaction paths returns focus to the originating element
 * after the close (X) button is pressed.
 *
 * Click paths covered:
 *   A) Click Book Now directly (no prior focus on card).
 *   B) Click the card body first (to interact with the card), then click Book Now.
 *   C) Click the provider link area (without navigating) by focusing it, then
 *      click Book Now in the same card.
 *
 * In all cases, after closing via X, focus must return to the Book Now button
 * inside the same Services card. Runs across mobile, tablet, and desktop.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000555";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Click Paths Focus Provider",
  avatar_url: null,
  city: "Denver",
  state: "CO",
  average_rating: 4.7,
  total_reviews: 22,
  total_services_completed: 31,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "eeeeeeee-5555-5555-5555-eeeeeeeeeeee",
    title: "Click Path Plumbing",
    description: "Plumbing for click-path focus test.",
    price: 175,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "ffffffff-6666-6666-6666-ffffffffffff",
    title: "Click Path Lawn Care",
    description: "Lawn for click-path focus test.",
    price: 95,
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

function cardLocator(page: Page, title: string) {
  return page
    .locator('[class*="overflow-hidden"]')
    .filter({ has: page.locator("h3", { hasText: title }) })
    .first();
}

test.describe("Booking dialog — click paths return focus to Book Now across viewports", () => {
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
    test(`Path A — direct Book Now click restores focus on close (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Click Path Plumbing", "Click Path Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await expect(bookBtn).toBeVisible();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        const closeBtn = dialog.getByRole("button", { name: /close/i }).first();
        await closeBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        const after = await readFocus(page);
        expect(after, `[${vp.name}] focus should restore (path A, "${title}")`).not.toBeNull();
        expect(after?.cardTitle).toBe(title);
        expect(after?.tag).toBe("button");
        expect(after?.text).toMatch(/book/i);
      }
    });

    test(`Path B — click card body, then Book Now restores focus on close (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Click Path Plumbing", "Click Path Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        // Click an inert area of the card body (the title) — should not navigate.
        await card.locator("h3", { hasText: title }).click();

        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await expect(bookBtn).toBeVisible();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        const closeBtn = dialog.getByRole("button", { name: /close/i }).first();
        await closeBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        const after = await readFocus(page);
        expect(after, `[${vp.name}] focus should restore (path B, "${title}")`).not.toBeNull();
        expect(after?.cardTitle).toBe(title);
        expect(after?.tag).toBe("button");
        expect(after?.text).toMatch(/book/i);
      }
    });

    test(`Path C — focus provider link, then click Book Now restores focus on close (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Click Path Plumbing", "Click Path Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        // Focus (not navigate to) the provider link in this card.
        const providerLink = card.locator(`a[href^="/provider/${PROVIDER_ID}"]`).first();
        await expect(providerLink).toBeVisible();
        await providerLink.focus();

        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        const closeBtn = dialog.getByRole("button", { name: /close/i }).first();
        await closeBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        const after = await readFocus(page);
        expect(after, `[${vp.name}] focus should restore (path C, "${title}")`).not.toBeNull();
        expect(after?.cardTitle).toBe(title);
        expect(after?.tag).toBe("button");
        expect(after?.text).toMatch(/book/i);
      }
    });
  }
});
