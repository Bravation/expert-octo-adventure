import { test, expect, type Page } from "@playwright/test";

/**
 * Playwright test:
 * While the booking dialog is open, perform a Shift+Tab cycle and press
 * Escape mid-cycle. Verify the dialog closes and focus restores to the
 * exact originating "Book Now" trigger element across mobile, tablet,
 * and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000a02";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Shift+Tab Escape Restore Provider",
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
    title: "Shift Tab Escape Plumbing",
    description: "Plumbing for shift+tab escape restore test.",
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
    title: "Shift Tab Escape Lawn Care",
    description: "Lawn for shift+tab escape restore test.",
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

const SHIFT_TAB_BEFORE_ESCAPE = 7;

const TRIGGER_MARK_ATTR = "data-shift-tab-escape-trigger";

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

async function stampFocused(page: Page, attr: string, value: string): Promise<void> {
  await page.evaluate(
    ({ a, v }) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body) el.setAttribute(a, v);
    },
    { a: attr, v: value },
  );
}

async function focusedHasAttr(page: Page, attr: string, value: string): Promise<boolean> {
  return page.evaluate(
    ({ a, v }) => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && el !== document.body && el.getAttribute(a) === v;
    },
    { a: attr, v: value },
  );
}

test.describe("Booking dialog: Escape during Shift+Tab cycle restores focus to Book Now trigger", () => {
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
    test(`Escape during Shift+Tab cycle restores focus to exact Book Now trigger (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["Shift Tab Escape Plumbing", "Shift Tab Escape Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const reached = await tabUntilInCard(
          page,
          title,
          (info) => info.tag === "button" && /book/i.test(info.name),
        );
        expect(reached, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

        const origin = await readFocus(page);
        expect(origin?.tag).toBe("button");
        expect(origin?.text).toMatch(/book/i);
        expect(origin?.cardTitle).toBe(title);

        // Stamp the originating trigger so we can verify exact element identity
        // after restoration.
        const triggerToken = `trigger-${title.replace(/\s+/g, "-")}-${vp.name}`;
        await stampFocused(page, TRIGGER_MARK_ATTR, triggerToken);

        await page.keyboard.press("Enter");
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        // Shift+Tab cycle, then press Escape mid-cycle.
        for (let i = 0; i < SHIFT_TAB_BEFORE_ESCAPE; i++) {
          await page.keyboard.press("Shift+Tab");
          expect(
            await focusInsideDialog(page),
            `[${vp.name}] focus escaped dialog during Shift+Tab cycle at step ${i + 1} ("${title}")`,
          ).toBe(true);
        }

        await page.keyboard.press("Escape");

        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 3_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
          const after = await readFocus(page);
          expect(
            after,
            `[${vp.name}] focus should restore after Escape during Shift+Tab cycle ("${title}")`,
          ).not.toBeNull();
          expect(after?.cardTitle).toBe(title);
          expect(after?.tag).toBe(origin?.tag);
          expect(after?.text).toBe(origin?.text);
          expect(
            await focusedHasAttr(page, TRIGGER_MARK_ATTR, triggerToken),
            `[${vp.name}] focus should restore to the exact originating Book Now trigger ("${title}")`,
          ).toBe(true);
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });
      }
    });
  }
});