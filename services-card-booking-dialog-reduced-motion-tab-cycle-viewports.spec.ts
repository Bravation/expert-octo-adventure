import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that, under `prefers-reduced-motion: reduce`, repeatedly pressing
 * Tab from the first focusable element in the booking dialog cycles through
 * every focusable inside the dialog and wraps back to the first — never
 * escaping. The same is verified in reverse with Shift+Tab from the first
 * focusable (which should immediately wrap to the last). Runs across
 * mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000ddd";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "RM Tab Cycle Provider",
  avatar_url: null,
  city: "Nashville",
  state: "TN",
  average_rating: 4.5,
  total_reviews: 10,
  total_services_completed: 14,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "ffffffff-6666-7777-8888-ffffffffffff",
    title: "RM Cycle Plumbing",
    description: "Plumbing for RM tab-cycle test.",
    price: 138,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "11111111-7777-8888-9999-111111111111",
    title: "RM Cycle Lawn Care",
    description: "Lawn for RM tab-cycle test.",
    price: 79,
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

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

/**
 * Returns a stable signature for the currently focused element so we can
 * compare focus identity across Tab presses without relying on text alone.
 */
async function focusedSignature(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog || !dialog.contains(el)) return null;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled]):not([type=hidden])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    ).filter((e) => e.offsetParent !== null || e === el);
    const idx = focusables.indexOf(el);
    const tag = el.tagName.toLowerCase();
    const type = (el as HTMLInputElement).type ?? "";
    const label = el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 40);
    return `${idx}|${tag}|${type}|${label}`;
  });
}

/**
 * Returns ordered signatures for all visible focusable elements inside the
 * dialog, matching the same selector + filtering used by focusedSignature.
 */
async function dialogFocusableSignatures(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled]):not([type=hidden])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    ).filter((e) => e.offsetParent !== null);
    return focusables.map((el, idx) => {
      const tag = el.tagName.toLowerCase();
      const type = (el as HTMLInputElement).type ?? "";
      const label = el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 40);
      return `${idx}|${tag}|${type}|${label}`;
    });
  });
}

test.describe("Booking dialog — Tab/Shift+Tab cycle through all focusables under reduced motion", () => {
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
    test(`Tab forward and Shift+Tab backward cycle through all focusables (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["RM Cycle Plumbing", "RM Cycle Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

        const card = cardLocator(page, title);
        const bookBtn = card.getByRole("button", { name: /book/i }).first();
        await bookBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Wait for Radix to seed focus inside the dialog.
        await expect
          .poll(() => focusInsideDialog(page), {
            timeout: 5_000,
            intervals: [50, 100, 250],
          })
          .toBe(true);

        // Snapshot the ordered focusable signatures inside the dialog.
        const signatures = await dialogFocusableSignatures(page);
        expect(
          signatures.length,
          `[${vp.name}] dialog should contain at least 2 focusables ("${title}")`,
        ).toBeGreaterThanOrEqual(2);

        // Walk Tab until focus lands on the first focusable (idx 0).
        let walked = 0;
        while (walked < signatures.length + 2) {
          const sig = await focusedSignature(page);
          if (sig && sig.startsWith("0|")) break;
          await page.keyboard.press("Tab");
          walked++;
        }
        const startSig = await focusedSignature(page);
        expect(
          startSig?.startsWith("0|"),
          `[${vp.name}] should land on first focusable to start ("${title}")`,
        ).toBe(true);

        // Forward cycle: press Tab N times where N = signatures.length, and
        // verify each press lands on the next focusable in order, wrapping
        // back to index 0. Repeat for 2 full cycles.
        const visitedForward: string[] = [startSig!];
        for (let cycle = 0; cycle < 2; cycle++) {
          for (let step = 1; step <= signatures.length; step++) {
            await page.keyboard.press("Tab");
            const inside = await focusInsideDialog(page);
            expect(
              inside,
              `[${vp.name}] forward Tab cycle ${cycle} step ${step} escaped ("${title}")`,
            ).toBe(true);
            const sig = await focusedSignature(page);
            const expectedIdx = step % signatures.length;
            expect(
              sig?.startsWith(`${expectedIdx}|`),
              `[${vp.name}] forward Tab expected idx ${expectedIdx} got ${sig} ("${title}")`,
            ).toBe(true);
            visitedForward.push(sig!);
          }
        }
        // We should have visited every index at least once.
        const forwardIndices = new Set(
          visitedForward.map((s) => s.split("|", 1)[0]),
        );
        for (let i = 0; i < signatures.length; i++) {
          expect(
            forwardIndices.has(String(i)),
            `[${vp.name}] forward cycle missed idx ${i} ("${title}")`,
          ).toBe(true);
        }

        // Re-anchor on the first focusable for the backward pass.
        let reAnchor = 0;
        while (reAnchor < signatures.length + 2) {
          const sig = await focusedSignature(page);
          if (sig && sig.startsWith("0|")) break;
          await page.keyboard.press("Tab");
          reAnchor++;
        }
        expect(
          (await focusedSignature(page))?.startsWith("0|"),
          `[${vp.name}] re-anchor on first focusable failed ("${title}")`,
        ).toBe(true);

        // Backward cycle: Shift+Tab from idx 0 should wrap to last (N-1),
        // then N-2, …, 0 again. Repeat for 2 full cycles.
        const visitedBackward: string[] = [];
        for (let cycle = 0; cycle < 2; cycle++) {
          for (let step = 1; step <= signatures.length; step++) {
            await page.keyboard.press("Shift+Tab");
            const inside = await focusInsideDialog(page);
            expect(
              inside,
              `[${vp.name}] Shift+Tab cycle ${cycle} step ${step} escaped ("${title}")`,
            ).toBe(true);
            const sig = await focusedSignature(page);
            const expectedIdx =
              (signatures.length - (step % signatures.length)) % signatures.length;
            expect(
              sig?.startsWith(`${expectedIdx}|`),
              `[${vp.name}] Shift+Tab expected idx ${expectedIdx} got ${sig} ("${title}")`,
            ).toBe(true);
            visitedBackward.push(sig!);
          }
        }
        const backwardIndices = new Set(
          visitedBackward.map((s) => s.split("|", 1)[0]),
        );
        for (let i = 0; i < signatures.length; i++) {
          expect(
            backwardIndices.has(String(i)),
            `[${vp.name}] backward cycle missed idx ${i} ("${title}")`,
          ).toBe(true);
        }

        // Cleanly close before the next iteration.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }
    });
  }
});
