import { test, expect } from "@playwright/test";
import {
  installShareStub,
  blockPopups,
  recordPopups,
  recordMailto,
  getMailtoCalls,
  getPopupCalls,
  getShareCalls,
  readClipboard,
  expectToast,
  SOCIALS,
} from "./helpers/share";

const PROFILE_ID =
  process.env.E2E_PROVIDER_PROFILE_ID || "d0000005-0000-0000-0000-000000000005";
const PROFILE_PATH = `/provider/${PROFILE_ID}`;

test.describe("Public provider profile — share buttons", () => {
  test.beforeEach(async ({ page }) => {
    await recordPopups(page);
    await recordMailto(page);
  });

  test("copy link writes the profile URL to the clipboard", async ({ page, baseURL }) => {
    await page.goto(PROFILE_PATH);
    await page.getByTestId("share-copy").click();
    await expectToast(page, /copied/i);
    const text = await readClipboard(page);
    expect(text).toBe(`${baseURL}${PROFILE_PATH}`);
  });

  for (const social of SOCIALS) {
    test(`${social.name} button opens a popup containing the encoded profile URL`, async ({
      page,
      baseURL,
    }) => {
      await page.goto(PROFILE_PATH);
      await page.getByTestId(`share-social-${social.name}`).click();
      const calls = await getPopupCalls(page);
      expect(calls.length).toBeGreaterThan(0);
      const { url } = calls[calls.length - 1];
      expect(url).toContain(social.host);
      expect(url).toContain(encodeURIComponent(`${baseURL}${PROFILE_PATH}`));
    });
  }

  test("popup-blocker fallback copies link to clipboard and shows toast", async ({
    page,
    baseURL,
  }) => {
    await blockPopups(page);
    await page.goto(PROFILE_PATH);
    await page.getByTestId("share-social-facebook").click();
    await expectToast(page, /copied|couldn't open/i);
    const text = await readClipboard(page);
    expect(text).toBe(`${baseURL}${PROFILE_PATH}`);
  });

  test("email button generates a mailto link with exact subject and ordered body", async ({
    page,
    baseURL,
  }) => {
    await page.goto(PROFILE_PATH);
    await page.getByTestId("share-social-email").click();
    const calls = await getMailtoCalls(page);
    expect(calls.length).toBe(1);
    const url = new URL(calls[0]);
    const subject = url.searchParams.get("subject") ?? "";
    const body = url.searchParams.get("body") ?? "";
    const profileUrl = `${baseURL}${PROFILE_PATH}`;

    // Subject must be either the named or generic share copy — exact match.
    const namedRe = /^Check out .+?'s services on ServiHub!$/;
    const genericSubject = "Check out this service provider on ServiHub!";
    expect(subject === genericSubject || namedRe.test(subject)).toBe(true);

    // Body format: `${subject}\n\n${profileUrl}` — URL appears exactly once, at the end.
    expect(body).toBe(`${subject}\n\n${profileUrl}`);
    expect(body.split(profileUrl).length - 1).toBe(1);
  });

  test("email mailto subject and body are URL-encoded with encodeURIComponent", async ({
    page,
    baseURL,
  }) => {
    await page.goto(PROFILE_PATH);
    await page.getByTestId("share-social-email").click();
    const calls = await getMailtoCalls(page);
    expect(calls.length).toBe(1);
    const href = calls[0];
    const profileUrl = `${baseURL}${PROFILE_PATH}`;

    // Raw query string (before URL parsing decodes it)
    const rawQuery = href.slice(href.indexOf("?") + 1);

    // encodeURIComponent uses %20 for spaces (NOT '+'), and encodes ! as %21 and \n as %0A.
    expect(rawQuery).toContain("subject=");
    expect(rawQuery).toContain("body=");
    expect(rawQuery).toContain("%20"); // spaces in "Check out ..."
    expect(rawQuery).toContain("%21"); // '!' from "ServiHub!"
    expect(rawQuery).toContain("%0A%0A"); // body's `\n\n` separator

    // No raw spaces, newlines, or '+' (which would indicate form-style encoding).
    expect(rawQuery).not.toMatch(/[ \n\r]/);
    expect(rawQuery).not.toContain("+");

    // The encoded profile URL must appear verbatim in the raw body param.
    const bodyParam = rawQuery.split("&").find((p) => p.startsWith("body="))!;
    expect(bodyParam).toContain(encodeURIComponent(profileUrl));

    // Round-trip: decoded values match what URL parsing produced.
    const url = new URL(href);
    expect(url.searchParams.get("subject")).toBe(
      decodeURIComponent(rawQuery.split("&").find((p) => p.startsWith("subject="))!.slice("subject=".length))
    );
  });
});

test.describe("Native Web Share — mobile only", () => {
  test.skip(
    ({ browserName }) => browserName === "firefox",
    "Firefox has no navigator.share on desktop OR Android in Playwright contexts"
  );

  test("invokes navigator.share with title/text/url", async ({ page, baseURL, isMobile }) => {
    test.skip(!isMobile, "Native share button only renders when navigator.share exists");
    await installShareStub(page, "success");
    await page.goto(PROFILE_PATH);
    await page.getByTestId("share-native").click();
    const calls = await getShareCalls(page);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe(`${baseURL}${PROFILE_PATH}`);
    expect(calls[0].title).toBeTruthy();
  });

  test("AbortError (user cancel) does NOT trigger the clipboard fallback toast", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Native share button only renders when navigator.share exists");
    await installShareStub(page, "abort");
    await page.goto(PROFILE_PATH);
    await page.getByTestId("share-native").click();
    // Give the UI a beat — no toast should appear
    await page.waitForTimeout(500);
    const toaster = page.locator("[data-sonner-toaster]");
    await expect(toaster.getByText(/copied|couldn't open/i)).toHaveCount(0);
  });

  test("real share failure falls back to clipboard copy", async ({ page, baseURL, isMobile }) => {
    test.skip(!isMobile, "Native share button only renders when navigator.share exists");
    await installShareStub(page, "error");
    await page.goto(PROFILE_PATH);
    await page.getByTestId("share-native").click();
    await expectToast(page, /copied|couldn't open/i);
    const text = await readClipboard(page);
    expect(text).toBe(`${baseURL}${PROFILE_PATH}`);
  });
});