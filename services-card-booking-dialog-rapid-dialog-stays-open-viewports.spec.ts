import { test, expect, type Page } from "@playwright/test";

/**
 * Mirror of the reduced-motion "stays-open" rapid-burst spec, but with
 * `prefers-reduced-motion` explicitly set to "no-preference" so normal CSS
 * transitions/animations are active. Verifies that during a high-volume
 * Tab/Shift+Tab burst the booking dialog:
 *   1. Stays mounted, visible, and `data-state="open"` at every checkpoint.
 *   2. Keeps `document.activeElement` inside the dialog at every checkpoint.
 *
 * Burst: 10 chunks of 25 Tab presses, then 10 chunks of 25 Shift+Tab,
 * checkpoint between every chunk. Runs across mobile, tablet, and desktop.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000a1";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Normal Motion StaysOpen Provider",
  avatar_url: null,
  city: "Sacramento",
  state: "CA",
  average_rating: 4.5,
  total_reviews: 12,
  total_services_completed: 17,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "66666666-cccc-dddd-eeee-666666666666",
    title: "NM StaysOpen Plumbing",
    description: "Plumbing for normal-motion stays-open test.",
    price: 152,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "77777777-dddd-eeee-ffff-777777777777",
    title: "NM StaysOpen Lawn Care",
    description: "Lawn for normal-motion stays-open test.",
    price: 86,
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

const CHUNK_SIZE = 25;
const CHUNKS = 10;

function cardLocator(page: Page, title: string) {
  return page
    .locator('[class*="overflow-hidden"]')
    .filter({ has: page.locator("h3", { hasText: title }) })
    .first();
}

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

async function dialogSnapshot(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { present: false, visible: false, state: null as string | null };
    const style = window.getComputedStyle(dialog as HTMLElement);
    const visible =
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      (dialog as HTMLElement).offsetParent !== null;
    return {
      present: true,
      visible,
      state: dialog.getAttribute("data-state"),
    };
  });
}

test.describe("Booking dialog — stays open during rapid Tab/Shift+Tab burst (normal motion)", () => {
  test.use({ reducedMotion: "no-preference" });
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced, "prefers-reduced-motion should NOT be reduce in this spec").toBe(false);

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
    test(`dialog stays open across ${CHUNKS}×${CHUNK_SIZE} Tab + Shift+Tab chunks (normal motion, ${vp.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["NM StaysOpen Plumbing", "NM StaysOpen Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Wait for Radix to seed focus inside the dialog AND for the open
        // animation to settle (normal motion has real transitions here).
        await expect
          .poll(() => focusInsideDialog(page), {
            timeout: 5_000,
            intervals: [50, 100, 250],
          })
          .toBe(true);
        await page.evaluate(async () => {
          const root = document.querySelector('[role="dialog"]');
          if (!root) return;
          const anims = (root as Element).getAnimations({ subtree: true });
          await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
        });

        const checkpoint = async (label: string) => {
          const snap = await dialogSnapshot(page);
          expect(
            snap.present,
            `[${vp.name}] dialog unmounted at ${label} ("${title}")`,
          ).toBe(true);
          expect(
            snap.visible,
            `[${vp.name}] dialog became invisible at ${label} ("${title}")`,
          ).toBe(true);
          expect(
            snap.state,
            `[${vp.name}] dialog data-state changed at ${label} ("${title}")`,
          ).toBe("open");
          const focusInfo = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            const dialog = document.querySelector('[role="dialog"]');
            const inside = !!el && !!dialog && el !== document.body && dialog.contains(el);
            return {
              inside,
              tag: el?.tagName.toLowerCase() ?? "body",
              ariaLabel: el?.getAttribute("aria-label") ?? null,
              text: (el?.textContent || "").trim().slice(0, 60),
            };
          });
          expect(
            focusInfo.inside,
            `[${vp.name}] activeElement escaped dialog at ${label} ("${title}"); focus=${JSON.stringify(focusInfo)}`,
          ).toBe(true);
        };

        for (let c = 0; c < CHUNKS; c++) {
          const presses: Promise<void>[] = [];
          for (let i = 0; i < CHUNK_SIZE; i++) {
            presses.push(page.keyboard.press("Tab"));
          }
          await Promise.all(presses);
          await checkpoint(`forward chunk ${c + 1}/${CHUNKS}`);
        }

        for (let c = 0; c < CHUNKS; c++) {
          const presses: Promise<void>[] = [];
          for (let i = 0; i < CHUNK_SIZE; i++) {
            presses.push(page.keyboard.press("Shift+Tab"));
          }
          await Promise.all(presses);
          await checkpoint(`backward chunk ${c + 1}/${CHUNKS}`);
        }

        await checkpoint("post-burst");

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }
    });
  }
});
