import { test, expect } from "@playwright/test";

/**
 * Verifies that Shift+Tab moves focus backward from each Services card's
 * "Book Now" button to that same card's provider link, across mobile,
 * tablet, and desktop viewports — even when cards render the category
 * fallback image (null/empty/broken photo_url).
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000cc";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "ShiftTab Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.7,
  total_reviews: 11,
  total_services_completed: 14,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    title: "ShiftTab Plumbing",
    description: "Plumbing for shift+tab test.",
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
    id: "55555555-5555-5555-5555-555555555555",
    title: "ShiftTab Lawn Care",
    description: "Lawn for shift+tab test.",
    price: 75,
    category: "Lawn Care",
    provider_id: PROVIDER_ID,
    photo_url: "",
    photo_urls: [],
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    title: "ShiftTab Dog Walking",
    description: "Dog walking for shift+tab test.",
    price: 25,
    category: "Dog Walking",
    provider_id: PROVIDER_ID,
    photo_url: "https://broken.invalid.example/missing.jpg",
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

type FocusInfo = {
  tag: string;
  role: "providerLink" | "bookButton" | "other";
  cardTitle: string;
  key: string;
};

async function readFocus(page: import("@playwright/test").Page, titles: string[]) {
  return page.evaluate((titles) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const tag = el.tagName.toLowerCase();
    const card = el.closest('[class*="overflow-hidden"]') as HTMLElement | null;
    const cardTitle = card?.querySelector("h3")?.textContent?.trim() ?? "";
    const text = (el.textContent || "").trim();
    const href = el.getAttribute("href") ?? "";

    let role: "providerLink" | "bookButton" | "other" = "other";
    if (tag === "a" && href.startsWith("/provider/")) role = "providerLink";
    else if (tag === "button" && /book/i.test(text)) role = "bookButton";

    return {
      tag,
      role,
      cardTitle,
      isStubbedCard: titles.includes(cardTitle),
      key: `${tag}|${role}|${cardTitle}|${text.slice(0, 30)}`,
    };
  }, titles);
}

test.describe("Services page — Shift+Tab returns focus from Book Now to provider link", () => {
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

  for (const vp of VIEWPORTS) {
    test(`Shift+Tab: Book Now → provider link per card (${vp.name} ${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/services");
      await expect(page.getByText("ShiftTab Plumbing").first()).toBeVisible({ timeout: 10_000 });

      const expectedTitles = FAKE_SERVICES.map((s) => s.title);

      // Reset focus.
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      // Phase 1: Tab forward and record where each card's Book Now button lands.
      const MAX_TABS = 400;
      const forwardTrail: FocusInfo[] = [];
      let lastKey = "";
      let stuck = 0;
      let imageFocused = false;

      const seenBookForCard = new Set<string>();

      for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press("Tab");
        const info = await readFocus(page, expectedTitles);
        if (!info) continue;

        if (info.key === lastKey) {
          stuck++;
          expect(stuck, `[${vp.name}] focus trapped on ${info.key}`).toBeLessThan(5);
        } else {
          stuck = 0;
        }
        lastKey = info.key;

        if (info.tag === "img") {
          imageFocused = true;
          break;
        }

        if (info.isStubbedCard) {
          forwardTrail.push(info);
          if (info.role === "bookButton") seenBookForCard.add(info.cardTitle);
        }

        if (expectedTitles.every((t) => seenBookForCard.has(t))) break;
      }

      expect(
        imageFocused,
        `[${vp.name}] fallback image must never receive focus`,
      ).toBe(false);

      for (const t of expectedTitles) {
        expect(
          seenBookForCard.has(t),
          `[${vp.name}] should reach Book Now in card "${t}" while Tabbing forward`,
        ).toBe(true);
      }

      // Phase 2: From the LAST card's Book Now (currently focused), Shift+Tab
      // backward through every card and verify that for each card the very
      // next focus stop on a stubbed-card interactive element is the provider
      // link of the SAME card, before moving up to the previous card.
      const reverseExpected = [...expectedTitles].reverse();

      for (const title of reverseExpected) {
        // Confirm we're currently on this card's Book Now button.
        const current = await readFocus(page, expectedTitles);
        expect(
          current && current.role === "bookButton" && current.cardTitle === title,
          `[${vp.name}] expected focus on Book Now of "${title}" before Shift+Tab`,
        ).toBe(true);

        // Shift+Tab until we land on a stubbed-card interactive element again.
        let landed: FocusInfo | null = null;
        let prevKey = current!.key;
        let prevStuck = 0;

        for (let j = 0; j < 50; j++) {
          await page.keyboard.press("Shift+Tab");
          const info = await readFocus(page, expectedTitles);
          if (!info) continue;

          if (info.tag === "img") {
            imageFocused = true;
            break;
          }

          if (info.key === prevKey) {
            prevStuck++;
            expect(prevStuck, `[${vp.name}] Shift+Tab trapped on ${info.key}`).toBeLessThan(5);
            continue;
          }
          prevKey = info.key;
          prevStuck = 0;

          if (info.isStubbedCard && info.role !== "other") {
            landed = info;
            break;
          }
        }

        expect(
          imageFocused,
          `[${vp.name}] fallback image must never receive focus during Shift+Tab`,
        ).toBe(false);

        expect(
          landed,
          `[${vp.name}] Shift+Tab from Book Now in "${title}" should land on an interactive control`,
        ).not.toBeNull();

        // The first stop walking backward from Book Now MUST be this card's
        // provider link — never the previous card's Book Now and never an image.
        expect(
          landed!.cardTitle,
          `[${vp.name}] Shift+Tab must stay within card "${title}" before crossing cards`,
        ).toBe(title);
        expect(
          landed!.role,
          `[${vp.name}] Shift+Tab from Book Now in "${title}" should focus the provider link`,
        ).toBe("providerLink");

        // If there is a previous card, walk backward one more step so the
        // next iteration starts on that card's Book Now.
        const prevTitle = expectedTitles[expectedTitles.indexOf(title) - 1];
        if (!prevTitle) break;

        let arrivedAtPrevBook = false;
        let key2 = landed!.key;
        let stuck2 = 0;
        for (let j = 0; j < 50; j++) {
          await page.keyboard.press("Shift+Tab");
          const info = await readFocus(page, expectedTitles);
          if (!info) continue;

          if (info.tag === "img") {
            imageFocused = true;
            break;
          }

          if (info.key === key2) {
            stuck2++;
            expect(stuck2, `[${vp.name}] Shift+Tab trapped on ${info.key}`).toBeLessThan(5);
            continue;
          }
          key2 = info.key;
          stuck2 = 0;

          if (
            info.isStubbedCard &&
            info.role === "bookButton" &&
            info.cardTitle === prevTitle
          ) {
            arrivedAtPrevBook = true;
            break;
          }
        }

        expect(
          imageFocused,
          `[${vp.name}] fallback image must never receive focus during Shift+Tab`,
        ).toBe(false);
        expect(
          arrivedAtPrevBook,
          `[${vp.name}] Shift+Tab should reach Book Now of previous card "${prevTitle}"`,
        ).toBe(true);
      }
    });
  }
});