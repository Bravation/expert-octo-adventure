import { test, expect } from "@playwright/test";

/**
 * Verifies that pressing Escape closes the booking dialog and restores focus
 * to the previously focused element inside the Services card, across mobile,
 * tablet, and desktop viewports.
 *
 * Two trigger paths are covered:
 *   1. Tab-focus the Book Now button → Enter → Escape → focus returns to Book Now.
 *   2. Tab-focus the provider link → ArrowRight to Book Now → Enter → Escape →
 *      focus returns to Book Now (the element focused immediately before opening).
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000111";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Restore Focus Provider",
  avatar_url: null,
  city: "Reno",
  state: "NV",
  average_rating: 4.4,
  total_reviews: 9,
  total_services_completed: 14,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "11111111-aaaa-aaaa-aaaa-111111111111",
    title: "Restore Plumbing",
    description: "Plumbing for restore-focus test.",
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
    id: "22222222-bbbb-bbbb-bbbb-222222222222",
    title: "Restore Lawn Care",
    description: "Lawn for restore-focus test.",
    price: 80,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "33333333-cccc-cccc-cccc-333333333333",
    title: "Restore Cleaning",
    description: "Cleaning for restore-focus test.",
    price: 95,
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

test.describe("Services page — Escape restores focus to previously focused card element across viewports", () => {
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
    test(`Escape restores focus after Tab → Enter on Book Now (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Restore Plumbing", "Restore Lawn Care", "Restore Cleaning"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const reached = await tabUntilInCard(
          page,
          title,
          (info) => info.tag === "button" && /book/i.test(info.name),
        );
        expect(reached, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

        const before = await readFocus(page);
        expect(before?.tag).toBe("button");
        expect(before?.text).toMatch(/book/i);
        expect(before?.cardTitle).toBe(title);

        await page.keyboard.press("Enter");
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        const after = await readFocus(page);
        expect(after, `[${vp.name}] focus should not be lost after Escape`).not.toBeNull();
        expect(after?.cardTitle, `[${vp.name}] focus should return to "${title}" card`).toBe(title);
        expect(after?.tag).toBe(before?.tag);
        expect(after?.text).toBe(before?.text);
      }
    });

    test(`Escape restores focus after ArrowRight from provider link → Enter on Book Now (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Restore Plumbing", "Restore Lawn Care", "Restore Cleaning"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        // Tab to provider link first.
        const reachedLink = await tabUntilInCard(
          page,
          title,
          (info) => info.tag === "a" && (info.href ?? "").startsWith(`/provider/${PROVIDER_ID}`),
        );
        expect(reachedLink, `[${vp.name}] should Tab to provider link in "${title}"`).toBe(true);

        // ArrowRight cycles focus to Book Now within the same card.
        await page.keyboard.press("ArrowRight");
        const before = await readFocus(page);
        expect(before?.cardTitle).toBe(title);
        expect(before?.tag).toBe("button");
        expect(before?.text).toMatch(/book/i);

        // Enter opens dialog, Escape closes it.
        await page.keyboard.press("Enter");
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        // Focus should return to the Book Now button (the element that opened the dialog).
        const after = await readFocus(page);
        expect(after, `[${vp.name}] focus should not be lost after Escape`).not.toBeNull();
        expect(after?.cardTitle).toBe(title);
        expect(after?.tag).toBe("button");
        expect(after?.text).toMatch(/book/i);
      }
    });
  }
});
