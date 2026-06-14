import { test, expect } from "@playwright/test";

/**
 * Verifies that when service cards render with the *fallback* image
 * (because photo_url is missing/empty/broken), keyboard users can still
 * Tab to each card's interactive controls (provider link + Book Now button)
 * and activate them with Enter / Space — without depending on the image
 * itself being focusable or clickable.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000aa";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Activation Test Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.6,
  total_reviews: 8,
  total_services_completed: 11,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Activate Plumbing",
    description: "Plumbing service for activation test.",
    price: 100,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    title: "Activate Lawn Care",
    description: "Lawn service for activation test.",
    price: 75,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: "",
    photo_urls: [],
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    title: "Activate Dog Walking",
    description: "Dog walking for activation test.",
    price: 25,
    category: "Dog Walking",
    provider_id: PROVIDER_ID,
    photo_url: "https://broken.invalid.example/missing.jpg",
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

test.describe("Services page — keyboard activation of card controls (fallback image)", () => {
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

  /**
   * Tab forward until the focused element is inside the card whose <h3>
   * matches `title` AND matches the optional name predicate. Bounded so
   * a focus trap can't loop forever. Returns true if found.
   */
  async function tabUntilInCard(
    page: import("@playwright/test").Page,
    title: string,
    predicate: (info: { tag: string; name: string; href: string | null }) => boolean,
    maxTabs = 120,
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
          cardTitle,
          inCard: cardTitle === expectedTitle,
        };
      }, title);
      if (info?.inCard && predicate({ tag: info.tag, name: info.name, href: info.href })) {
        return true;
      }
    }
    return false;
  }

  test("Enter on the provider link navigates to /provider/:id", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByText("Activate Plumbing").first()).toBeVisible({ timeout: 10_000 });

    // Reset focus to body.
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    // Tab to the provider <a> inside the first stubbed card.
    const found = await tabUntilInCard(page, "Activate Plumbing", (info) => {
      return info.tag === "a" && (info.href ?? "").startsWith(`/provider/${PROVIDER_ID}`);
    });
    expect(found, "should be able to Tab to the provider link in the card").toBe(true);

    // Activate with Enter — should navigate to provider profile.
    await page.keyboard.press("Enter");
    await page.waitForURL(new RegExp(`/provider/${PROVIDER_ID}$`), { timeout: 10_000 });
    expect(page.url()).toMatch(new RegExp(`/provider/${PROVIDER_ID}$`));
  });

  test("Space on the Book Now button activates the booking flow", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByText("Activate Lawn Care").first()).toBeVisible({ timeout: 10_000 });

    await page.locator("body").click({ position: { x: 1, y: 1 } });

    // Tab to the Book Now button inside the Lawn Care card.
    const found = await tabUntilInCard(page, "Activate Lawn Care", (info) => {
      return info.tag === "button" && /book/i.test(info.name);
    });
    expect(found, "should be able to Tab to the Book Now button in the card").toBe(true);

    // Activate with Space — booking dialog should open.
    await page.keyboard.press("Space");

    // The booking flow opens a dialog (role="dialog"). It must become visible
    // without depending on any image click.
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
  });

  test("Enter on the Book Now button activates the booking flow", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByText("Activate Dog Walking").first()).toBeVisible({ timeout: 10_000 });

    await page.locator("body").click({ position: { x: 1, y: 1 } });

    const found = await tabUntilInCard(page, "Activate Dog Walking", (info) => {
      return info.tag === "button" && /book/i.test(info.name);
    });
    expect(found, "should be able to Tab to the Book Now button in the card").toBe(true);

    await page.keyboard.press("Enter");

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
  });
});
