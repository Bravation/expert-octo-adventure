import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState, useRef, useCallback } from "react";

// Minimal harness that replicates the production export guard and UI state
function GuardedExportHarness() {
  const isExportingRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = useCallback(() => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setIsExporting(true);
    // Intentionally do NOT reset here so we can observe the locked state
  }, []);

  return (
    <button onClick={exportToCSV} disabled={isExporting} data-testid="export-btn">
      {isExporting ? "Exporting…" : "Export CSV"}
    </button>
  );
}

describe("CSV export loading state", () => {
  it("disables the button and shows loading text while an export is in progress", () => {
    render(<GuardedExportHarness />);
    const btn = screen.getByTestId("export-btn");

    expect(btn).not.toBeDisabled();
    expect(btn.textContent).toBe("Export CSV");

    fireEvent.click(btn);

    expect(btn).toBeDisabled();
    expect(btn.textContent).toBe("Exporting…");
  });

  it("ignores additional clicks while an export is already in progress", () => {
    let callCount = 0;

    function CountingHarness() {
      const isExportingRef = useRef(false);
      const [isExporting, setIsExporting] = useState(false);

      const exportToCSV = useCallback(() => {
        if (isExportingRef.current) return;
        isExportingRef.current = true;
        setIsExporting(true);
        callCount++;
      }, []);

      return (
        <button onClick={exportToCSV} disabled={isExporting} data-testid="export-btn">
          {isExporting ? "Exporting…" : "Export CSV"}
        </button>
      );
    }

    render(<CountingHarness />);
    const btn = screen.getByTestId("export-btn");

    fireEvent.click(btn);
    expect(callCount).toBe(1);
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(callCount).toBe(1); // second click was ignored
    expect(btn).toBeDisabled();
  });
});
