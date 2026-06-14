import { Page, expect } from "@playwright/test";

/**
 * Stub navigator.share so we can assert the call payload deterministically and
 * decide whether it resolves, rejects with AbortError, or rejects with a real error.
 */
export async function installShareStub(
  page: Page,
  mode: "success" | "abort" | "error" = "success"
) {
  await page.addInitScript((m) => {
    (window as any).__shareCalls = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        (window as any).__shareCalls.push(data);
        if (m === "success") return Promise.resolve();
        if (m === "abort") {
          const err = new Error("User cancelled");
          err.name = "AbortError";
          return Promise.reject(err);
        }
        return Promise.reject(new Error("share failed"));
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
  }, mode);
}

/** Force window.open to return null (popup blocked). */
export async function blockPopups(page: Page) {
  await page.addInitScript(() => {
    const original = window.open;
    (window as any).__popupBlocked = true;
    window.open = function () {
      return null;
    } as typeof window.open;
    (window as any).__originalOpen = original;
  });
}

/** Capture all window.open() calls for inspection. */
export async function recordPopups(page: Page) {
  await page.addInitScript(() => {
    (window as any).__popupCalls = [];
    const original = window.open;
    window.open = function (url?: string | URL, target?: string, features?: string) {
      (window as any).__popupCalls.push({ url: String(url ?? ""), target, features });
      // Return a fake window-like object so callers don't treat it as blocked
      return { closed: false, close: () => {}, focus: () => {} } as unknown as Window;
    } as typeof window.open;
    (window as any).__originalOpen = original;
  });
}

export async function getPopupCalls(page: Page): Promise<Array<{ url: string }>> {
  return page.evaluate(() => (window as any).__popupCalls || []);
}

/**
 * Capture mailto: navigations triggered via temporary <a> elements.
 * The component creates an anchor, calls .click(), then removes it — so we
 * patch HTMLAnchorElement.prototype.click to record the href and prevent navigation.
 */
export async function recordMailto(page: Page) {
  await page.addInitScript(() => {
    (window as any).__mailtoCalls = [];
    (window as any).__smsCalls = [];
    const proto = HTMLAnchorElement.prototype;
    const originalClick = proto.click;
    proto.click = function (this: HTMLAnchorElement) {
      if (typeof this.href === "string" && this.href.startsWith("mailto:")) {
        (window as any).__mailtoCalls.push(this.href);
        return;
      }
      if (typeof this.href === "string" && this.href.startsWith("sms:")) {
        (window as any).__smsCalls.push(this.href);
        return;
      }
      return originalClick.apply(this);
    };
  });
}

export async function getMailtoCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__mailtoCalls || []);
}

export async function getSmsCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__smsCalls || []);
}

export async function getShareCalls(page: Page): Promise<ShareData[]> {
  return page.evaluate(() => (window as any).__shareCalls || []);
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  });
}

export async function expectToast(page: Page, fragment: string | RegExp) {
  // Sonner renders toasts with role="status" inside [data-sonner-toaster]
  const toaster = page.locator("[data-sonner-toaster]");
  await expect(toaster.getByText(fragment).first()).toBeVisible({ timeout: 5_000 });
}

export const SOCIALS = [
  { name: "facebook", host: "facebook.com" },
  { name: "x", host: "x.com" },
  { name: "whatsapp", host: "wa.me" },
  { name: "linkedin", host: "linkedin.com" },
  { name: "telegram", host: "t.me" },
  { name: "reddit", host: "reddit.com" },
] as const;