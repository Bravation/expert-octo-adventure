import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef, useState, useCallback, useMemo } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import {
  filterAuditRows,
  buildAuditCsv,
  type AuditRow,
  type QuoteMeta,
  type ProfileMeta,
  type ServiceMeta,
} from "@/lib/quoteAuditCsv";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: any[]) => toastErrorMock(...args),
  },
}));

const quotes: Record<string, QuoteMeta> = {
  q1: { id: "q1", provider_id: "pA", customer_id: "cA", service_id: "s1" },
  q2: { id: "q2", provider_id: "pB", customer_id: "cB", service_id: "s2" },
};

const profiles: Record<string, ProfileMeta> = {
  pA: { id: "pA", full_name: "Provider A" },
  pB: { id: "pB", full_name: "Provider B" },
  cA: { id: "cA", full_name: "Customer A" },
  cB: { id: "cB", full_name: "Customer B" },
};

const services: Record<string, ServiceMeta> = {
  s1: { id: "s1", title: "Lawn Care" },
  s2: { id: "s2", title: "Tree Trimming" },
};

const rows: AuditRow[] = [
  {
    id: "r1",
    quote_id: "q1",
    edited_by_profile_id: "pA",
    edited_by_user_id: null,
    editor_role: "provider",
    old_price: 50,
    new_price: 75,
    old_description: "",
    new_description: "",
    old_status: "pending",
    new_status: "accepted",
    admin_override: false,
    created_at: "2026-01-10T12:00:00Z",
  },
  {
    id: "r2",
    quote_id: "q2",
    edited_by_profile_id: "pB",
    edited_by_user_id: null,
    editor_role: "admin",
    old_price: 100,
    new_price: 120,
    old_description: "",
    new_description: "",
    old_status: "pending",
    new_status: "accepted",
    admin_override: true,
    created_at: "2026-01-11T14:00:00Z",
  },
];

// Harness closely mirrors the production AdminQuoteAuditLog export flow,
// including filter application, so we can assert retry uses the same data.
function FilteredExportHarness({
  providerFilter,
  overrideFilter,
  fromDate,
  toDate,
}: {
  providerFilter: string;
  overrideFilter: "all" | "yes" | "no";
  fromDate: string;
  toDate: string;
}) {
  const isExportingRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);

  const filtered = useMemo(
    () =>
      filterAuditRows(rows, quotes, {
        providerFilter,
        overrideFilter,
        fromDate,
        toDate,
      }),
    [providerFilter, overrideFilter, fromDate, toDate],
  );

  const exportToCSV = useCallback(() => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setIsExporting(true);
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    let didSucceed = false;
    try {
      const csv = buildAuditCsv(filtered, quotes, profiles, services);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = `quote_audit_log_test.csv`;
      document.body.appendChild(link);
      link.click();
      didSucceed = true;
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Unknown error";
      toast.error(`Failed to export CSV: ${message}`, {
        action: {
          label: "Retry",
          onClick: () => exportToCSV(),
        },
      });
    } finally {
      if (link && link.parentNode) link.parentNode.removeChild(link);
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      }
      isExportingRef.current = false;
      setIsExporting(false);
    }
    if (didSucceed) {
      toast.success(`Exported ${filtered.length} entries to CSV`);
    }
  }, [filtered]);

  return (
    <button
      data-testid="export-btn"
      data-exporting={isExporting}
      onClick={exportToCSV}
      disabled={isExporting}
    >
      {isExporting ? "Exporting…" : "Export CSV"}
    </button>
  );
}

const RealBlob = globalThis.Blob;

beforeEach(() => {
  toastErrorMock.mockClear();
  vi.mocked(toast.success).mockClear();
  if (typeof (URL as any).createObjectURL !== "function") {
    (URL as any).createObjectURL = () => "";
  }
  if (typeof (URL as any).revokeObjectURL !== "function") {
    (URL as any).revokeObjectURL = () => {};
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalThis.Blob = RealBlob;
});

describe("CSV export retry clears error state and preserves filters", () => {
  it("retry triggers a fresh export attempt using the same filtered data", async () => {
    const buildAuditCsvSpy = vi.spyOn(
      await import("@/lib/quoteAuditCsv"),
      "buildAuditCsv",
    );

    let callCount = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("network failure");
      return "blob:retry-success";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    // Use a non-trivial filter so "same filters" is meaningful
    render(
      <FilteredExportHarness
        providerFilter="pB"
        overrideFilter="yes"
        fromDate="2026-01-01"
        toDate="2026-01-31"
      />,
    );

    const btn = screen.getByTestId("export-btn");
    expect(btn).toHaveAttribute("data-exporting", "false");

    fireEvent.click(btn);

    // First attempt should fail and show error toast
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/network failure/);

    // After the finally block runs the button is re-enabled (error state cleared)
    expect(btn).toHaveAttribute("data-exporting", "false");
    expect(btn).not.toBeDisabled();

    // buildAuditCsv should have been called once with the filtered data
    expect(buildAuditCsvSpy).toHaveBeenCalledTimes(1);
    const firstCallArgs = buildAuditCsvSpy.mock.calls[0];
    expect(firstCallArgs[0]).toHaveLength(1); // only r2 matches pB + override + date range
    expect(firstCallArgs[0][0].id).toBe("r2");

    // Extract retry action
    const options = toastErrorMock.mock.calls[0][1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options.action).toBeDefined();
    expect(options.action!.label).toBe("Retry");

    // Invoke retry — should start a new attempt with the same closures
    expect(() => options.action!.onClick()).not.toThrow();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledTimes(1);
    });
    expect(toast.success).toHaveBeenCalledWith("Exported 1 entries to CSV");

    // buildAuditCsv must have been called a second time with identical arguments
    expect(buildAuditCsvSpy).toHaveBeenCalledTimes(2);
    expect(buildAuditCsvSpy.mock.calls[1]).toEqual(firstCallArgs);

    // Final UI state should be idle (error/loading fully cleared)
    expect(btn).toHaveAttribute("data-exporting", "false");
    expect(btn).not.toBeDisabled();
  });

});
