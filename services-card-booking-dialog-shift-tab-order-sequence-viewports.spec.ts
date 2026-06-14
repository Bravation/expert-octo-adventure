import { test, expect, type Page } from "@playwright/test";

/**
 * Playwright test:
 * Verify the booking dialog's Shift+Tab order matches the reverse of the
 * expected visual tab sequence — pressing Shift+Tab visits each focusable
 * element in reverse DOM order, with element identity matching between
 * the live focused element and the precomputed focusable list.
 * Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000a01";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Shift Tab Order Sequence Provider",
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
    title: "Shift Tab Order Sequence Plumbing",
    description: "Plumbing for shift+tab order sequence test.",
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
    title: "Shift Tab Order Sequence Lawn Care",
    description: "Lawn for shift+tab order sequence test.",
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

const FOCUSABLE_MARK_ATTR = "data-shift-tab-order-id";

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

/**
 * Stamp every visible, enabled focusable in the dialog with a stable id
 * (DOM order). Returns the ordered list of ids — this represents the
 * "expected visual tab sequence" inside the dialog.
 */
async function stampDialogFocusables(page: Page, selector: string, attr: string): Promise<string[]> {
  return page.evaluate(
    ({ sel, a }) => {
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
      if (!dialog) return [];
      const all = Array.from(dialog.querySelectorAll<HTMLElement>(sel)).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.offsetParent !== null &&
          el.getAttribute("aria-hidden") !== "true",
      );
      const ids: string[] = [];
      all.forEach((el, i) => {
        const id = `f${i}`;
        el.setAttribute(a, id);
        ids.push(id);
      });
      return ids;
    },
    { sel: selector, a: attr },
  );
}

async function readFocusedId(page: Page, attr: string): Promise<string | null> {
  return page.evaluate((a) => {
    const dialog = document.querySelector('[role="dialog"]');
    const el = document.activeElement as HTMLElement | null;
    if (!el || !dialog || !dialog.contains(el)) return null;
    return el.getAttribute(a);
  }, attr);
}

test.describe("Booking dialog: Shift+Tab order matches reverse of expected sequence", () => {
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
    test(`Shift+Tab visits focusables in reverse DOM order (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of [
        "Shift Tab Order Sequence Plumbing",
        "Shift Tab Order Sequence Lawn Care",
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

        const expectedIds = await stampDialogFocusables(
          page,
          FOCUSABLE_SELECTOR,
          FOCUSABLE_MARK_ATTR,
        );
        expect(
          expectedIds.length,
          `[${vp.name}] dialog should contain at least one focusable ("${title}")`,
        ).toBeGreaterThan(0);

        const reversedIds = [...expectedIds].reverse();

        // Find the currently focused element's id; this is our starting index.
        let currentId = await readFocusedId(page, FOCUSABLE_MARK_ATTR);
        if (currentId === null) {
          await page.keyboard.press("Tab");
          currentId = await readFocusedId(page, FOCUSABLE_MARK_ATTR);
        }
        expect(
          currentId,
          `[${vp.name}] focus should be inside dialog after open ("${title}")`,
        ).not.toBeNull();

        const startIdx = reversedIds.indexOf(currentId!);
        expect(
          startIdx,
          `[${vp.name}] focused element should be in stamped list`,
        ).toBeGreaterThanOrEqual(0);

        // Walk one full cycle of Shift+Tab presses and assert identity at each step.
        const observed: string[] = [currentId!];
        for (let i = 0; i < reversedIds.length; i++) {
          await page.keyboard.press("Shift+Tab");
          const id = await readFocusedId(page, FOCUSABLE_MARK_ATTR);
          const expected = reversedIds[(startIdx + i + 1) % reversedIds.length];
          expect(
            id,
            `[${vp.name}] Shift+Tab #${i + 1} should focus expected element "${expected}" but got "${id}" ("${title}")`,
          ).toBe(expected);
          observed.push(id!);
        }

        // After a full reverse cycle, focus should return to the starting element.
        expect(
          observed[observed.length - 1],
          `[${vp.name}] full Shift+Tab cycle should return to start ("${title}")`,
        ).toBe(currentId);

        // Close dialog before next iteration.
        await page.keyboard.press("Escape");
        await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5_000 });
      }
    });
  }
});