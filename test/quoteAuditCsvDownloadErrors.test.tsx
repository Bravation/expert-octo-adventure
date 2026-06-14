import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast } from "sonner";
import { useCallback } from "react";
import {
  buildAuditCsv,
  type AuditRow,
  type QuoteMeta,
  type ProfileMeta,
  type ServiceMeta,
} from "@/lib/quoteAuditCsv";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...args: any[]) => toastErrorMock(...args) },
}));

// Harness mirrors the page's exportToCSV try/catch/finally wiring with retry action.
function AuditExportHarness({
  rows,
  quotes,
  profiles,
  services,
}: {
  rows: AuditRow[];
  quotes: Record<string, QuoteMeta>;
  profiles: Record<string, ProfileMeta>;
  services: Record<string, ServiceMeta>;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const isExportingRef = useRef(false);

  const exportToCSV = useCallback(() => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setIsExporting(true);
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const csv = buildAuditCsv(rows, quotes, profiles, services);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = `quote_audit_log_test.csv`;
      document.body.appendChild(link);
      link.click();
      toast.success(`Exported ${rows.length} entries to CSV`);
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
  }, [rows, quotes, profiles, services]);

  return (
    <button onClick={exportToCSV} disabled={isExporting} data-testid="export-btn">
      {isExporting ? "Exporting…" : "Export CSV"}
    </button>
  );
}

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
    editor_role: "provider",
    old_price: 50,
    new_price: 75,
    old_description: "",
    new_description: "",
    old_status: "pending",
    new_status: "pending",
    admin_override: false,
    created_at: "2026-01-10T12:00:00Z",
  },
];

const RealBlob = globalThis.Blob;
const RealClick = HTMLAnchorElement.prototype.click;

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
  HTMLAnchorElement.prototype.click = RealClick;
});

describe("CSV export error handling", () => {
  it("shows a toast error and does not throw when Blob construction fails", () => {
    vi.stubGlobal(
      "Blob",
      class {
        constructor() {
          throw new Error("blob boom");
        }
      },
    );

    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );

    expect(() => fireEvent.click(screen.getByText("Export CSV"))).not.toThrow();
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/Failed to export CSV/);
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/blob boom/);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a toast error when URL.createObjectURL throws", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("url failed");
    });

    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );

    fireEvent.click(screen.getByText("Export CSV"));

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/url failed/);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a toast error when the download click throws and cleans up the anchor", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test/x");
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click denied");
    });

    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );

    fireEvent.click(screen.getByText("Export CSV"));

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/click denied/);
    expect(toast.success).not.toHaveBeenCalled();
    // finally{} must still revoke and remove the anchor from the DOM
    expect(revokeSpy).toHaveBeenCalledWith("blob:test/x");
    expect(document.querySelector('a[download="quote_audit_log_test.csv"]')).toBeNull();
  });

  it("falls back to 'Unknown error' when a non-Error value is thrown", () => {
    vi.stubGlobal(
      "Blob",
      class {
        constructor() {
          throw "weird";
        }
      },
    );

    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );

    fireEvent.click(screen.getByText("Export CSV"));

    expect(toastErrorMock).toHaveBeenCalledWith("Failed to export CSV: Unknown error", expect.any(Object));
  });
});

describe("CSV export retry action", () => {
  it("toast error includes a Retry action that re-attempts the export", () => {
    // First call fails; second succeeds
    let callCount = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("first attempt failed");
      return "blob:retry";
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );

    fireEvent.click(screen.getByText("Export CSV"));

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    const options = toastErrorMock.mock.calls[0][1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options).toBeDefined();
    expect(options.action).toBeDefined();
    expect(options.action!.label).toBe("Retry");

    // Invoke the retry action — should now succeed
    expect(() => options.action!.onClick()).not.toThrow();
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("retry action still reports an error when the second attempt also fails", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("always fails");
    });

    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );

    fireEvent.click(screen.getByText("Export CSV"));

    const options = toastErrorMock.mock.calls[0][1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options.action).toBeDefined();

    // Retry should produce a second error toast, not crash
    expect(() => options.action!.onClick()).not.toThrow();
    expect(toastErrorMock).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
