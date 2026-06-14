import { test, expect, type Page } from "@playwright/test";

/**
 * Reduced-motion test: while the booking dialog is open, Tab and
 * Shift+Tab must never move focus to controls in the underlying
 * Services page. We tag every focusable element outside the dialog and
 * attach a capture-phase `focus` listener to count any unauthorized
 * activations during a long Tab/Shift+Tab sequence.
 *
 * Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000c4";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "RM NoUnderlyingTab Provider",
  avatar_url: null,
  city: "Charlotte",
  state: "NC",
  average_rating: 4.7,
  total_reviews: 19,
  total_services_completed: 24,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "11111111-aaaa-bbbb-cccc-111111111111",
    title: "RM NoUnderlyingTab Plumbing",
    description: "Plumbing for reduced-motion no-underlying-tab test.",
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
    id: "22222222-bbbb-cccc-dddd-222222222222",
    title: "RM NoUnderlyingTab Lawn Care",
    description: "Lawn for reduced-motion no-underlying-tab test.",
    price: 88,
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

const TOTAL_TABS = 200;
const TOTAL_SHIFT_TABS = 200;
const BATCH = 25;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

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

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

async function settleDialogAnimations(page: Page) {
  await page.evaluate(async () => {
    const root = document.querySelector('[role="dialog"]');
    if (!root) return;
    const anims = (root as Element).getAnimations({ subtree: true });
    await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
  });
}

/**
 * Tag every focusable element outside the dialog with a stable id and
 * attach a capture-phase focus listener that increments a per-id counter
 * on `window.__rmTabHits`. Returns the number of tagged elements.
 */
async function instrumentOutsideControls(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const w = window as unknown as {
      __rmTabHits?: Record<string, number>;
      __rmTabIds?: string[];
    };
    w.__rmTabHits = {};
    w.__rmTabIds = [];
    const dialog = document.querySelector('[role="dialog"]');
    const all = Array.from(document.querySelectorAll<HTMLElement>(sel));
    let nextId = 0;
    for (const el of all) {
      if (dialog && dialog.contains(el)) continue;
      const id = `rm-tab-${nextId++}`;
      el.dataset.rmTabId = id;
      w.__rmTabHits![id] = 0;
      w.__rmTabIds!.push(id);
      el.addEventListener(
        "focus",
        () => {
          w.__rmTabHits![id] = (w.__rmTabHits![id] ?? 0) + 1;
        },
        { capture: true },
      );
    }
    return w.__rmTabIds!.length;
  }, selector);
}

async function readHits(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const w = window as unknown as { __rmTabHits?: Record<string, number> };
    return { ...(w.__rmTabHits ?? {}) };
  });
}

async function totalHits(page: Page): Promise<number> {
  const hits = await readHits(page);
  return Object.values(hits).reduce((sum, n) => sum + n, 0);
}

test.describe(
  "Booking dialog — Tab/Shift+Tab cannot reach underlying Services controls (reduced motion)",
  () => {
    test.use({ reducedMotion: "reduce" });
    test.describe.configure({ retries: 2 });

    test.beforeEach(async ({ page }) => {
      const reduced = await page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      expect(reduced, "prefers-reduced-motion should be reduce").toBe(true);

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
      test(`Tab/Shift+Tab never reaches underlying controls (${vp.name})`, async ({ page }) => {
        test.slow();
        await page.setViewportSize({ width: vp.width, height: vp.height });

        for (const title of [
          "RM NoUnderlyingTab Plumbing",
          "RM NoUnderlyingTab Lawn Care",
        ]) {
          await page.goto("/services");
          await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
          await page.locator("body").click({ position: { x: 1, y: 1 } });

          // Tab to Book Now in this card and open the dialog.
          const reached = await tabUntilInCard(
            page,
            title,
            (info) => info.tag === "button" && /book/i.test(info.name),
          );
          expect(reached, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

          await page.keyboard.press("Enter");
          const dialog = page.locator('[role="dialog"]').first();
          await expect(dialog).toBeVisible({ timeout: 10_000 });
          await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });
          await expect
            .poll(() => focusInsideDialog(page), {
              timeout: 5_000,
              intervals: [50, 100, 250],
            })
            .toBe(true);
          await settleDialogAnimations(page);

          const tagged = await instrumentOutsideControls(page, FOCUSABLE_SELECTOR);
          expect(
            tagged,
            `[${vp.name}] should tag focusable controls outside dialog ("${title}")`,
          ).toBeGreaterThan(0);

          // Forward burst with periodic checkpoints.
          for (let sent = 0; sent < TOTAL_TABS; sent += BATCH) {
            const presses: Promise<void>[] = [];
            for (let i = 0; i < BATCH; i++) presses.push(page.keyboard.press("Tab"));
            await Promise.all(presses);

            await expect(dialog).toBeVisible();
            await expect(dialog).toHaveAttribute("data-state", "open");
            expect(
              await focusInsideDialog(page),
              `[${vp.name}] focus escaped during Tab burst @${sent + BATCH} ("${title}")`,
            ).toBe(true);
            expect(
              await totalHits(page),
              `[${vp.name}] underlying control focused during Tab burst @${sent + BATCH} ("${title}")`,
            ).toBe(0);
          }

          // Backward burst with periodic checkpoints.
          for (let sent = 0; sent < TOTAL_SHIFT_TABS; sent += BATCH) {
            const presses: Promise<void>[] = [];
            for (let i = 0; i < BATCH; i++) presses.push(page.keyboard.press("Shift+Tab"));
            await Promise.all(presses);

            await expect(dialog).toBeVisible();
            await expect(dialog).toHaveAttribute("data-state", "open");
            expect(
              await focusInsideDialog(page),
              `[${vp.name}] focus escaped during Shift+Tab burst @${sent + BATCH} ("${title}")`,
            ).toBe(true);
            expect(
              await totalHits(page),
              `[${vp.name}] underlying control focused during Shift+Tab burst @${sent + BATCH} ("${title}")`,
            ).toBe(0);
          }

          // Final assertion: zero hits across all tagged outside controls.
          const hits = await readHits(page);
          for (const [id, count] of Object.entries(hits)) {
            expect(
              count,
              `[${vp.name}] outside control ${id} received focus during sequence ("${title}")`,
            ).toBe(0);
          }
        }
      });
    }
  },
);