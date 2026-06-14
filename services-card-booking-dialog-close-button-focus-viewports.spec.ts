import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that clicking the booking dialog's close (X) button:
 *   1. Closes the dialog (focus trap releases).
 *   2. Returns focus to the Services card element that opened it.
 *
 * Two trigger paths are covered for each viewport:
 *   - Path A: Tab directly to the Book Now button → Enter → click X → focus
 *     restored to that Book Now button.
 *   - Path B: Tab to provider link → ArrowRight to Book Now → Enter → click X
 *     → focus restored to that Book Now button.
 *
 * Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000444";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Close Button Focus Provider",
  avatar_url: null,
  city: "Portland",
  state: "OR",
  average_rating: 4.6,
  total_reviews: 18,
  total_services_completed: 25,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "cccccccc-3333-3333-3333-cccccccccccc",
    title: "Close X Plumbing",
    description: "Plumbing for close-button focus test.",
    price: 140,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dddddddd-4444-4444-4444-dddddddddddd",
    title: "Close X Lawn Care",
    description: "Lawn for close-button focus test.",
    price: 90,
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

async function tabUntilInCard(
  page: Page,
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

async function readFocus(page: Page) {
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

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

test.describe("Booking dialog — close (X) button traps and returns focus across viewports", () => {
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
    test(`Close X restores focus after Tab → Enter on Book Now (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Close X Plumbing", "Close X Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        // Tab to Book Now and open the dialog.
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

        // While dialog is open, focus must remain trapped inside on Tab/Shift+Tab.
        await page.keyboard.press("Tab");
        expect(
          await focusInsideDialog(page),
          `[${vp.name}] Tab inside dialog should remain trapped (path A, "${title}")`,
        ).toBe(true);
        await page.keyboard.press("Shift+Tab");
        expect(
          await focusInsideDialog(page),
          `[${vp.name}] Shift+Tab inside dialog should remain trapped (path A, "${title}")`,
        ).toBe(true);

        // Click the close (X) button — Radix renders it with aria-label "Close".
        const closeBtn = dialog.getByRole("button", { name: /close/i }).first();
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        // Focus should return to the Book Now button that opened the dialog.
        const after = await readFocus(page);
        expect(after, `[${vp.name}] focus should not be lost after close (path A, "${title}")`).not.toBeNull();
        expect(after?.cardTitle).toBe(title);
        expect(after?.tag).toBe(before?.tag);
        expect(after?.text).toBe(before?.text);
      }
    });

    test(`Close X restores focus after ArrowRight from provider link → Enter (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Close X Plumbing", "Close X Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        // Tab to provider link, then ArrowRight to Book Now.
        const reachedLink = await tabUntilInCard(
          page,
          title,
          (info) => info.tag === "a" && (info.href ?? "").startsWith(`/provider/${PROVIDER_ID}`),
        );
        expect(reachedLink, `[${vp.name}] should Tab to provider link in "${title}"`).toBe(true);

        await page.keyboard.press("ArrowRight");
        const before = await readFocus(page);
        expect(before?.cardTitle).toBe(title);
        expect(before?.tag).toBe("button");
        expect(before?.text).toMatch(/book/i);

        await page.keyboard.press("Enter");
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        // Verify focus trap holds before clicking close.
        await page.keyboard.press("Tab");
        expect(
          await focusInsideDialog(page),
          `[${vp.name}] Tab inside dialog should remain trapped (path B, "${title}")`,
        ).toBe(true);

        const closeBtn = dialog.getByRole("button", { name: /close/i }).first();
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        const after = await readFocus(page);
        expect(after, `[${vp.name}] focus should not be lost after close (path B, "${title}")`).not.toBeNull();
        expect(after?.cardTitle).toBe(title);
        expect(after?.tag).toBe("button");
        expect(after?.text).toMatch(/book/i);
      }
    });
  }
});
