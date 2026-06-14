import { test, expect } from "@playwright/test";

/**
 * Verifies arrow-key navigation cycles focus between the provider link, Book Now,
 * and Request Quote (if shown) controls inside each Services card, and that
 * Enter activates whichever control is focused.
 *
 * Cycle (in DOM order):
 *   Provider Link → Book Now → (Request Quote, if present) → Provider Link …
 *
 * ArrowRight / ArrowDown move forward; ArrowLeft / ArrowUp move backward.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000ee";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Arrow Key Provider",
  avatar_url: null,
  city: "Portland",
  state: "OR",
  average_rating: 4.6,
  total_reviews: 11,
  total_services_completed: 17,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Arrow Plumbing",
    description: "Plumbing for arrow nav test.",
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
    title: "Arrow Lawn Care",
    description: "Lawn for arrow nav test.",
    price: 70,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function tabUntilProviderLinkInCard(
  page: import("@playwright/test").Page,
  title: string,
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
        href: el.getAttribute("href"),
        inCard: cardTitle === expectedTitle,
      };
    }, title);
    if (
      info?.inCard &&
      info.tag === "a" &&
      (info.href ?? "").startsWith("/provider/")
    ) {
      return true;
    }
  }
  return false;
}

async function readFocus(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const card = el.closest('[class*="overflow-hidden"]') as HTMLElement | null;
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim(),
      href: el.getAttribute("href"),
      cardTitle: card?.querySelector("h3")?.textContent?.trim() ?? "",
    };
  });
}

test.describe("Services page — Arrow keys cycle focus inside card; Enter activates", () => {
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

  test("ArrowRight from provider link focuses Book Now; ArrowLeft cycles back", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByText("Arrow Plumbing").first()).toBeVisible({ timeout: 10_000 });
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    const reached = await tabUntilProviderLinkInCard(page, "Arrow Plumbing");
    expect(reached, 'should Tab to provider link in "Arrow Plumbing"').toBe(true);

    // ArrowRight → Book Now
    await page.keyboard.press("ArrowRight");
    let focus = await readFocus(page);
    expect(focus?.cardTitle).toBe("Arrow Plumbing");
    expect(focus?.tag).toBe("button");
    expect(focus?.text).toMatch(/book/i);

    // ArrowLeft → back to provider link
    await page.keyboard.press("ArrowLeft");
    focus = await readFocus(page);
    expect(focus?.cardTitle).toBe("Arrow Plumbing");
    expect(focus?.tag).toBe("a");
    expect((focus?.href ?? "").startsWith(`/provider/${PROVIDER_ID}`)).toBe(true);

    // ArrowDown also moves forward to Book Now
    await page.keyboard.press("ArrowDown");
    focus = await readFocus(page);
    expect(focus?.tag).toBe("button");
    expect(focus?.text).toMatch(/book/i);

    // ArrowUp moves backward to provider link
    await page.keyboard.press("ArrowUp");
    focus = await readFocus(page);
    expect(focus?.tag).toBe("a");
  });

  test("Enter activates whichever control arrow keys land on", async ({ page }) => {
    // Case 1: Land on Book Now via ArrowRight, Enter opens dialog.
    await page.goto("/services");
    await expect(page.getByText("Arrow Lawn Care").first()).toBeVisible({ timeout: 10_000 });
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    let reached = await tabUntilProviderLinkInCard(page, "Arrow Lawn Care");
    expect(reached, 'should Tab to provider link in "Arrow Lawn Care"').toBe(true);

    await page.keyboard.press("ArrowRight");
    let focus = await readFocus(page);
    expect(focus?.tag).toBe("button");
    expect(focus?.text).toMatch(/book/i);

    await page.keyboard.press("Enter");
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog, "Enter on Book Now should open booking dialog").toBeVisible({
      timeout: 10_000,
    });

    // Case 2: Cycle back to provider link via ArrowLeft, Enter navigates.
    await page.goto("/services");
    await expect(page.getByText("Arrow Lawn Care").first()).toBeVisible({ timeout: 10_000 });
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    reached = await tabUntilProviderLinkInCard(page, "Arrow Lawn Care");
    expect(reached).toBe(true);

    // Move forward then back to confirm focus lands on provider link before Enter.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    focus = await readFocus(page);
    expect(focus?.tag).toBe("a");
    expect((focus?.href ?? "").startsWith(`/provider/${PROVIDER_ID}`)).toBe(true);

    await page.keyboard.press("Enter");
    await page.waitForURL(new RegExp(`/provider/${PROVIDER_ID}$`), { timeout: 10_000 });
    expect(page.url()).toMatch(new RegExp(`/provider/${PROVIDER_ID}$`));
  });
});
