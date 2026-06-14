# Playwright E2E Tests

End-to-end coverage for the provider Share widget (`src/components/dashboard/ShareProfileLink.tsx`).

## One-time setup

```bash
npx playwright install
```

## Running

Start the dev server in one terminal:
```bash
npm run dev
```

In another terminal:
```bash
# Default: http://localhost:8080
npx playwright test

# Run a single project
npx playwright test --project=chromium-desktop

# Point at a deployed preview
PLAYWRIGHT_BASE_URL=https://id-preview--<id>.lovable.app npx playwright test

# Provide credentials for the dashboard auth flow
E2E_PROVIDER_EMAIL=provider@example.com \
E2E_PROVIDER_PASSWORD=secret \
E2E_PROVIDER_PROFILE_ID=d0000005-0000-0000-0000-000000000005 \
npx playwright test
```

## What's covered

- **`share-public.spec.ts`** — public `/provider/:id` page across desktop + mobile projects:
  - Copy-link button writes the correct URL to the clipboard
  - Each social button (Facebook, X, WhatsApp, LinkedIn, Telegram, Reddit) opens a popup with a URL containing the encoded profile link
  - Email button triggers a `mailto:` navigation
  - Native Web Share button — only asserted on mobile projects where `navigator.share` exists; verifies `navigator.share` is invoked with the expected payload
  - Popup-blocker fallback — when `window.open` is stubbed to return `null`, clicking a social button copies the link to the clipboard and shows the fallback toast
  - Native-share AbortError — verifies user cancellation does NOT trigger the clipboard fallback

- **`share-dashboard.spec.ts`** — same coverage on the compact dashboard widget (auth-required). Skips automatically if `E2E_PROVIDER_EMAIL`/`E2E_PROVIDER_PASSWORD` are not set.