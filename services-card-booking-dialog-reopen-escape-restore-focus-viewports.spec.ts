import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that after closing the booking dialog with Escape and REOPENING
 * it from the same originating Services control, a second Escape still
 * restores focus to that same control. Runs under normal motion across
 * mobile, tablet, and desktop.
 *
 * Flow per service per viewport:
 *   1. Tab to the Book Now button in the target card (originating control).
 *   2. Enter → dialog opens → short Tab/Shift+Tab burst → Escape.
 *      → assert focus restored to the originating Book Now button.
 *   3. Enter again on the (still-focused) originating Book Now button →
 *      dialog opens → another burst → Escape.
 *      → assert focus restored to the SAME originating Book Now button.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000a4";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "NM Reopen Escape Provider",
  avatar_url: null,
  city: "Charlotte",
  state: "NC",
  average_rating: 4.4,
  total_reviews: 11,
  total_services_completed: 16,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "cccccccc-3333-4444-5555-cccccccccccc",
    title: "NM Reopen Plumbing",
    description: "Plumbing for normal-motion reopen-escape test.",
    price: 168,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dddddddd-4444-5555-6666-dddddddddddd",
    title: "NM Reopen Lawn Care",
    description: "Lawn for normal-motion reopen-escape test.",
    price: 91,
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

const BURST = 50;

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

async function settleDialogAnimations(page: Page) {
  await page.evaluate(async () => {
    const root = document.querySelector('[role="dialog"]');
    if (!root) return;
    const anims = (root as Element).getAnimations({ subtree: true });
    await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
  });
}

async function shortBurst(page: Page) {
  const fwd: Promise<void>[] = [];
  for (let i = 0; i < BURST; i++) fwd.push(page.keyboard.press("Tab"));
  await Promise.all(fwd);
  const back: Promise<void>[] = [];
  for (let i = 0; i < BURST; i++) back.push(page.keyboard.press("Shift+Tab"));
  await Promise.all(back);
}

test.describe("Booking dialog — reopen after Escape still restores focus (normal motion)", () => {
  test.use({ reducedMotion: "no-preference" });
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced, "prefers-reduced-motion should NOT be reduce").toBe(false);

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
    test(`Escape → reopen → Escape restores focus to same control (${vp.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["NM Reopen Plumbing", "NM Reopen Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        // Tab to Book Now in this card — originating control.
        const reached = await tabUntilInCard(
          page,
          title,
          (info) => info.tag === "button" && /book/i.test(info.name),
        );
        expect(reached, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

        const origin = await readFocus(page);
        expect(origin?.cardTitle).toBe(title);
        expect(origin?.tag).toBe("button");
        expect(origin?.text).toMatch(/book/i);

        const dialog = page.locator('[role="dialog"]').first();

        const openBurstCloseAndAssertRestore = async (passLabel: string) => {
          await page.keyboard.press("Enter");
          await expect(dialog).toBeVisible({ timeout: 10_000 });
          await expect(dialog).toHaveAttribute("data-state", "open", { timeout: 10_000 });
          await expect
            .poll(() => focusInsideDialog(page), {
              timeout: 5_000,
              intervals: [50, 100, 250],
            })
            .toBe(true);
          await settleDialogAnimations(page);

          await shortBurst(page);

          expect(
            await focusInsideDialog(page),
            `[${vp.name}] ${passLabel}: focus should still be inside dialog after burst ("${title}")`,
          ).toBe(true);

          await page.keyboard.press("Escape");

          await expect(async () => {
            await expect(dialog).toBeHidden({ timeout: 3_000 });
            await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
            const after = await readFocus(page);
            expect(
              after,
              `[${vp.name}] ${passLabel}: focus should restore ("${title}")`,
            ).not.toBeNull();
            expect(after?.cardTitle).toBe(origin?.cardTitle);
            expect(after?.tag).toBe(origin?.tag);
            expect(after?.text).toBe(origin?.text);
          }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });
        };

        // First open/close cycle.
        await openBurstCloseAndAssertRestore("first close");

        // Sanity: focus should already be on the originating control;
        // pressing Enter on it should reopen the SAME dialog.
        const between = await readFocus(page);
        expect(between?.cardTitle).toBe(origin?.cardTitle);
        expect(between?.text).toBe(origin?.text);

        // Second open/close cycle from the same originating control.
        await openBurstCloseAndAssertRestore("second close");
      }
    });
  }
});
