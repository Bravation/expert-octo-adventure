import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that Tab and Shift+Tab inside the booking dialog cycle focus
 * within the dialog (focus trap) and never escape to elements outside
 * the dialog until it is closed. Runs across mobile, tablet, and desktop.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000222";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Focus Trap Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.7,
  total_reviews: 22,
  total_services_completed: 30,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa",
    title: "Trap Plumbing",
    description: "Plumbing for focus-trap test.",
    price: 150,
    category: "Plumbing",
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

async function tabUntilBookNow(page: Page, title: string, maxTabs = 160): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate((expectedTitle) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const card = el.closest('[class*="overflow-hidden"]') as HTMLElement | null;
      const cardTitle = card?.querySelector("h3")?.textContent?.trim() ?? "";
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim(),
        inCard: cardTitle === expectedTitle,
      };
    }, title);
    if (info?.inCard && info.tag === "button" && /book/i.test(info.text)) {
      return true;
    }
  }
  return false;
}

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

async function describeFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type"),
      text: (el.textContent || "").trim().slice(0, 60),
      ariaLabel: el.getAttribute("aria-label"),
    };
  });
}

test.describe("Booking dialog — Tab/Shift+Tab focus trap across viewports", () => {
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
    test(`Tab and Shift+Tab stay within booking dialog (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const title = "Trap Plumbing";

      await page.goto("/services");
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
      await page.locator("body").click({ position: { x: 1, y: 1 } });

      // Open the booking dialog from a focused Book Now button.
      const reached = await tabUntilBookNow(page, title);
      expect(reached, `[${vp.name}] should Tab to Book Now`).toBe(true);
      await page.keyboard.press("Enter");

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Forward Tab cycle: focus must stay inside the dialog for many presses.
      const seenForward = new Set<string>();
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
        const inside = await focusInsideDialog(page);
        const focus = await describeFocus(page);
        expect(
          inside,
          `[${vp.name}] forward Tab #${i + 1} escaped dialog. Focus: ${JSON.stringify(focus)}`,
        ).toBe(true);
        if (focus) seenForward.add(`${focus.tag}:${focus.type ?? ""}:${focus.text}:${focus.ariaLabel ?? ""}`);
      }
      // Should have visited at least 2 distinct focusable elements (real cycle, not stuck).
      expect(seenForward.size, `[${vp.name}] should cycle through multiple focusable elements`).toBeGreaterThanOrEqual(2);

      // Reverse Shift+Tab cycle: focus must also stay inside the dialog.
      const seenBackward = new Set<string>();
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Shift+Tab");
        const inside = await focusInsideDialog(page);
        const focus = await describeFocus(page);
        expect(
          inside,
          `[${vp.name}] Shift+Tab #${i + 1} escaped dialog. Focus: ${JSON.stringify(focus)}`,
        ).toBe(true);
        if (focus) seenBackward.add(`${focus.tag}:${focus.type ?? ""}:${focus.text}:${focus.ariaLabel ?? ""}`);
      }
      expect(seenBackward.size, `[${vp.name}] Shift+Tab should cycle through multiple focusable elements`).toBeGreaterThanOrEqual(2);

      // Close the dialog; focus trap should release.
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible({ timeout: 10_000 });

      // After close, Tab moves focus somewhere outside the (now-removed) dialog.
      await page.keyboard.press("Tab");
      const stillInDialog = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
      expect(stillInDialog, `[${vp.name}] dialog should be removed after Escape`).toBe(false);
    });
  }
});
