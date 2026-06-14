import { test, expect } from "@playwright/test";

/**
 * Verifies that on every supported viewport (mobile/tablet/desktop), pressing
 * Escape inside a booking dialog closes it and focus returns to the "Book Now"
 * button that triggered it — when the card images load successfully (no fallback).
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000dd";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "No Fallback Provider",
  avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
  city: "Seattle",
  state: "WA",
  average_rating: 4.9,
  total_reviews: 42,
  total_services_completed: 78,
  latitude: null,
  longitude: null,
};

const VALID_PHOTO =
  "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80";

const FAKE_SERVICES = [
  {
    id: "77777777-7777-7777-7777-777777777777",
    title: "No Fallback Yoga",
    description: "Yoga service with valid image.",
    price: 60,
    category: "Health & Wellness",
    provider_id: PROVIDER_ID,
    photo_url: VALID_PHOTO,
    photo_urls: [VALID_PHOTO],
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "88888888-8888-8888-8888-888888888888",
    title: "No Fallback Massage",
    description: "Massage service with valid image.",
    price: 85,
    category: "Health & Wellness",
    provider_id: PROVIDER_ID,
    photo_url: VALID_PHOTO,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "99999999-9999-9999-9999-999999999999",
    title: "No Fallback PT",
    description: "Personal training with valid image.",
    price: 120,
    category: "Health & Wellness",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: [VALID_PHOTO, VALID_PHOTO],
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

async function tabUntilInCard(
  page: import("@playwright/test").Page,
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

test.describe("Services page — Escape closes booking dialog and returns focus (no fallback images)", () => {
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
    // Let real image requests pass through so images load successfully.
  });

  for (const vp of VIEWPORTS) {
    test(`Escape closes dialog and returns focus to Book Now for each card (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const title of ["No Fallback Yoga", "No Fallback Massage", "No Fallback PT"]) {
        await page.goto("/services");
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        // Tab to the Book Now button inside the target card
        const found = await tabUntilInCard(page, title, (info) => {
          return info.tag === "button" && /book/i.test(info.name);
        });
        expect(found, `[${vp.name}] should Tab to Book Now in "${title}"`).toBe(true);

        // Record focused element before opening dialog
        const focusedBefore = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el ? { tag: el.tagName.toLowerCase(), text: (el.textContent || "").trim() } : null;
        });
        expect(focusedBefore?.tag).toBe("button");
        expect(focusedBefore?.text).toMatch(/book/i);

        // Open the dialog
        await page.keyboard.press("Enter");
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog, `[${vp.name}] booking dialog should open for "${title}"`).toBeVisible({
          timeout: 10_000,
        });

        // Press Escape to close the dialog
        await page.keyboard.press("Escape");
        await expect(dialog, `[${vp.name}] booking dialog should close for "${title}"`).not.toBeVisible({
          timeout: 10_000,
        });

        // Verify focus returned to the Book Now button in the same card
        const focusedAfter = await page.evaluate((expectedTitle) => {
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

        expect(focusedAfter, `[${vp.name}] focus should return to an element after Escape`).not.toBeNull();
        expect(focusedAfter?.inCard, `[${vp.name}] focus should return to the same "${title}" card`).toBe(true);
        expect(focusedAfter?.tag, `[${vp.name}] focus should return to a button`).toBe("button");
        expect(focusedAfter?.text, `[${vp.name}] focus should return to Book Now button`).toMatch(/book/i);
      }
    });
  }
});
