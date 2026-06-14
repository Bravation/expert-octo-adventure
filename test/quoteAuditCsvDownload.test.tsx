import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useMemo, useState } from "react";
import {
  filterAuditRows,
  buildAuditCsv,
  AUDIT_CSV_HEADERS,
  type AuditRow,
  type QuoteMeta,
  type ProfileMeta,
  type ServiceMeta,
} from "@/lib/quoteAuditCsv";

// Mirrors the production exportToCSV in src/pages/AdminQuoteAuditLog.tsx
// (Blob -> object URL -> anchor.click -> revoke) so we exercise the same
// download wiring the page uses, without booting the full Supabase-backed page.
function AuditExportHarness({
  rows,
  quotes,
  profiles,
  services,
  initialProvider = "all",
  initialOverride = "all" as "all" | "yes" | "no",
  initialFrom = "",
  initialTo = "",
}: {
  rows: AuditRow[];
  quotes: Record<string, QuoteMeta>;
  profiles: Record<string, ProfileMeta>;
  services: Record<string, ServiceMeta>;
  initialProvider?: string;
  initialOverride?: "all" | "yes" | "no";
  initialFrom?: string;
  initialTo?: string;
}) {
  const [providerFilter, setProviderFilter] = useState(initialProvider);
  const [overrideFilter, setOverrideFilter] = useState(initialOverride);
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);

  const filtered = useMemo(
    () =>
      filterAuditRows(rows, quotes, {
        providerFilter,
        overrideFilter,
        fromDate,
        toDate,
      }),
    [rows, quotes, providerFilter, overrideFilter, fromDate, toDate],
  );

  const exportToCSV = () => {
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quote_audit_log_test.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <span data-testid="visible-count">{filtered.length}</span>
      <button onClick={() => setProviderFilter("pA")}>filter-pA</button>
      <button onClick={() => setOverrideFilter("yes")}>filter-override-yes</button>
      <button onClick={() => setFromDate("2026-03-01")}>filter-from</button>
      <button onClick={() => setToDate("2026-03-31")}>filter-to</button>
      {filtered.length > 0 && (
        <button onClick={exportToCSV}>Export CSV</button>
      )}
    </div>
  );
}

const quotes: Record<string, QuoteMeta> = {
  q1: { id: "q1", provider_id: "pA", customer_id: "cA", service_id: "s1" },
  q2: { id: "q2", provider_id: "pB", customer_id: "cB", service_id: "s2" },
  q3: { id: "q3", provider_id: "pA", customer_id: "cB", service_id: "s1" },
};
const profiles: Record<string, ProfileMeta> = {
  pA: { id: "pA", full_name: "Provider A" },
  pB: { id: "pB", full_name: "Provider B" },
  cA: { id: "cA", full_name: "Customer A" },
  cB: { id: "cB", full_name: "Customer B" },
};
const services: Record<string, ServiceMeta> = {
  s1: { id: "s1", title: "Lawn Care" },
  s2: { id: "s2", title: "Plumbing, Pro" },
};
const rows: AuditRow[] = [
  {
    id: "r1", quote_id: "q1", editor_role: "provider",
    old_price: 50, new_price: 75,
    old_description: 'He said "hi", then left',
    new_description: "after\nnewline",
    old_status: "pending", new_status: "pending",
    admin_override: false,
    created_at: "2026-01-10T12:00:00Z",
  },
  {
    id: "r2", quote_id: "q2", editor_role: "admin",
    old_price: 100, new_price: 250000,
    old_description: "", new_description: "",
    old_status: "pending", new_status: "accepted",
    admin_override: true,
    created_at: "2026-02-15T09:30:00Z",
  },
  {
    id: "r3", quote_id: "q3", editor_role: "provider",
    old_price: 30, new_price: 40,
    old_description: "", new_description: "",
    old_status: "pending", new_status: "pending",
    admin_override: false,
    created_at: "2026-03-20T18:00:00Z",
  },
];

let captured: { blob: Blob | null; download: string | null; clicked: boolean };
const blobByUrl = new Map<string, Blob>();
const blobText = new WeakMap<Blob, string>();
const RealBlob = globalThis.Blob;

