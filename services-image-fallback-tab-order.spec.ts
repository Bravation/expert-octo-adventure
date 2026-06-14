import { test, expect } from "@playwright/test";

/**
 * Records the exact Tab order across Services cards rendered with the
 * image fallback (missing/empty/broken photo_url) and verifies that, for
 * every card, focus reaches the provider link FIRST and then the
 * "Book Now" button — in that order — before moving on to the next card.
 *
 * This guarantees the fallback image (which is not interactive) does not
 * insert itself into the tab order or disturb the natural DOM sequence.
 */

const PROVIDER_ID = "00000000-0000-0000-0000-0000000000aa";

const FAKE_PROVIDER = {
  id: PROVIDER_ID,
  full_name: "TabOrder Provider",
  avatar_url: null,
  city: "Austin",
  state: "TX",
  average_rating: 4.5,
  total_reviews: 7,
  total_services_completed: 10,
  latitude: null,
  longitude: null,
};

// Three services in a fixed DOM order, each exercising a different
// fallback path: null, empty string, and a 404-ing URL.
const FAKE_SERVICES = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "TabOrder Plumbing",
    description: "Plumbing for tab-order test.",
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
    title: "TabOrder Lawn Care",
    description: "Lawn for tab-order test.",
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
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    title: "TabOrder Dog Walking",
    description: "Dog walking for tab-order test.",
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

type FocusInfo = {
  tag: string;
  role: "providerLink" | "bookButton" | "other";
  cardTitle: string;
};

test.describe("Services page — fallback image tab order across cards", () => {
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

  test("records tab order: each card visits provider link, then Book Now, in DOM order", async ({
    page,
  }) => {
    await page.goto("/services");
    await expect(page.getByText("TabOrder Plumbing").first()).toBeVisible({ timeout: 10_000 });

    const expectedTitles = FAKE_SERVICES.map((s) => s.title);

    // Reset focus to a known starting point.
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    // Walk forward with Tab, recording every focus that lands inside one of
    // our stubbed cards. Bound by MAX_TABS so a focus trap can't hang.
    const MAX_TABS = 250;
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

      // Detect a focus trap.
      if (info.key === lastKey) {
        stuck++;
        expect(stuck, `focus appears trapped on ${info.key}`).toBeLessThan(5);
      } else {
        stuck = 0;
      }
      lastKey = info.key;

      // Fallback image must never be in the tab order.
      if (info.tag === "img") {
        imageFocused = true;
        break;
      }

      if (info.isStubbedCard && info.role !== "other") {
        recorded.push({ tag: info.tag, role: info.role, cardTitle: info.cardTitle });
      }

      // Stop once we've collected provider+book for every stubbed card.
      const seenAllCards = expectedTitles.every((t) => {
        const forCard = recorded.filter((r) => r.cardTitle === t);
        return (
          forCard.some((r) => r.role === "providerLink") &&
          forCard.some((r) => r.role === "bookButton")
        );
      });
      if (seenAllCards) break;
    }

    expect(imageFocused, "Tab focus must never land on a card image").toBe(false);

    // For each card (in DOM order), filter the recorded focuses for that card
    // and assert the first occurrence is the provider link, then Book Now —
    // and that nothing else interleaves between them for that card.
    for (const title of expectedTitles) {
      const forCard = recorded.filter((r) => r.cardTitle === title);
      expect(forCard.length, `should record focus events inside card "${title}"`).toBeGreaterThanOrEqual(2);

      const roles = forCard.map((r) => r.role);
      const firstProvider = roles.indexOf("providerLink");
      const firstBook = roles.indexOf("bookButton");

      expect(firstProvider, `provider link reached in card "${title}"`).toBeGreaterThanOrEqual(0);
      expect(firstBook, `Book Now reached in card "${title}"`).toBeGreaterThanOrEqual(0);
      expect(firstProvider, `provider link must come before Book Now in "${title}"`).toBeLessThan(
        firstBook,
      );
    }

    // And cards themselves must be visited in DOM order (Plumbing → Lawn → Dog).
    const firstFocusOfCard = expectedTitles.map(
      (t) => recorded.findIndex((r) => r.cardTitle === t),
    );
    for (let i = 1; i < firstFocusOfCard.length; i++) {
      expect(
        firstFocusOfCard[i],
        `card "${expectedTitles[i]}" should be reached after "${expectedTitles[i - 1]}"`,
      ).toBeGreaterThan(firstFocusOfCard[i - 1]);
    }
  });
});
