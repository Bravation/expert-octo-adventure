import { test, expect, devices } from "@playwright/test";

/**
 * Verifies the Services card tab order — provider link first, then "Book Now" —
 * holds across mobile, tablet, and desktop viewport sizes, even when cards
 * fall back to the category placeholder image.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000bb";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "Viewport Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.6,
  total_reviews: 9,
  total_services_completed: 12,
  latitude: null,
  longitude: null,
};

const FAKE_SERVICES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Viewport Plumbing",
    description: "Plumbing for viewport test.",
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
    id: "22222222-2222-2222-2222-222222222222",
    title: "Viewport Lawn Care",
    description: "Lawn for viewport test.",
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
    id: "33333333-3333-3333-3333-333333333333",
    title: "Viewport Dog Walking",
    description: "Dog walking for viewport test.",
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
  { name: "mobile", width: 390, height: 844 },   // iPhone 13-ish
  { name: "tablet", width: 820, height: 1180 },  // iPad Air-ish
  { name: "desktop", width: 1440, height: 900 }, // common laptop
];

type FocusInfo = {
  tag: string;
  role: "providerLink" | "bookButton" | "other";
  cardTitle: string;
};

test.describe("Services page — fallback image tab order across viewports", () => {
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
    test(`tab order: provider link → Book Now (${vp.name} ${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/services");
      await expect(page.getByText("Viewport Plumbing").first()).toBeVisible({ timeout: 10_000 });

      const expectedTitles = FAKE_SERVICES.map((s) => s.title);

      // Reset focus
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      const MAX_TABS = 300;
      const recorded: FocusInfo[] = [];
      let lastKey = "";
      let stuck = 0;
      let imageFocused = false;

      for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press("Tab");

        const info = await page.evaluate((titles) => {
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
        }, expectedTitles);

        if (!info) continue;

        if (info.key === lastKey) {
          stuck++;
          expect(stuck, `focus appears trapped on ${info.key}`).toBeLessThan(5);
        } else {
          stuck = 0;
        }
        lastKey = info.key;

        if (info.tag === "img") {
          imageFocused = true;
          break;
        }

        if (info.isStubbedCard && info.role !== "other") {
          recorded.push({ tag: info.tag, role: info.role, cardTitle: info.cardTitle });
        }

        const seenAllCards = expectedTitles.every((t) => {
          const forCard = recorded.filter((r) => r.cardTitle === t);
          return (
            forCard.some((r) => r.role === "providerLink") &&
            forCard.some((r) => r.role === "bookButton")
          );
        });
        if (seenAllCards) break;
      }

      expect(
        imageFocused,
        `[${vp.name}] Tab focus must never land on a card image`,
      ).toBe(false);

      for (const title of expectedTitles) {
        const forCard = recorded.filter((r) => r.cardTitle === title);
        expect(
          forCard.length,
          `[${vp.name}] should record focus events inside card "${title}"`,
        ).toBeGreaterThanOrEqual(2);

        const roles = forCard.map((r) => r.role);
        const firstProvider = roles.indexOf("providerLink");
        const firstBook = roles.indexOf("bookButton");

        expect(
          firstProvider,
          `[${vp.name}] provider link reached in card "${title}"`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          firstBook,
          `[${vp.name}] Book Now reached in card "${title}"`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          firstProvider,
          `[${vp.name}] provider link must come before Book Now in "${title}"`,
        ).toBeLessThan(firstBook);
      }

      // Cards visited in DOM order
      const firstFocusOfCard = expectedTitles.map(
        (t) => recorded.findIndex((r) => r.cardTitle === t),
      );
      for (let i = 1; i < firstFocusOfCard.length; i++) {
        expect(
          firstFocusOfCard[i],
          `[${vp.name}] card "${expectedTitles[i]}" should be reached after "${expectedTitles[i - 1]}"`,
        ).toBeGreaterThan(firstFocusOfCard[i - 1]);
      }
    });
  }
});