beforeEach(() => {
  captured = { blob: null, download: null, clicked: false };
  blobByUrl.clear();
  // Wrap Blob so we can read back the text that was passed in.
  class SpyBlob extends RealBlob {
    constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
      super(parts, options);
      const text = parts
        .map((p) => (typeof p === "string" ? p : ""))
        .join("");
      blobText.set(this, text);
    }
  }
  vi.stubGlobal("Blob", SpyBlob);
  // jsdom does not implement these; define them so vi.spyOn can replace them.
  if (typeof (URL as any).createObjectURL !== "function") {
    (URL as any).createObjectURL = () => "";
  }
  if (typeof (URL as any).revokeObjectURL !== "function") {
    (URL as any).revokeObjectURL = () => {};
  }
  vi.spyOn(URL, "createObjectURL").mockImplementation((b: Blob | MediaSource) => {
    const url = `blob:test/${Math.random().toString(36).slice(2)}`;
    if (b instanceof Blob) blobByUrl.set(url, b);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    captured.clicked = true;
    captured.download = this.getAttribute("download");
    const blob = blobByUrl.get(this.href);
    captured.blob = blob || null;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function readDownloadedCsv(): Promise<string> {
  expect(captured.clicked).toBe(true);
  expect(captured.blob).toBeInstanceOf(RealBlob);
  const text = blobText.get(captured.blob!);
  expect(typeof text).toBe("string");
  return text!;
}

describe("CSV download button produces a file matching the filtered audit log", () => {
  it("downloads a CSV whose header and rows match all visible rows when no filters are applied", async () => {
    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );
    expect(screen.getByTestId("visible-count").textContent).toBe("3");

    fireEvent.click(screen.getByText("Export CSV"));

    const text = await readDownloadedCsv();
    expect(captured.blob!.type).toContain("text/csv");
    expect(captured.download).toMatch(/\.csv$/);

    const lines = text.split("\n");
    expect(lines[0]).toBe(AUDIT_CSV_HEADERS.join(","));

    // 3 data rows + 1 row whose description contains an embedded \n
    // (escaped + quoted) -> total \n = 3 (separators) + 1 (embedded) = 4 -> 5 parts
    expect(lines.length).toBe(5);

    expect(text).toContain('"after\nnewline"');
    expect(text).toContain('"Plumbing, Pro"');
    expect(text).toContain('"He said ""hi"", then left"');
  });

  it("downloads only filtered rows when provider + override + date filters are applied", async () => {
    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
        initialProvider="pA"
        initialOverride="no"
        initialFrom="2026-03-01"
        initialTo="2026-03-31"
      />,
    );
    expect(screen.getByTestId("visible-count").textContent).toBe("1");

    fireEvent.click(screen.getByText("Export CSV"));
    const text = await readDownloadedCsv();

    const dataLines = text.split("\n").slice(1);
    expect(dataLines.length).toBe(1);

    const fields = dataLines[0].split(",");
    expect(fields[1]).toBe("Lawn Care");
    expect(fields[2]).toBe("Provider A");
    expect(fields[5]).toBe("No");
    expect(fields[6]).toBe("30.00");
    expect(fields[7]).toBe("40.00");

    expect(text).not.toContain("Provider B");
    expect(text).not.toContain("250000");
  });

  it("re-clicking after changing filters downloads a new CSV matching the new visible set", async () => {
    render(
      <AuditExportHarness
        rows={rows}
        quotes={quotes}
        profiles={profiles}
        services={services}
      />,
    );

    fireEvent.click(screen.getByText("Export CSV"));
    let text = await readDownloadedCsv();
    expect(text.split("\n")[0]).toBe(AUDIT_CSV_HEADERS.join(","));
    // 3 rows total, one contains an embedded newline, so 5 split parts
    expect(text.split("\n").length).toBe(5);

    fireEvent.click(screen.getByText("filter-override-yes"));
    expect(screen.getByTestId("visible-count").textContent).toBe("1");

    fireEvent.click(screen.getByText("Export CSV"));
    text = await readDownloadedCsv();
    const lines = text.split("\n");
    expect(lines[0]).toBe(AUDIT_CSV_HEADERS.join(","));
    expect(lines.length).toBe(2);
    // r2 row contains "Plumbing, Pro" (escaped + quoted), so a naive split
    // would shift columns. Assert the override marker by substring instead.
    expect(lines[1]).toMatch(/,Yes,/);
    expect(lines[1]).not.toMatch(/,No,/);
  });
});
