import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mirrors the production exportToCSV ordering in
// src/pages/AdminQuoteAuditLog.tsx: success toast must fire only AFTER the
// finally block (DOM cleanup + URL.revokeObjectURL).
function Harness() {
  const isExportingRef = useRef(false);
  const [, setIsExporting] = useState(false);

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
      link.download = "x.csv";
      document.body.appendChild(link);
      link.click();
      didSucceed = true;
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

  return <button onClick={exportToCSV}>Export CSV</button>;
}

const events: string[] = [];
let appendedLink: HTMLAnchorElement | null = null;

beforeEach(() => {
  events.length = 0;
  appendedLink = null;
  (toast.success as ReturnType<typeof vi.fn>).mockReset();
  (toast.success as ReturnType<typeof vi.fn>).mockImplementation(() => {
    events.push("toast.success");
  });

  if (typeof (URL as any).createObjectURL !== "function") {
    (URL as any).createObjectURL = () => "";
  }
  if (typeof (URL as any).revokeObjectURL !== "function") {
    (URL as any).revokeObjectURL = () => {};
  }
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/abc");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
    events.push("revokeObjectURL");
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    events.push("click");
    appendedLink = this;
    // toast must NOT have fired by the time click runs
    expect(toast.success).not.toHaveBeenCalled();
    // link is still attached to the DOM at click time
    expect(this.parentNode).not.toBeNull();
  });

  const realRemoveChild = Node.prototype.removeChild;
  vi.spyOn(Node.prototype, "removeChild").mockImplementation(function (
    this: Node,
    child: Node,
  ) {
    if (child === appendedLink) {
      events.push("removeChild");
      // toast must NOT have fired before DOM cleanup completes
      expect(toast.success).not.toHaveBeenCalled();
    }
    return realRemoveChild.call(this, child);
  } as typeof Node.prototype.removeChild);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CSV export success toast ordering", () => {
  it("fires toast.success only after DOM cleanup and URL.revokeObjectURL", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Export CSV"));

    expect(events).toEqual([
      "click",
      "removeChild",
      "revokeObjectURL",
      "toast.success",
    ]);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Exported 1 entries to CSV");

    // link should no longer be attached after the export completes
    expect(appendedLink?.parentNode).toBeNull();
  });
});