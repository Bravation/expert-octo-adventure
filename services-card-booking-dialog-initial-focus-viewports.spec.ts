import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies Tab / Shift+Tab behavior in the booking dialog from each
 * possible initial focus target. Radix Dialog auto-focuses the first
 * focusable element on open, but we also explicitly seed focus to the
 * first input, the first button (close), and the primary action button
 * to ensure tabbing remains trapped inside the dialog from any starting
 * point. Runs across mobile, tablet, and desktop viewports.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-000000000333";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Initial Focus Provider",
  avatar_url: null,
  city: "Boise",
  state: "ID",
  average_rating: 4.5,
  total_reviews: 12,
  total_services_completed: 18,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb",
    title: "Initial Focus Plumbing",
    description: "Plumbing for initial-focus test.",
    price: 130,
    category: "Plumbing",
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

async function tabUntilBookNow(page: Page, title: string, maxTabs = 160): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate((expectedTitle) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const card = el.closest('[class*="overflow-hidden"]') as HTMLElement | null;
      const cardTitle = card?.querySelector("h3")?.textContent?.trim() ?? "";
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim(),
        inCard: cardTitle === expectedTitle,
      };
    }, title);
    if (info?.inCard && info.tag === "button" && /book/i.test(info.text)) {
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

async function describeFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type"),
      text: (el.textContent || "").trim().slice(0, 60),
      ariaLabel: el.getAttribute("aria-label"),
    };
  });
}

/**
 * Returns selectors for candidate "initial focus" targets inside the dialog,
 * in priority order. We resolve the first available match in each test.
 */
type FocusTarget = {
  label: string;
  // Returns true if the seeded focus succeeded.
  seed: (page: Page) => Promise<boolean>;
};

const FOCUS_TARGETS: FocusTarget[] = [
  {
    label: "Radix default (auto-focused on open)",
    seed: async () => true, // Don't change focus — use whatever Radix auto-focuses.
  },
  {
    label: "first input inside dialog",
    seed: async (page) => {
      const handle = page.locator('[role="dialog"] input').first();
      if ((await handle.count()) === 0) return false;
      await handle.focus();
      return true;
    },
  },
  {
    label: "first button inside dialog (typically Close)",
    seed: async (page) => {
      const handle = page.locator('[role="dialog"] button').first();
      if ((await handle.count()) === 0) return false;
      await handle.focus();
      return true;
    },
  },
  {
    label: "primary action button (Pay / Book)",
    seed: async (page) => {
      const handle = page.locator('[role="dialog"] button', { hasText: /pay|book/i }).first();
      if ((await handle.count()) === 0) return false;
      await handle.focus();
      return true;
    },
  },
  {
    label: "first textarea inside dialog",
    seed: async (page) => {
      const handle = page.locator('[role="dialog"] textarea').first();
      if ((await handle.count()) === 0) return false;
      await handle.focus();
      return true;
    },
  },
];

test.describe("Booking dialog — Tab/Shift+Tab from each initial focus target across viewports", () => {
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
    for (const target of FOCUS_TARGETS) {
      test(`Tab/Shift+Tab stays trapped — initial focus: ${target.label} (${vp.name})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const title = "Initial Focus Plumbing";

        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        // Open the dialog via keyboard.
        const reached = await tabUntilBookNow(page, title);
        expect(reached, `[${vp.name}] should Tab to Book Now`).toBe(true);
        await page.keyboard.press("Enter");

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        // Seed initial focus to the requested target. Skip the test if the
        // target doesn't exist in this dialog (e.g., no textarea rendered).
        const seeded = await target.seed(page);
        test.skip(!seeded, `Target "${target.label}" not present in dialog`);

        // Confirm focus starts inside the dialog before we begin tabbing.
        expect(
          await focusInsideDialog(page),
          `[${vp.name}] initial focus should be inside dialog (${target.label})`,
        ).toBe(true);

        // Forward Tab cycle stays within the dialog.
        const seenForward = new Set<string>();
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press("Tab");
          const inside = await focusInsideDialog(page);
          const focus = await describeFocus(page);
          expect(
            inside,
            `[${vp.name}/${target.label}] forward Tab #${i + 1} escaped dialog. Focus: ${JSON.stringify(focus)}`,
          ).toBe(true);
          if (focus) seenForward.add(`${focus.tag}:${focus.type ?? ""}:${focus.text}:${focus.ariaLabel ?? ""}`);
        }
        expect(
          seenForward.size,
          `[${vp.name}/${target.label}] forward Tab should cycle through multiple focusable elements`,
        ).toBeGreaterThanOrEqual(2);

        // Reverse Shift+Tab cycle stays within the dialog.
        const seenBackward = new Set<string>();
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press("Shift+Tab");
          const inside = await focusInsideDialog(page);
          const focus = await describeFocus(page);
          expect(
            inside,
            `[${vp.name}/${target.label}] Shift+Tab #${i + 1} escaped dialog. Focus: ${JSON.stringify(focus)}`,
          ).toBe(true);
          if (focus) seenBackward.add(`${focus.tag}:${focus.type ?? ""}:${focus.text}:${focus.ariaLabel ?? ""}`);
        }
        expect(
          seenBackward.size,
          `[${vp.name}/${target.label}] Shift+Tab should cycle through multiple focusable elements`,
        ).toBeGreaterThanOrEqual(2);

        // Close and ensure trap releases.
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });
      });
    }
  }
});
