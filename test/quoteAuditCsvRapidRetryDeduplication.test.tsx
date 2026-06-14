import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef, useState, useCallback, useMemo } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

// Harness that exposes the internal isExportingRef so we can test the guard directly
function GuardedExportHarness({
  providerFilter,
  overrideFilter,
  fromDate,
  toDate,
  initialRefValue = false,
}: {
  providerFilter: string;
  overrideFilter: "all" | "yes" | "no";
  fromDate: string;
  toDate: string;
  initialRefValue?: boolean;
}) {
  const isExportingRef = useRef(initialRefValue);
  const [isExporting, setIsExporting] = useState(initialRefValue);

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
      data-ref-active={isExportingRef.current}
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

describe("rapid retry clicks deduplication", () => {
  it("when isExportingRef is already true, retry calls are blocked and buildAuditCsv is not duplicated", async () => {
    const buildAuditCsvSpy = vi.spyOn(
      await import("@/lib/quoteAuditCsv"),
      "buildAuditCsv",
    );

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("persistent failure");
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    // Seed the ref as already-active to simulate an in-progress export
    render(
      <GuardedExportHarness
        providerFilter="pB"
        overrideFilter="yes"
        fromDate="2026-01-01"
        toDate="2026-01-31"
        initialRefValue={true}
      />,
    );

    const btn = screen.getByTestId("export-btn");
    expect(btn).toHaveAttribute("data-exporting", "true");

    // Rapid clicks on the button while ref is active — none should trigger buildAuditCsv
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    // No error or success toasts because exportToCSV returned early every time
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    // buildAuditCsv must have been called zero times — the guard blocked every attempt
    expect(buildAuditCsvSpy).toHaveBeenCalledTimes(0);
  });

  it("rapid retry clicks after a failure each run sequentially with exactly one buildAuditCsv per attempt", async () => {
    const buildAuditCsvSpy = vi.spyOn(
      await import("@/lib/quoteAuditCsv"),
      "buildAuditCsv",
    );

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("persistent failure");
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <GuardedExportHarness
        providerFilter="pB"
        overrideFilter="yes"
        fromDate="2026-01-01"
        toDate="2026-01-31"
      />,
    );

    const btn = screen.getByTestId("export-btn");
    expect(btn).toHaveAttribute("data-exporting", "false");

    // Initial click → failure
    fireEvent.click(btn);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));

    const getRetryAction = () => {
      const options = toastErrorMock.mock.calls[toastErrorMock.mock.calls.length - 1]?.[1] as {
        action?: { label: string; onClick: () => void };
      };
      return options?.action;
    };

    const retryAction = getRetryAction()!;
    expect(retryAction.label).toBe("Retry");

    // Rapid-fire retry clicks (5 times)
    act(() => retryAction.onClick());
    act(() => retryAction.onClick());
    act(() => retryAction.onClick());
    act(() => retryAction.onClick());
    act(() => retryAction.onClick());

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(6));

    // Each click produced exactly one error toast, confirming sequential execution
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/persistent failure/);
    for (let i = 1; i < 6; i++) {
      expect(toastErrorMock.mock.calls[i][0]).toMatch(/persistent failure/);
    }

    // buildAuditCsv must have been called exactly 6 times (1 initial + 5 retries) — never duplicated
    expect(buildAuditCsvSpy).toHaveBeenCalledTimes(6);
    const firstCallArgs = buildAuditCsvSpy.mock.calls[0];
    for (let i = 1; i < 6; i++) {
      expect(buildAuditCsvSpy.mock.calls[i]).toEqual(firstCallArgs);
    }

    // UI should be idle after the last attempt
    expect(btn).toHaveAttribute("data-exporting", "false");
    expect(btn).not.toBeDisabled();
  });
});
