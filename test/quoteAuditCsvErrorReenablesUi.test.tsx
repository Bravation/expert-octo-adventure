import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef, useState, useCallback } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: any[]) => toastErrorMock(...args),
  },
}));

// Harness mirrors the production component's export guard, error handling,
// and retry action so we can assert on UI state transitions.
function ExportUiHarness() {
  const isExportingRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = useCallback(() => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setIsExporting(true);
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    let didSucceed = false;
    try {
      const blob = new Blob(["a,b\n1,2\n"], { type: "text/csv;charset=utf-8;" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = "test.csv";
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
      toast.success("Exported 1 entries to CSV");
    }
  }, []);

  return (
    <div>
      <button
        data-testid="export-btn"
        onClick={exportToCSV}
        disabled={isExporting}
      >
        {isExporting ? "Exporting…" : "Export CSV"}
      </button>
    </div>
  );
}

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

describe("CSV export error UI re-enable", () => {
  it("shows an error toast and re-enables the Export CSV button after a failed attempt", async () => {
    vi.stubGlobal(
      "Blob",
      class {
        constructor() {
          throw new Error("blob failure");
        }
      },
    );

    render(<ExportUiHarness />);
    const btn = screen.getByTestId("export-btn");

    expect(btn).not.toBeDisabled();
    expect(btn.textContent).toBe("Export CSV");

    fireEvent.click(btn);

    // Error toast should have been called
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/Failed to export CSV/);
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/blob failure/);

    // After the finally block runs, the button must be re-enabled
    expect(btn).not.toBeDisabled();
    expect(btn.textContent).toBe("Export CSV");
  });

  it("includes a Retry action in the error toast that re-attempts export and re-enables the button", async () => {
    let attemptCount = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      attemptCount++;
      if (attemptCount <= 1) throw new Error("first attempt failed");
      return "blob:retry";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExportUiHarness />);
    const btn = screen.getByTestId("export-btn");

    fireEvent.click(btn);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });

    const options = toastErrorMock.mock.calls[0][1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options.action).toBeDefined();
    expect(options.action!.label).toBe("Retry");

    // The export button should be re-enabled after the first failure
    expect(btn).not.toBeDisabled();

    // Invoke retry — second attempt should succeed
    expect(() => options.action!.onClick()).not.toThrow();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledTimes(1);
    });
    expect(toast.success).toHaveBeenCalledWith("Exported 1 entries to CSV");

    // After successful retry, button should be enabled again
    expect(btn).not.toBeDisabled();
  });

  it("re-enables the Export CSV button even when the retry action is triggered and fails again", async () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("persistent failure");
    });

    render(<ExportUiHarness />);
    const btn = screen.getByTestId("export-btn");

    fireEvent.click(btn);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });

    const options = toastErrorMock.mock.calls[0][1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options.action).toBeDefined();

    // First failure should re-enable the button
    expect(btn).not.toBeDisabled();

    // Trigger retry, which also fails
    expect(() => options.action!.onClick()).not.toThrow();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(2);
    });
    expect(toast.success).not.toHaveBeenCalled();

    // Button must still be re-enabled after the second failure
    expect(btn).not.toBeDisabled();
    expect(btn.textContent).toBe("Export CSV");
  });
});
