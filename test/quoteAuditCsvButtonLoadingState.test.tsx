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
const toastSuccessMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
  },
}));

const quotes: Record<string, QuoteMeta> = {
  q1: { id: "q1", provider_id: "pA", customer_id: "cA", service_id: "s1" },
};

const profiles: Record<string, ProfileMeta> = {
  pA: { id: "pA", full_name: "Provider A" },
  cA: { id: "cA", full_name: "Customer A" },
};

const services: Record<string, ServiceMeta> = {
  s1: { id: "s1", title: "Lawn Care" },
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
];

// Async harness that lets us observe intermediate loading states.
// The production export is synchronous, but to test the UI transition
// we introduce a single await point controlled by the test.
function AsyncLoadingHarness({
  shouldFail = false,
  callCountRef,
}: {
  shouldFail?: boolean;
  callCountRef: React.MutableRefObject<number>;
}) {
  const isExportingRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<(() => void) | null>(null);

  const filtered = useMemo(
    () =>
      filterAuditRows(rows, quotes, {
        providerFilter: "all",
        overrideFilter: "all",
        fromDate: "",
        toDate: "",
      }),
    [],
  );

  const exportToCSV = useCallback(async () => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setIsExporting(true);

    // Yield to the test so it can assert the loading state.
    await new Promise<void>((res) => {
      setResolvePromise(() => res);
    });

    callCountRef.current += 1;
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    let didSucceed = false;
    try {
      if (shouldFail) {
        throw new Error("export failure");
      }
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
      setResolvePromise(null);
    }
    if (didSucceed) {
      toast.success(`Exported ${filtered.length} entries to CSV`);
    }
  }, [filtered, shouldFail]);

  return (
    <div>
      <button
        data-testid="export-btn"
        data-exporting={isExporting}
        onClick={exportToCSV}
        disabled={isExporting}
      >
        {isExporting ? "Exporting…" : "Export CSV"}
      </button>
      {resolvePromise && (
        <button data-testid="unlock-btn" onClick={() => resolvePromise()}>
          Unlock
        </button>
      )}
    </div>
  );
}

beforeEach(() => {
  toastErrorMock.mockClear();
  toastSuccessMock.mockClear();
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
});

describe("CSV export button loading state transitions", () => {
  it("export button shows loading/disabled during export and returns to normal after success", async () => {
    const callCountRef = { current: 0 };

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/ok");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<AsyncLoadingHarness callCountRef={callCountRef} />);

    const exportBtn = screen.getByTestId("export-btn");
    expect(exportBtn).toHaveTextContent("Export CSV");
    expect(exportBtn).not.toBeDisabled();
    expect(exportBtn).toHaveAttribute("data-exporting", "false");

    // Start the export
    fireEvent.click(exportBtn);

    // During export the button should be disabled and show loading text
    await waitFor(() => expect(screen.getByTestId("unlock-btn")).toBeInTheDocument());
    expect(exportBtn).toHaveTextContent("Exporting…");
    expect(exportBtn).toBeDisabled();
    expect(exportBtn).toHaveAttribute("data-exporting", "true");

    // Let the export complete
    fireEvent.click(screen.getByTestId("unlock-btn"));

    await waitFor(() => expect(exportBtn).toHaveAttribute("data-exporting", "false"));
    expect(exportBtn).toHaveTextContent("Export CSV");
    expect(exportBtn).not.toBeDisabled();

    expect(callCountRef.current).toBe(1);
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith("Exported 1 entries to CSV");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("retry action also shows loading/disabled and returns to normal after final success", async () => {
    const callCountRef = { current: 0 };

    let callIndex = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      callIndex += 1;
      if (callIndex === 1) {
        throw new Error("transient failure");
      }
      return "blob:test/ok";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<AsyncLoadingHarness callCountRef={callCountRef} shouldFail={false} />);

    const exportBtn = screen.getByTestId("export-btn");

    // --- First attempt fails ---
    fireEvent.click(exportBtn);
    await waitFor(() => expect(screen.getByTestId("unlock-btn")).toBeInTheDocument());
    expect(exportBtn).toHaveTextContent("Exporting…");
    expect(exportBtn).toBeDisabled();

    // Complete the attempt (the harness will call buildAuditCsv, then URL.createObjectURL throws)
    fireEvent.click(screen.getByTestId("unlock-btn"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));

    // Button should be back to normal after the failure
    expect(exportBtn).toHaveTextContent("Export CSV");
    expect(exportBtn).not.toBeDisabled();
    expect(exportBtn).toHaveAttribute("data-exporting", "false");

    const errorOptions = toastErrorMock.mock.calls[0][1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(errorOptions?.action?.label).toBe("Retry");

    // --- Retry succeeds ---
    await act(async () => {
      errorOptions!.action!.onClick();
    });

    // Wait for the retry to reach the unlock point
    await waitFor(() => {
      const unlockBtns = screen.queryAllByTestId("unlock-btn");
      return unlockBtns.length > 0;
    });

    expect(exportBtn).toHaveTextContent("Exporting…");
    expect(exportBtn).toBeDisabled();
    expect(exportBtn).toHaveAttribute("data-exporting", "true");

    fireEvent.click(screen.getByTestId("unlock-btn"));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledTimes(1));
    expect(exportBtn).toHaveTextContent("Export CSV");
    expect(exportBtn).not.toBeDisabled();
    expect(exportBtn).toHaveAttribute("data-exporting", "false");

    expect(callCountRef.current).toBe(2);
    expect(toastSuccessMock).toHaveBeenCalledWith("Exported 1 entries to CSV");
  });
});
