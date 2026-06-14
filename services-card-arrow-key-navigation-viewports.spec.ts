import { test, expect } from "@playwright/test";

/**
 * Verifies arrow-key focus cycling and Enter activation inside Services cards
 * across mobile, tablet, and desktop viewports.
 *
 * Cycle (in DOM order): Provider Link → Book Now → Provider Link …
 *   ArrowRight / ArrowDown move forward
 *   ArrowLeft / ArrowUp move backward
 *
 * Enter on Provider Link → navigates to /provider/:id
 * Enter on Book Now      → opens booking dialog
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000ff";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Arrow Viewport Provider",
  avatar_url: null,
  city: "Boise",
  state: "ID",
  average_rating: 4.5,
  total_reviews: 8,
  total_services_completed: 12,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    title: "Arrow VP Plumbing",
    description: "Plumbing service for arrow viewport test.",
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
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    title: "Arrow VP Lawn Care",
    description: "Lawn service for arrow viewport test.",
    price: 70,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    title: "Arrow VP Cleaning",
    description: "Cleaning service for arrow viewport test.",
    price: 90,
    category: "Cleaning",
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

test.describe("Services page — Arrow-key cycling + Enter activation across viewports", () => {
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
    test(`Arrow keys cycle focus between provider link and Book Now (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Arrow VP Plumbing", "Arrow VP Lawn Care", "Arrow VP Cleaning"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const reached = await tabUntilProviderLinkInCard(page, title);
        expect(reached, `[${vp.name}] should Tab to provider link in "${title}"`).toBe(true);

        // ArrowRight → Book Now
        await page.keyboard.press("ArrowRight");
        let focus = await readFocus(page);
        expect(focus?.cardTitle, `[${vp.name}] focus stays in "${title}" card`).toBe(title);
        expect(focus?.tag).toBe("button");
        expect(focus?.text).toMatch(/book/i);

        // ArrowLeft → provider link
        await page.keyboard.press("ArrowLeft");
        focus = await readFocus(page);
        expect(focus?.cardTitle).toBe(title);
        expect(focus?.tag).toBe("a");
        expect((focus?.href ?? "").startsWith(`/provider/${PROVIDER_ID}`)).toBe(true);

        // ArrowDown → Book Now (alternate forward key)
        await page.keyboard.press("ArrowDown");
        focus = await readFocus(page);
        expect(focus?.tag).toBe("button");
        expect(focus?.text).toMatch(/book/i);

        // ArrowUp → provider link (alternate backward key)
        await page.keyboard.press("ArrowUp");
        focus = await readFocus(page);
        expect(focus?.tag).toBe("a");
      }
    });

    test(`Enter activates focused Book Now after ArrowRight (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Arrow VP Plumbing", "Arrow VP Lawn Care", "Arrow VP Cleaning"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const reached = await tabUntilProviderLinkInCard(page, title);
        expect(reached, `[${vp.name}] should Tab to provider link in "${title}"`).toBe(true);

        await page.keyboard.press("ArrowRight");
        const focus = await readFocus(page);
        expect(focus?.tag).toBe("button");
        expect(focus?.text).toMatch(/book/i);

        await page.keyboard.press("Enter");
        const dialog = page.locator('[role="dialog"]').first();
        await expect(
          dialog,
          `[${vp.name}] booking dialog should open for "${title}"`,
        ).toBeVisible({ timeout: 10_000 });
      }
    });

    test(`Enter activates focused provider link after ArrowRight then ArrowLeft (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Arrow VP Plumbing", "Arrow VP Lawn Care", "Arrow VP Cleaning"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const reached = await tabUntilProviderLinkInCard(page, title);
        expect(reached, `[${vp.name}] should Tab to provider link in "${title}"`).toBe(true);

        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowLeft");
        const focus = await readFocus(page);
        expect(focus?.tag).toBe("a");
        expect((focus?.href ?? "").startsWith(`/provider/${PROVIDER_ID}`)).toBe(true);

        await page.keyboard.press("Enter");
        await page.waitForURL(new RegExp(`/provider/${PROVIDER_ID}$`), { timeout: 10_000 });
        expect(page.url()).toMatch(new RegExp(`/provider/${PROVIDER_ID}$`));
      }
    });
  }
});
