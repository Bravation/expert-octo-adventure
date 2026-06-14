import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that the booking dialog remains continuously open throughout a
 * high-volume rapid Tab/Shift+Tab sequence under
 * `prefers-reduced-motion: reduce`. Unlike the trap-only stress test, this
 * spec samples dialog presence/visibility at multiple checkpoints DURING
 * the burst (not just at the end), proving the dialog never momentarily
 * unmounts, hides, or flips data-state away from "open".
 *
 * Burst: 250 Tab + 250 Shift+Tab, broken into 10 chunks of 25 with a
 * checkpoint between each chunk. Runs across mobile, tablet, and desktop.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000fff";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "RM Stays Open Provider",
  avatar_url: null,
  city: "Portland",
  state: "ME",
  average_rating: 4.6,
  total_reviews: 15,
  total_services_completed: 21,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "44444444-aaaa-bbbb-cccc-444444444444",
    title: "RM StaysOpen Plumbing",
    description: "Plumbing for RM stays-open test.",
    price: 148,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "55555555-bbbb-cccc-dddd-555555555555",
    title: "RM StaysOpen Lawn Care",
    description: "Lawn for RM stays-open test.",
    price: 84,
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
const CHUNKS = 10; // total = CHUNK_SIZE * CHUNKS = 250 per direction

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

test.describe("Booking dialog — stays open during rapid Tab/Shift+Tab burst under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
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
    test(`dialog stays open across ${CHUNKS}×${CHUNK_SIZE} Tab + Shift+Tab chunks (${vp.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["RM StaysOpen Plumbing", "RM StaysOpen Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        await expect
          .poll(() => focusInsideDialog(page), {
            timeout: 5_000,
            intervals: [50, 100, 250],
          })
          .toBe(true);

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
          // Also assert document.activeElement is inside the dialog at every
          // checkpoint. If it ever escapes, capture a useful descriptor for
          // debugging.
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

        // FORWARD chunks: 10 × 25 rapid Tab presses, checkpoint between each.
        for (let c = 0; c < CHUNKS; c++) {
          const presses: Promise<void>[] = [];
          for (let i = 0; i < CHUNK_SIZE; i++) {
            presses.push(page.keyboard.press("Tab"));
          }
          await Promise.all(presses);
          await checkpoint(`forward chunk ${c + 1}/${CHUNKS}`);
        }

        // BACKWARD chunks: 10 × 25 rapid Shift+Tab presses, checkpoint each.
        for (let c = 0; c < CHUNKS; c++) {
          const presses: Promise<void>[] = [];
          for (let i = 0; i < CHUNK_SIZE; i++) {
            presses.push(page.keyboard.press("Shift+Tab"));
          }
          await Promise.all(presses);
          await checkpoint(`backward chunk ${c + 1}/${CHUNKS}`);
        }

        // Final checkpoint after the entire burst.
        await checkpoint("post-burst");
        expect(
          await focusInsideDialog(page),
          `[${vp.name}] focus should still be inside dialog after burst ("${title}")`,
        ).toBe(true);

        // Cleanly close.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }
    });
  }
});
