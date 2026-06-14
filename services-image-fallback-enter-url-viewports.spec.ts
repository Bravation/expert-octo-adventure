import { test, expect } from "@playwright/test";

/**
 * For every supported viewport (mobile/tablet/desktop), verifies that pressing
 * Enter on each Services card's provider link AND on each card's Book Now
 * button navigates / activates to the EXPECTED destination URL — independent
 * of the fallback image being focusable.
 *
 * - Provider link Enter  → URL becomes `/provider/:providerId`
 * - Book Now Enter       → booking dialog opens; URL stays on `/services`
 *   (the booking flow is a modal, not a route change)
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000cc";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Enter URL Provider",
  avatar_url: null,
  city: "Seattle",
  state: "WA",
  average_rating: 4.8,
  total_reviews: 19,
  total_services_completed: 27,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    title: "URL Plumbing",
    description: "Plumbing service for enter-URL test.",
    price: 120,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    title: "URL Lawn Care",
    description: "Lawn service for enter-URL test.",
    price: 90,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: "",
    photo_urls: [],
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    title: "URL Dog Walking",
    description: "Dog walking for enter-URL test.",
    price: 35,
    category: "Dog Walking",
    provider_id: PROVIDER_ID,
    photo_url: "https://broken.invalid.example/missing.jpg",
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

const TITLES = ["URL Plumbing", "URL Lawn Care", "URL Dog Walking"];

async function tabUntilInCard(
  page: import("@playwright/test").Page,
  title: string,
  predicate: (info: { tag: string; name: string; href: string | null }) => boolean,
  maxTabs = 160,
): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate((expectedTitle) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const card = el.closest('[class*="overflow-hidden"]') as HTMLElement | null;
      const cardTitle = card?.querySelector("h3")?.textContent?.trim() ?? "";
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.textContent || "").trim(),
        href: el.getAttribute("href"),
        inCard: cardTitle === expectedTitle,
      };
    }, title);
    if (info?.inCard && predicate({ tag: info.tag, name: info.name, href: info.href })) {
      return true;
    }
  }
  return false;
}

test.describe("Services page — Enter activates expected URL across viewports (fallback image)", () => {
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
    await page.route("https://broken.invalid.example/**", async (route) => {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    });
  });

  for (const vp of VIEWPORTS) {
    test(`Enter on provider link → /provider/:id for each card (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of TITLES) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const found = await tabUntilInCard(page, title, (info) => {
          return (
            info.tag === "a" &&
            (info.href ?? "").startsWith(`/provider/${PROVIDER_ID}`)
          );
        });
        expect(found, `[${vp.name}] should Tab to provider link in "${title}"`).toBe(true);

        await page.keyboard.press("Enter");

        const expectedUrl = new RegExp(`/provider/${PROVIDER_ID}(?:[/?#]|$)`);
        await page.waitForURL(expectedUrl, { timeout: 10_000 });
        expect(
          page.url(),
          `[${vp.name}] URL after Enter on provider link in "${title}" should match /provider/${PROVIDER_ID}`,
        ).toMatch(expectedUrl);
      }
    });

    test(`Enter on Book Now → booking dialog opens, URL stays /services (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of TITLES) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const found = await tabUntilInCard(page, title, (info) => {
          return info.tag === "button" && /book/i.test(info.name);
        });
        expect(found, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

        const urlBefore = page.url();
        await page.keyboard.press("Enter");

        const dialog = page.locator('[role="dialog"]').first();
        await expect(
          dialog,
          `[${vp.name}] booking dialog should open for "${title}"`,
        ).toBeVisible({ timeout: 10_000 });

        // Booking is a modal, so URL pathname should remain on /services.
        const pathnameAfter = new URL(page.url()).pathname;
        expect(
          pathnameAfter,
          `[${vp.name}] Book Now should not navigate away from /services for "${title}"`,
        ).toBe("/services");
        expect(page.url(), `[${vp.name}] origin should be unchanged`).toContain(
          new URL(urlBefore).origin,
        );
      }
    });
  }
});
