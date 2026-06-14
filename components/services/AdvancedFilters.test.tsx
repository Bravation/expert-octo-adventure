import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdvancedFilters, { AdvancedFiltersState } from "./AdvancedFilters";
import { attachLiveRegionTracker } from "@/test/liveRegion";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, opts?: Record<string, string>) => {
      let str = fallback ?? _key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          str = str.replace(`{{${k}}}`, v);
        }
      }
      return str;
    },
  }),
}));

// Radix Select uses pointer capture APIs not implemented in jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!(Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  }
});

function Harness() {
  const filters: AdvancedFiltersState = {
    priceRange: [0, 1000],
    minRating: null,
    availabilityFilter: null,
    sortBy: "relevance",
  };
  return <AdvancedFilters filters={filters} onFiltersChange={() => {}} />;
}

describe("AdvancedFilters — sort SelectTrigger keyboard announcements", () => {
  it("re-announces 'Sort by filter focused' when opening (Enter) and closing (Escape) the sort trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Open the Advanced Filters panel
    await user.click(screen.getByRole("button", { name: /advanced filters/i }));

    // Find the sort trigger (combobox with aria-label "Sort by"). The
    // collapsible mounts its content after a frame, so allow some time.
    const sortTrigger = await screen.findByRole(
      "combobox",
      { name: /sort by/i },
      { timeout: 3000 }
    );

    const tracker = attachLiveRegionTracker();

    try {
      // Drive focus -> open -> close as a monotonic sequence. The helper
      // asserts each step grows the announcement count and matches the
      // expected sort-focus message.
      await tracker.assertMonotonicSequence([
        {
          label: "focus sort trigger",
          action: () => {
            sortTrigger.focus();
          },
          expect: /sort by filter focused/i,
        },
        {
          label: "open dropdown with Enter",
          action: async () => {
            await user.keyboard("{Enter}");
          },
          expect: /sort by filter focused/i,
        },
        {
          label: "close dropdown with Escape",
          action: async () => {
            await user.keyboard("{Escape}");
          },
          expect: /sort by filter focused/i,
        },
      ]);

      await waitFor(() => {
        expect(sortTrigger).toHaveFocus();
      });
      expect(tracker.count()).toBeGreaterThanOrEqual(3);
    } finally {
      tracker.detach();
    }
  });
});