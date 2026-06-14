import { test, expect } from "@playwright/test";
import {
  blockPopups,
  recordPopups,
  recordMailto,
  getMailtoCalls,
  getSmsCalls,
  getPopupCalls,
  readClipboard,
  expectToast,
  SOCIALS,
} from "./helpers/share";

const EMAIL = process.env.E2E_PROVIDER_EMAIL;
const PASSWORD = process.env.E2E_PROVIDER_PASSWORD;

test.describe("Provider dashboard — compact share widget", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Set E2E_PROVIDER_EMAIL and E2E_PROVIDER_PASSWORD to run dashboard share tests"
  );

  test.beforeEach(async ({ page }) => {
    await recordPopups(page);
    await recordMailto(page);
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(EMAIL!);
    await page.getByLabel(/password/i).first().fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("compact copy button copies the profile URL", async ({ page, baseURL }) => {
    await page.getByTestId("share-copy-compact").first().click();
    await expectToast(page, /copied/i);
    const text = await readClipboard(page);
    expect(text).toContain(`${baseURL}/provider/`);
  });

  for (const social of SOCIALS) {
    test(`compact ${social.name} button opens a popup`, async ({ page }) => {
      await page.getByTestId(`share-social-compact-${social.name}`).first().click();
      const calls = await getPopupCalls(page);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[calls.length - 1].url).toContain(social.host);
    });
  }

  test("compact popup-blocker fallback copies the link", async ({ page, baseURL }) => {
    await blockPopups(page);
    // Navigate again so the init script applies
    await page.reload();
    await page.getByTestId("share-social-compact-facebook").first().click();
    await expectToast(page, /copied|couldn't open/i);
    const text = await readClipboard(page);
    expect(text).toContain(`${baseURL}/provider/`);
  });

  test("compact email button generates a mailto link with exact subject and ordered body", async ({
    page,
    baseURL,
  }) => {
    await page.getByTestId("share-social-compact-email").first().click();
    const calls = await getMailtoCalls(page);
    expect(calls.length).toBe(1);
    const url = new URL(calls[0]);
    const subject = url.searchParams.get("subject") ?? "";
    const body = url.searchParams.get("body") ?? "";

    // Dashboard always passes providerName → named subject is required.
    expect(subject).toMatch(/^Check out .+?'s services on ServiHub!$/);

    // Body format: `${subject}\n\n${profileUrl}` — URL appears exactly once, at the end.
    const profileUrlRe = new RegExp(
      `^${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n\\n${baseURL!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/provider/[^\\s]+$`
    );
    expect(body).toMatch(profileUrlRe);
    const providerUrlMatches = body.match(/\/provider\//g) ?? [];
    expect(providerUrlMatches.length).toBe(1);
  });

  test("compact email mailto subject and body are URL-encoded with encodeURIComponent", async ({
    page,
    baseURL,
  }) => {
    await page.getByTestId("share-social-compact-email").first().click();
    const calls = await getMailtoCalls(page);
    expect(calls.length).toBe(1);
    const href = calls[0];

    const rawQuery = href.slice(href.indexOf("?") + 1);

    // encodeURIComponent uses %20 for spaces (NOT '+'), %21 for '!', %0A for '\n'.
    expect(rawQuery).toContain("subject=");
    expect(rawQuery).toContain("body=");
    expect(rawQuery).toContain("%20");
    expect(rawQuery).toContain("%21");
    expect(rawQuery).toContain("%0A%0A");

    // No raw spaces, newlines, or '+' (would indicate form-style encoding).
    expect(rawQuery).not.toMatch(/[ \n\r]/);
    expect(rawQuery).not.toContain("+");

    // Encoded provider URL must appear verbatim in the raw body param.
    const bodyParam = rawQuery.split("&").find((p) => p.startsWith("body="))!;
    expect(bodyParam).toContain(encodeURIComponent(`${baseURL}/provider/`));

    // Round-trip: subject decoded matches what URL parsing produced.
    const url = new URL(href);
    const rawSubject = rawQuery
      .split("&")
      .find((p) => p.startsWith("subject="))!
      .slice("subject=".length);
    expect(url.searchParams.get("subject")).toBe(decodeURIComponent(rawSubject));
  });

  test("compact SMS button generates an encoded sms: link with provider URL", async ({
    page,
    baseURL,
  }) => {
    await page.getByTestId("share-social-compact-sms").first().click();
    const calls = await getSmsCalls(page);
    expect(calls.length).toBe(1);
    const href = calls[0];

    // Format: `sms:?body=<encoded shareText + " " + profileUrl>`
    expect(href.startsWith("sms:?body=")).toBe(true);
    // No recipient — body-only SMS share (lets the user pick the contact).
    expect(href).not.toMatch(/^sms:\+?\d/);

    const rawBody = href.slice("sms:?body=".length);

    // encodeURIComponent semantics: %20 for space, %21 for '!', no '+' or raw whitespace.
    expect(rawBody).toContain("%20");
    expect(rawBody).toContain("%21");
    expect(rawBody).not.toMatch(/[ \n\r]/);
    expect(rawBody).not.toContain("+");

    // Encoded provider URL must appear verbatim in the body.
    expect(rawBody).toContain(encodeURIComponent(`${baseURL}/provider/`));

    // Decoded body matches `${shareText} ${profileUrl}` shape: ends with the URL,
    // preceded by a single space, and contains exactly one provider URL.
    const decoded = decodeURIComponent(rawBody);
    expect(decoded).toMatch(/^Check out .+?'s services on ServiHub! https?:\/\/.+\/provider\/[^\s]+$/);
    expect((decoded.match(/\/provider\//g) ?? []).length).toBe(1);
  });

  test("SMS recipient input produces sms:+NUMBER?body=... with sanitized digits", async ({
    page,
    baseURL,
  }) => {
    // Type a messy number — spaces, dashes, parens, and a leading '+'.
    const recipientInput = page.getByTestId("share-sms-recipient").first();
    await recipientInput.fill("+1 (555) 123-4567");

    await page.getByTestId("share-social-sms").first().click();
    const calls = await getSmsCalls(page);
    expect(calls.length).toBe(1);
    const href = calls[0];

    // Format: `sms:+15551234567?body=<encoded shareText + " " + profileUrl>`
    expect(href.startsWith("sms:+15551234567?body=")).toBe(true);

    const rawBody = href.slice("sms:+15551234567?body=".length);

    // encodeURIComponent semantics on the body.
    expect(rawBody).toContain("%20");
    expect(rawBody).toContain("%21");
    expect(rawBody).not.toMatch(/[ \n\r]/);
    expect(rawBody).not.toContain("+");

    // Encoded provider URL must appear verbatim in the body, exactly once.
    expect(rawBody).toContain(encodeURIComponent(`${baseURL}/provider/`));
    const decoded = decodeURIComponent(rawBody);
    expect(decoded).toMatch(/^Check out .+?'s services on ServiHub! https?:\/\/.+\/provider\/[^\s]+$/);
    expect((decoded.match(/\/provider\//g) ?? []).length).toBe(1);
  });
});