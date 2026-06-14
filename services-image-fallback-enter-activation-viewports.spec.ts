import { test, expect } from "@playwright/test";

/**
 * Verifies that on every supported viewport (mobile/tablet/desktop), pressing
 * Enter on each Services card's provider link navigates to the provider
 * profile, and pressing Enter on each card's Book Now button opens the
 * booking dialog — without depending on the fallback image being focusable.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000bb";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Enter Activation Provider",
  avatar_url: null,
  city: "Denver",
  state: "CO",
  average_rating: 4.7,
  total_reviews: 14,
  total_services_completed: 22,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Enter Plumbing",
    description: "Plumbing service for enter activation test.",
    price: 110,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Enter Lawn Care",
    description: "Lawn service for enter activation test.",
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
    id: "33333333-3333-3333-3333-333333333333",
    title: "Enter Dog Walking",
    description: "Dog walking for enter activation test.",
    price: 30,
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

test.describe("Services page — Enter activates card controls across viewports (fallback image)", () => {
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
    test(`Enter on provider link navigates to provider profile for each card (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/services");
      await expect(page.getByText("Enter Plumbing").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Enter Lawn Care").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Enter Dog Walking").first()).toBeVisible({ timeout: 10_000 });

      for (const title of ["Enter Plumbing", "Enter Lawn Care", "Enter Dog Walking"]) {
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
        await page.waitForURL(new RegExp(`/provider/${PROVIDER_ID}$`), { timeout: 10_000 });
        expect(page.url()).toMatch(new RegExp(`/provider/${PROVIDER_ID}$`));
      }
    });

    test(`Enter on Book Now opens booking dialog for each card (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Enter Plumbing", "Enter Lawn Care", "Enter Dog Walking"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const found = await tabUntilInCard(page, title, (info) => {
          return info.tag === "button" && /book/i.test(info.name);
        });
        expect(found, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

        await page.keyboard.press("Enter");

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog, `[${vp.name}] booking dialog should open for "${title}"`).toBeVisible({
          timeout: 10_000,
        });
      }
    });
  }
});
