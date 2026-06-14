import { test, expect, type Page } from "@playwright/test";

/**
 * Playwright test:
 * While the booking dialog is open, cycle Tab navigation inside the dialog
 * while Escape spam and overlay clicks happen concurrently. Assert that
 * focus stays within the dialog throughout the Tab cycle (until the dialog
 * actually closes), and once it closes, focus returns to the originating
 * Services control. Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000997";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Tab Cycle Overlay+Escape Provider",
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
    title: "Tab Cycle Overlay Escape Plumbing",
    description: "Plumbing for tab-cycle overlay+escape test.",
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
    title: "Tab Cycle Overlay Escape Lawn Care",
    description: "Lawn for tab-cycle overlay+escape test.",
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

const TAB_CYCLES = 30;
const ESCAPE_SPAM = 10;

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

async function dialogOpen(page: Page): Promise<boolean> {
  return (await page.locator('[role="dialog"]').count()) > 0;
}

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(el);
  });
}

test.describe("Booking dialog: Tab cycle stays trapped during concurrent Escape spam + overlay click", () => {
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
    test(`Tab cycle stays trapped during Escape spam + overlay click (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      for (const title of [
        "Tab Cycle Overlay Escape Plumbing",
        "Tab Cycle Overlay Escape Lawn Care",
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

        const origin = await readFocus(page);
        expect(origin?.tag).toBe("button");
        expect(origin?.text).toMatch(/book/i);
        expect(origin?.cardTitle).toBe(title);

        await page.keyboard.press("Enter");
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });

        const overlay = page
          .locator(
            '[data-radix-dialog-overlay], [data-state="open"][class*="fixed"][class*="inset-0"]',
          )
          .first();

        // Tab cycle concurrently with Escape spam and overlay click.
        // While the dialog remains open, focus MUST stay inside it.
        const tabCycle = (async () => {
          for (let i = 0; i < TAB_CYCLES; i++) {
            const stillOpen = await dialogOpen(page);
            if (!stillOpen) break;
            await page.keyboard.press(i % 2 === 0 ? "Tab" : "Shift+Tab");
            const stillOpenAfter = await dialogOpen(page);
            if (stillOpenAfter) {
              expect(
                await focusInsideDialog(page),
                `[${vp.name}] focus escaped dialog during Tab cycle at step ${i + 1} ("${title}")`,
              ).toBe(true);
            }
          }
        })();

        const escapeSpam = (async () => {
          for (let i = 0; i < ESCAPE_SPAM; i++) {
            await page.keyboard.press("Escape");
          }
        })();

        const overlayClick = (async () => {
          if ((await overlay.count()) > 0) {
            await overlay
              .click({ position: { x: 5, y: 5 }, force: true })
              .catch(() => {});
          } else {
            await page.mouse.click(2, 2);
          }
        })();

        await Promise.all([tabCycle, escapeSpam, overlayClick]);

        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 3_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });

        const after = await readFocus(page);
        expect(
          after,
          `[${vp.name}] focus should restore after concurrent Tab cycle + Escape + overlay ("${title}")`,
        ).not.toBeNull();
        expect(after?.cardTitle).toBe(title);
        expect(after?.tag).toBe(origin?.tag);
        expect(after?.text).toBe(origin?.text);

        expect(
          errors,
          `[${vp.name}] no page or console errors during concurrent Tab cycle + Escape + overlay ("${title}")`,
        ).toEqual([]);
      }
    });
  }
});