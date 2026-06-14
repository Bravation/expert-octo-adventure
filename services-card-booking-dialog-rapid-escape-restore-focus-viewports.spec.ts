import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that under `prefers-reduced-motion: no-preference`, after a
 * high-volume Tab/Shift+Tab burst inside the booking dialog, pressing
 * Escape:
 *   1. Closes the dialog (hidden + unmounted).
 *   2. Restores keyboard focus to the previously focused Services control
 *      (the Book Now button that opened the dialog).
 *
 * Two open paths are exercised per viewport:
 *   A) Tab to Book Now → Enter → burst → Escape.
 *   B) Tab to provider link → ArrowRight to Book Now → Enter → burst → Escape.
 *
 * Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000a3";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "NM Rapid Escape Provider",
  avatar_url: null,
  city: "Dallas",
  state: "TX",
  average_rating: 4.5,
  total_reviews: 13,
  total_services_completed: 18,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "aaaaaaaa-1111-2222-3333-aaaaaaaaaaaa",
    title: "NM Rapid Escape Plumbing",
    description: "Plumbing for normal-motion rapid-escape test.",
    price: 165,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bbbbbbbb-2222-3333-4444-bbbbbbbbbbbb",
    title: "NM Rapid Escape Lawn Care",
    description: "Lawn for normal-motion rapid-escape test.",
    price: 89,
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

const PRESS_COUNT = 200;

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

async function rapidBurst(page: Page) {
  const forward: Promise<void>[] = [];
  for (let i = 0; i < PRESS_COUNT; i++) forward.push(page.keyboard.press("Tab"));
  await Promise.all(forward);
  const backward: Promise<void>[] = [];
  for (let i = 0; i < PRESS_COUNT; i++) backward.push(page.keyboard.press("Shift+Tab"));
  await Promise.all(backward);
}

test.describe("Booking dialog — Escape after rapid burst restores focus (normal motion)", () => {
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
    test(`Path A — Tab to Book Now → burst → Escape restores focus (${vp.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["NM Rapid Escape Plumbing", "NM Rapid Escape Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const reached = await tabUntilInCard(
          page,
          title,
          (info) => info.tag === "button" && /book/i.test(info.name),
        );
        expect(reached, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

        const before = await readFocus(page);
        expect(before?.cardTitle).toBe(title);
        expect(before?.tag).toBe("button");
        expect(before?.text).toMatch(/book/i);

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

        await rapidBurst(page);

        // Sanity: still inside dialog after burst.
        expect(
          await focusInsideDialog(page),
          `[${vp.name}] focus should still be inside dialog after burst (path A, "${title}")`,
        ).toBe(true);

        await page.keyboard.press("Escape");

        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 3_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
          const after = await readFocus(page);
          expect(
            after,
            `[${vp.name}] focus should restore after Escape (path A, "${title}")`,
          ).not.toBeNull();
          expect(after?.cardTitle).toBe(title);
          expect(after?.tag).toBe(before?.tag);
          expect(after?.text).toBe(before?.text);
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });
      }
    });

    test(`Path B — provider link → ArrowRight → burst → Escape restores focus (${vp.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["NM Rapid Escape Plumbing", "NM Rapid Escape Lawn Care"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const reachedLink = await tabUntilInCard(
          page,
          title,
          (info) => info.tag === "a" && (info.href ?? "").startsWith(`/provider/${PROVIDER_ID}`),
        );
        expect(reachedLink, `[${vp.name}] should Tab to provider link in "${title}"`).toBe(true);

        await page.keyboard.press("ArrowRight");
        const before = await readFocus(page);
        expect(before?.cardTitle).toBe(title);
        expect(before?.tag).toBe("button");
        expect(before?.text).toMatch(/book/i);

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

        await rapidBurst(page);

        expect(
          await focusInsideDialog(page),
          `[${vp.name}] focus should still be inside dialog after burst (path B, "${title}")`,
        ).toBe(true);

        await page.keyboard.press("Escape");

        await expect(async () => {
          await expect(dialog).toBeHidden({ timeout: 3_000 });
          await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3_000 });
          const after = await readFocus(page);
          expect(
            after,
            `[${vp.name}] focus should restore after Escape (path B, "${title}")`,
          ).not.toBeNull();
          expect(after?.cardTitle).toBe(title);
          expect(after?.tag).toBe("button");
          expect(after?.text).toMatch(/book/i);
        }).toPass({ intervals: [50, 100, 250, 500], timeout: 10_000 });
      }
    });
  }
});
