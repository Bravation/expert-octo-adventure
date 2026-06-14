import { test, expect, type Page } from "@playwright/test";

/**
 * Playwright test:
 * Verify that the booking dialog's focus trap loops correctly between
 * its first and last focusable elements when pressing Tab and Shift+Tab
 * repeatedly. Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000998";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Tab Loop First/Last Provider",
  avatar_url: null,
  city: "Miami",
  state: "FL",
  average_rating: 4.5,
  total_reviews: 11,
  total_services_completed: 16,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa",
    title: "Tab Loop First Last Plumbing",
    description: "Plumbing for tab-loop first/last test.",
    price: 145,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb",
    title: "Tab Loop First Last Lawn Care",
    description: "Lawn for tab-loop first/last test.",
    price: 75,
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

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
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

type FocusableSnapshot = {
  index: number;
  count: number;
  tag: string;
  text: string;
  isFirst: boolean;
  isLast: boolean;
};

async function readDialogFocus(page: Page, selector: string): Promise<FocusableSnapshot | null> {
  return page.evaluate((sel) => {
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    if (!dialog) return null;
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(sel)).filter(
      (el) =>
        !el.hasAttribute("disabled") &&
        el.offsetParent !== null &&
        el.getAttribute("aria-hidden") !== "true",
    );
    const el = document.activeElement as HTMLElement | null;
    if (!el || !dialog.contains(el)) return null;
    const index = focusables.indexOf(el);
    return {
      index,
      count: focusables.length,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim().slice(0, 80),
      isFirst: index === 0,
      isLast: index === focusables.length - 1,
    };
  }, selector);
}

test.describe("Booking dialog: Tab/Shift+Tab loops between first and last focusable", () => {
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
    test(`Tab/Shift+Tab loops first<->last (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of [
        "Tab Loop First Last Plumbing",
        "Tab Loop First Last Lawn Care",
      ]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

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

        // Walk forward to last focusable.
        let snapshot = await readDialogFocus(page, FOCUSABLE_SELECTOR);
        expect(snapshot, `[${vp.name}] focus should be inside dialog after open`).not.toBeNull();
        expect(snapshot!.count).toBeGreaterThan(0);

        for (let i = 0; i < snapshot!.count + 4; i++) {
          const cur = await readDialogFocus(page, FOCUSABLE_SELECTOR);
          if (cur?.isLast) break;
          await page.keyboard.press("Tab");
        }
        let last = await readDialogFocus(page, FOCUSABLE_SELECTOR);
        expect(
          last?.isLast,
          `[${vp.name}] should reach last focusable in dialog ("${title}")`,
        ).toBe(true);

        // Tab from last should loop to first.
        await page.keyboard.press("Tab");
        let looped = await readDialogFocus(page, FOCUSABLE_SELECTOR);
        expect(
          looped?.isFirst,
          `[${vp.name}] Tab from last should loop to first ("${title}")`,
        ).toBe(true);

        // Repeat Tab through cycle and confirm first appears again.
        for (let i = 0; i < (looped?.count ?? 1); i++) {
          await page.keyboard.press("Tab");
        }
        const afterFullCycle = await readDialogFocus(page, FOCUSABLE_SELECTOR);
        expect(
          afterFullCycle?.isFirst,
          `[${vp.name}] full Tab cycle should land on first again ("${title}")`,
        ).toBe(true);

        // Shift+Tab from first should loop to last.
        await page.keyboard.press("Shift+Tab");
        const backLooped = await readDialogFocus(page, FOCUSABLE_SELECTOR);
        expect(
          backLooped?.isLast,
          `[${vp.name}] Shift+Tab from first should loop to last ("${title}")`,
        ).toBe(true);

        // Repeat Shift+Tab through cycle and confirm last appears again.
        for (let i = 0; i < (backLooped?.count ?? 1); i++) {
          await page.keyboard.press("Shift+Tab");
        }
        const afterFullReverseCycle = await readDialogFocus(page, FOCUSABLE_SELECTOR);
        expect(
          afterFullReverseCycle?.isLast,
          `[${vp.name}] full Shift+Tab cycle should land on last again ("${title}")`,
        ).toBe(true);

        await page.keyboard.press("Escape");
        await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5_000 });
      }
    });
  }
});