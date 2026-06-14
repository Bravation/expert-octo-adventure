import { test, expect } from "@playwright/test";

/**
 * Verifies that the fallback image rendering on Services cards does not
 * break keyboard focus order or create a focus trap. Images should never
 * receive focus themselves (they have no tabindex), and tabbing through
 * the page should reach interactive controls inside each card in DOM order.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000aa";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Focus Test Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.7,
  total_reviews: 9,
  total_services_completed: 14,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Focus Plumbing",
    description: "Plumbing service for focus test.",
    price: 100,
    category: "Plumbing",
    provider_id: PROVIDER_ID,
    photo_url: null,
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    title: "Focus Lawn Care",
    description: "Lawn service for focus test.",
    price: 80,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: "",
    photo_urls: [],
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    title: "Focus Dog Walking",
    description: "Dog walking for focus test.",
    price: 30,
    category: "Dog Walking",
    provider_id: PROVIDER_ID,
    photo_url: "https://broken.invalid.example/missing.jpg",
    photo_urls: null,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

test.describe("Services page — fallback image keyboard focus", () => {
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
    await page.route("https://broken.invalid.example/**", async (route) => {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    });
  });

  test("tabbing through cards reaches each card's interactive controls without trapping on images", async ({
    page,
  }) => {
    await page.goto("/services");
    await expect(page.getByText("Focus Plumbing").first()).toBeVisible({ timeout: 10_000 });

    // Sanity: no fallback image is itself focusable.
    const cardImages = page.locator("img.object-cover");
    const imgCount = await cardImages.count();
    expect(imgCount).toBeGreaterThanOrEqual(FAKE_SERVICES.length);
    for (let i = 0; i < imgCount; i++) {
      const tabindex = await cardImages.nth(i).getAttribute("tabindex");
      // Images must not opt themselves into the tab order.
      expect(tabindex === null || Number(tabindex) < 0).toBe(true);
    }

    // Focus the document body to start tabbing from a known point.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    // Track which titles we've reached via the focused element's nearest card.
    const reachedTitles = new Set<string>();
    const expectedTitles = new Set(FAKE_SERVICES.map((s) => s.title));

    // Bound tab presses so a focus trap can't loop forever.
    const MAX_TABS = 200;
    let tabs = 0;
    let lastFocusKey = "";
    let stuckCount = 0;

    while (tabs < MAX_TABS && reachedTitles.size < expectedTitles.size) {
      await page.keyboard.press("Tab");
      tabs++;

      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const tag = el.tagName.toLowerCase();
        // Find nearest ancestor card and pull its visible title text if any.
        const card = el.closest('[class*="overflow-hidden"]') as HTMLElement | null;
        const titleEl = card?.querySelector("h3");
        const title = titleEl?.textContent?.trim() ?? "";
        const id = el.id || "";
        const text = (el.textContent || "").trim().slice(0, 40);
        return { tag, title, id, text };
      });

      // Detect "stuck" focus (e.g. a trap) — same focus 5 Tab presses in a row.
      const focusKey = info ? `${info.tag}|${info.id}|${info.text}|${info.title}` : "null";
      if (focusKey === lastFocusKey) {
        stuckCount++;
        expect(
          stuckCount,
          `focus appears trapped on ${focusKey} after ${tabs} Tab presses`,
        ).toBeLessThan(5);
      } else {
        stuckCount = 0;
      }
      lastFocusKey = focusKey;

      // Focus must never land on a card image.
      if (info?.tag === "img") {
        throw new Error(`Tab focus landed on an <img> element (title: "${info.title}")`);
      }

      if (info?.title && expectedTitles.has(info.title)) {
        reachedTitles.add(info.title);
      }
    }

    // Every stubbed card must have been reachable by Tab.
    for (const t of expectedTitles) {
      expect(reachedTitles.has(t), `should reach card "${t}" via Tab`).toBe(true);
    }

    // And we must not have exhausted the bound — that would suggest a trap.
    expect(tabs).toBeLessThan(MAX_TABS);
  });
});
