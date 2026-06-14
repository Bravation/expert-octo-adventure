import { test, expect, type Page } from "@playwright/test";

/**
 * Playwright test:
 * While the booking dialog is open, click on the modal overlay while
 * simultaneously pressing Escape repeatedly. Verify the dialog closes,
 * no errors occur, and focus is restored to the originating Services
 * control. Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000ddd";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Overlay Escape Spam Provider",
  avatar_url: null,
  city: "Boston",
  state: "MA",
  average_rating: 4.5,
  total_reviews: 11,
  total_services_completed: 16,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "ffffffff-6666-7777-8888-ffffffffffff",
    title: "Overlay Escape Spam Plumbing",
    description: "Plumbing for overlay+escape spam test.",
    price: 155,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "aaaaaaaa-7777-8888-9999-aaaaaaaaaaaa",
    title: "Overlay Escape Spam Lawn Care",
    description: "Lawn for overlay+escape spam test.",
    price: 85,
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

test.describe("Booking dialog — overlay click + Escape spam closes and restores focus", () => {
  test.describe.configure({ retries: 2 });

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
    test(`Overlay click + Escape spam closes dialog and restores focus (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      for (const title of ["Overlay Escape Spam Plumbing", "Overlay Escape Spam Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await expect(bookBtn).toBeVisible();

        // Establish focus on the originating control before opening the dialog.
        await bookBtn.focus();
        const before = await readFocus(page);
        expect(before?.cardTitle).toBe(title);
        expect(before?.tag).toBe("button");
        expect(before?.text).toMatch(/book/i);

        // Open the dialog.
        await bookBtn.click();
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Click overlay while spamming Escape concurrently.
        const overlay = page
          .locator('[data-radix-dialog-overlay], [data-state="open"][class*="fixed"][class*="inset-0"]')
          .first();

        const overlayClick = (async () => {
          if ((await overlay.count()) > 0) {
            await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
          } else {
            await page.mouse.click(2, 2);
          }
        })();

        const escapeSpam = (async () => {
          for (let i = 0; i < 8; i++) {
            await page.keyboard.press("Escape");
          }
        })();

        await Promise.all([overlayClick, escapeSpam]);

        // Poll until the dialog is gone and focus has been restored.
        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 3_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
          const after = await readFocus(page);
          expect(
            after,
            `[${vp.name}] focus should restore after overlay click + Escape spam ("${title}")`,
          ).not.toBeNull();
          expect(after?.cardTitle).toBe(title);
          expect(after?.tag).toBe("button");
          expect(after?.text).toMatch(/book/i);
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });

        expect(
          errors,
          `[${vp.name}] no page or console errors during overlay click + Escape spam ("${title}")`,
        ).toEqual([]);
      }
    });
  }
});
