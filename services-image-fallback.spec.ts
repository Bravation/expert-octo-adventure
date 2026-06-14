import { test, expect } from "@playwright/test";

/**
 * Verifies that when a service has a missing, empty, or invalid `photo_url`
 * (and no `photo_urls`), the ServiceCard renders an <img> whose src falls
 * back to a category-appropriate Unsplash image — including via the runtime
 * onError handler when the original URL 404s.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000aa";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Fallback Test Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.8,
  total_reviews: 12,
  total_services_completed: 20,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    // photo_url is null -> should resolve to Plumbing → Home Improvement fallback
    id: "11111111-1111-1111-1111-111111111111",
    title: "Emergency Plumbing",
    description: "24/7 emergency plumbing repairs.",
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
    // photo_url is empty string
    id: "22222222-2222-2222-2222-222222222222",
    title: "Lawn Care",
    description: "Weekly lawn maintenance.",
    price: 80,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: "",
    photo_urls: [],
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    // photo_url is /placeholder.svg (treated as missing)
    id: "33333333-3333-3333-3333-333333333333",
    title: "Dog Walking",
    description: "Daily dog walking service.",
    price: 25,
    category: "Dog Walking",
    provider_id: PROVIDER_ID,
    photo_url: "/placeholder.svg",
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    // photo_url is a URL that will 404 -> onError swap kicks in
    id: "44444444-4444-4444-4444-444444444444",
    title: "Car Detailing",
    description: "Full interior + exterior detailing.",
    price: 200,
    category: "Car Detailing",
    provider_id: PROVIDER_ID,
    photo_url: "https://broken.invalid.example/does-not-exist.jpg",
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

test.describe("Services page — category image fallback", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Supabase REST calls: services + public_provider_profiles.
    await page.route(/\/rest\/v1\/services(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": `0-${FAKE_SERVICES.length - 1}/${FAKE_SERVICES.length}` },
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
    // Force the broken URL to actually 404 so the onError fallback fires.
    await page.route("https://broken.invalid.example/**", async (route) => {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    });
  });

  test("missing/empty/placeholder photo_url renders Unsplash category fallback in src", async ({
    page,
  }) => {
    await page.goto("/services");

    // Wait for at least one stubbed service title to appear.
    await expect(page.getByText("Emergency Plumbing").first()).toBeVisible({ timeout: 10_000 });

    // Collect all <img> elements rendered for stubbed services.
    // Each card image uses object-cover; we just check every img on the page
    // that points outward — none should be /placeholder.svg, all the four
    // service cards must use the Unsplash CDN fallback.
    const cardImages = page.locator("img.object-cover");
    const count = await cardImages.count();
    expect(count).toBeGreaterThanOrEqual(FAKE_SERVICES.length);

    // For each of our 4 stubbed services, locate the card by title and assert
    // its image src is on the Unsplash CDN (the category fallback).
    const titles = FAKE_SERVICES.map((s) => s.title);
    for (const title of titles) {
      const card = page.locator("div", { has: page.getByText(title, { exact: true }) }).first();
      const img = card.locator("img.object-cover").first();
      await expect(img).toBeVisible();
      const src = await img.getAttribute("src");
      expect(src, `image src for "${title}"`).toBeTruthy();
      expect(src!.startsWith("/placeholder.svg")).toBe(false);
      // Either the resolver chose a fallback up front, or the onError handler
      // swapped the broken src to one — both end on images.unsplash.com.
      expect(src!).toMatch(/^https:\/\/images\.unsplash\.com\//);
    }
  });

  test("broken photo_url is replaced via onError with an Unsplash fallback", async ({ page }) => {
    await page.goto("/services");

    // Locate the Car Detailing card (its src starts as the broken URL).
    const card = page.locator("div", { has: page.getByText("Car Detailing", { exact: true }) }).first();
    const img = card.locator("img.object-cover").first();
    await expect(img).toBeVisible({ timeout: 10_000 });

    // Wait until onError has swapped the src to the Unsplash CDN.
    await expect
      .poll(async () => await img.getAttribute("src"), { timeout: 10_000 })
      .toMatch(/^https:\/\/images\.unsplash\.com\//);

    // The onError handler marks the element with data-fallback-applied="true".
    await expect(img).toHaveAttribute("data-fallback-applied", "true");
  });

  test("a11y: each fallback image has correct alt text, dimensions, and is visible", async ({
    page,
  }) => {
    await page.goto("/services");

    // Wait for cards to render.
    await expect(page.getByText("Emergency Plumbing").first()).toBeVisible({ timeout: 10_000 });

    for (const service of FAKE_SERVICES) {
      const card = page
        .locator("div", { has: page.getByText(service.title, { exact: true }) })
        .first();
      const img = card.locator("img.object-cover").first();

      // Image element exists and is visible (not hidden / display:none / 0-size).
      await expect(img, `image for "${service.title}" should be visible`).toBeVisible();

      // Alt text matches the service title — meaningful, non-empty, not generic.
      const alt = await img.getAttribute("alt");
      expect(alt, `alt for "${service.title}"`).toBe(service.title);
      expect(alt!.trim().length).toBeGreaterThan(0);

      // Must not be aria-hidden (would hide it from assistive tech).
      const ariaHidden = await img.getAttribute("aria-hidden");
      expect(ariaHidden).not.toBe("true");

      // Must not have role="presentation"/"none" (which would strip semantics
      // from a meaningful content image).
      const role = await img.getAttribute("role");
      expect(role === "presentation" || role === "none").toBe(false);

      // src must be a real, non-empty URL (not "", not "/placeholder.svg").
      const src = await img.getAttribute("src");
      expect(src, `src for "${service.title}"`).toBeTruthy();
      expect(src!.trim().length).toBeGreaterThan(0);
      expect(src).not.toBe("/placeholder.svg");

      // Rendered with non-zero dimensions (not a 0x0 / empty img).
      const box = await img.boundingBox();
      expect(box, `bounding box for "${service.title}"`).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);

      // naturalWidth > 0 confirms the browser actually loaded pixels —
      // i.e. the fallback image is a real image, not a broken/empty one.
      // For the broken-URL service, wait for the onError swap to finish.
      await expect
        .poll(async () => await img.evaluate((el: HTMLImageElement) => el.naturalWidth), {
          timeout: 10_000,
        })
        .toBeGreaterThan(0);
    }
  });
});