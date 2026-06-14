import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies booking dialog open/close transition timing and focus assertions
 * when the user has `prefers-reduced-motion: reduce` enabled. Animations
 * should be minimized or skipped, but focus management (trap on open,
 * restore on close) must still be correct across mobile/tablet/desktop.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000777";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Reduced Motion Provider",
  avatar_url: null,
  city: "Boston",
  state: "MA",
  average_rating: 4.5,
  total_reviews: 12,
  total_services_completed: 18,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "33333333-9999-9999-9999-333333333333",
    title: "Reduced Motion Plumbing",
    description: "Plumbing for reduced-motion test.",
    price: 150,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "44444444-aaaa-aaaa-aaaa-444444444444",
    title: "Reduced Motion Lawn Care",
    description: "Lawn for reduced-motion test.",
    price: 80,
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

function cardLocator(page: Page, title: string) {
  return page
    .locator('[class*="overflow-hidden"]')
    .filter({ has: page.locator("h3", { hasText: title }) })
    .first();
}

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

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

async function waitForTransitionsToSettle(page: Page, selector: string, timeoutMs = 5000) {
  return page.evaluate(
    async ([sel, timeout]: [string, number]) => {
      const root = document.querySelector(sel as string);
      if (!root) return false;
      const deadline = Date.now() + (timeout as number);
      while (Date.now() < deadline) {
        const animating = (root as Element).getAnimations({ subtree: true });
        if (animating.length === 0) return true;
        try {
          await Promise.race([
            Promise.all(animating.map((a) => a.finished.catch(() => undefined))),
            new Promise((r) => setTimeout(r, 250)),
          ]);
        } catch {
          /* ignore */
        }
      }
      return false;
    },
    [selector, timeoutMs] as [string, number],
  );
}

test.describe("Booking dialog — transition timing with prefers-reduced-motion", () => {
  test.use({ colorScheme: "light", reducedMotion: "reduce" });
  test.describe.configure({ retries: 3 });

  test.beforeEach(async ({ page }) => {
    // Sanity check: the emulated media query should report "reduce".
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced, "prefers-reduced-motion: reduce should be active").toBe(true);

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
    test(`open/close transitions and focus assertions with reduced motion (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Reduced Motion Plumbing", "Reduced Motion Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await expect(bookBtn).toBeVisible();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeAttached({ timeout: 10_000 });
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // With reduced motion, transitions should settle (near-)immediately,
        // but we still poll to guard against any small async work.
        await expect(async () => {
          const openSettled = await waitForTransitionsToSettle(page, '[role="dialog"]');
          expect(openSettled, `[${vp.name}] open should settle ("${title}")`).toBe(true);
          expect(
            await focusInsideDialog(page),
            `[${vp.name}] focus should be inside dialog ("${title}")`,
          ).toBe(true);
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });

        const closeBtn = dialog.getByRole("button", { name: /close/i }).first();
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();

        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 3_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
          const after = await readFocus(page);
          expect(
            after,
            `[${vp.name}] focus should restore on close ("${title}")`,
          ).not.toBeNull();
          expect(after?.cardTitle).toBe(title);
          expect(after?.tag).toBe("button");
          expect(after?.text).toMatch(/book/i);
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });
      }
    });
  }
});
