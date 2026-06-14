import { describe, it, expect } from "vitest";
import {
  filterAuditRows,
  buildAuditCsv,
  AUDIT_CSV_HEADERS,
  type AuditRow,
  type QuoteMeta,
  type ProfileMeta,
  type ServiceMeta,
} from "@/lib/quoteAuditCsv";

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
    old_price: 50, new_price: 75, old_description: "", new_description: "",
    old_status: "pending", new_status: "pending", admin_override: false,
    created_at: "2026-01-10T12:00:00Z",
  },
  {
    id: "r2", quote_id: "q2", editor_role: "admin",
    old_price: 100, new_price: 250000, old_description: "", new_description: "",
    old_status: "pending", new_status: "accepted", admin_override: true,
    created_at: "2026-02-15T09:30:00Z",
  },
  {
    id: "r3", quote_id: "q3", editor_role: "provider",
    old_price: 30, new_price: 40, old_description: "", new_description: "",
    old_status: "pending", new_status: "pending", admin_override: false,
    created_at: "2026-03-20T18:00:00Z",
  },
];

function csvRowCount(csv: string) {
  return csv.split("\n").length - 1; // minus header
}

describe("quote audit CSV export reflects active filters", () => {
  it("with no filters: exports every row", () => {
    const filtered = filterAuditRows(rows, quotes, {
      providerFilter: "all", overrideFilter: "all", fromDate: "", toDate: "",
    });
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    expect(filtered).toHaveLength(3);
    expect(csvRowCount(csv)).toBe(3);
    expect(csv.split("\n")[0]).toBe(AUDIT_CSV_HEADERS.join(","));
  });

  it("provider filter narrows CSV to that provider only", () => {
    const filtered = filterAuditRows(rows, quotes, {
      providerFilter: "pA", overrideFilter: "all", fromDate: "", toDate: "",
    });
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    expect(filtered.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(csvRowCount(csv)).toBe(2);
    expect(csv).toContain("Provider A");
    expect(csv).not.toContain("Provider B");
  });

  it("admin override = yes returns only override rows", () => {
    const filtered = filterAuditRows(rows, quotes, {
      providerFilter: "all", overrideFilter: "yes", fromDate: "", toDate: "",
    });
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    expect(filtered.map((r) => r.id)).toEqual(["r2"]);
    expect(csvRowCount(csv)).toBe(1);
    expect(csv).toContain(",Yes,");
    expect(csv).not.toContain(",No,");
  });

  it("admin override = no excludes override rows", () => {
    const filtered = filterAuditRows(rows, quotes, {
      providerFilter: "all", overrideFilter: "no", fromDate: "", toDate: "",
    });
    expect(filtered.map((r) => r.id)).toEqual(["r1", "r3"]);
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    expect(csv).not.toContain(",Yes,");
  });

  it("date range bounds CSV to inclusive range", () => {
    const filtered = filterAuditRows(rows, quotes, {
      providerFilter: "all", overrideFilter: "all",
      fromDate: "2026-02-01", toDate: "2026-02-28",
    });
    expect(filtered.map((r) => r.id)).toEqual(["r2"]);
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    expect(csvRowCount(csv)).toBe(1);
  });

  it("combined filters compose correctly", () => {
    const filtered = filterAuditRows(rows, quotes, {
      providerFilter: "pA", overrideFilter: "no",
      fromDate: "2026-03-01", toDate: "2026-03-31",
    });
    expect(filtered.map((r) => r.id)).toEqual(["r3"]);
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    expect(csvRowCount(csv)).toBe(1);
    expect(csv).toContain("Provider A");
    expect(csv).toContain("Customer B");
  });

  it("CSV row count always matches filtered length (export === visible)", () => {
    const scenarios = [
      { providerFilter: "all", overrideFilter: "all", fromDate: "", toDate: "" },
      { providerFilter: "pB", overrideFilter: "all", fromDate: "", toDate: "" },
      { providerFilter: "all", overrideFilter: "yes", fromDate: "", toDate: "" },
      { providerFilter: "pA", overrideFilter: "no", fromDate: "2026-01-01", toDate: "2026-01-31" },
    ] as const;
    for (const f of scenarios) {
      const filtered = filterAuditRows(rows, quotes, f);
      const csv = buildAuditCsv(filtered, quotes, profiles, services);
      expect(csvRowCount(csv)).toBe(filtered.length);
    }
  });

  it("escapes values containing commas", () => {
    const filtered = filterAuditRows(rows, quotes, {
      providerFilter: "pB", overrideFilter: "all", fromDate: "", toDate: "",
    });
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    expect(csv).toContain('"Plumbing, Pro"');
  });
});

describe("quote audit CSV header order, data types, and escaping", () => {
  it("emits headers in the documented order as the first line", () => {
    const csv = buildAuditCsv([], quotes, profiles, services);
    const header = csv.split("\n")[0];
    expect(header).toBe(
      [
        "Date",
        "Service",
        "Provider",
        "Customer",
        "Editor Role",
        "Admin Override",
        "Old Price",
        "New Price",
        "Old Status",
        "New Status",
        "Description Before",
        "Description After",
      ].join(","),
    );
    expect(header).toBe(AUDIT_CSV_HEADERS.join(","));
  });

  it("formats data columns with expected types: date string, 2dp prices, Yes/No override", () => {
    const filtered = filterAuditRows([rows[0]], quotes, {
      providerFilter: "all", overrideFilter: "all", fromDate: "", toDate: "",
    });
    const csv = buildAuditCsv(filtered, quotes, profiles, services);
    const dataLine = csv.split("\n")[1].split(",");
    // Date is yyyy-MM-dd HH:mm:ss
    expect(dataLine[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(dataLine[1]).toBe("Lawn Care");
    expect(dataLine[2]).toBe("Provider A");
    expect(dataLine[3]).toBe("Customer A");
    expect(dataLine[4]).toBe("provider");
    expect(dataLine[5]).toBe("No");
    // Prices have two decimals
    expect(dataLine[6]).toBe("50.00");
    expect(dataLine[7]).toBe("75.00");
    expect(dataLine[8]).toBe("pending");
    expect(dataLine[9]).toBe("pending");
  });

  it("renders Yes for admin_override and No otherwise", () => {
    // Use rows whose joined metadata has no commas so naive split works
    const csv = buildAuditCsv([rows[0], rows[2]], quotes, profiles, services);
    const lines = csv.split("\n").slice(1);
    expect(lines[0].split(",")[5]).toBe("No");
    expect(lines[1].split(",")[5]).toBe("No");
    const csv2 = buildAuditCsv(
      [{ ...rows[1], quote_id: "q1" }], // q1 -> Lawn Care (no comma)
      quotes, profiles, services,
    );
    expect(csv2.split("\n")[1].split(",")[5]).toBe("Yes");
  });

  it("renders empty cells (not 'null') for null prices and descriptions", () => {
    const nullRow: AuditRow = {
      id: "rN", quote_id: "q1", editor_role: null,
      old_price: null, new_price: null,
      old_description: null, new_description: null,
      old_status: null, new_status: null,
      admin_override: false,
      created_at: "2026-04-01T00:00:00Z",
    };
    const csv = buildAuditCsv([nullRow], quotes, profiles, services);
    const cells = csv.split("\n")[1].split(",");
    // Date(0), Service(1), Provider(2), Customer(3) populated; rest empty
    expect(cells[4]).toBe(""); // editor role
    expect(cells[5]).toBe("No"); // override
    expect(cells[6]).toBe(""); // old price
    expect(cells[7]).toBe(""); // new price
    expect(cells[8]).toBe(""); // old status
    expect(cells[9]).toBe(""); // new status
    expect(cells[10]).toBe(""); // desc before
    expect(cells[11]).toBe(""); // desc after
    expect(csv).not.toContain("null");
  });

  it("quotes fields with commas", () => {
    const r: AuditRow = {
      id: "rc", quote_id: "q2", editor_role: "provider",
      old_price: 1, new_price: 2,
      old_description: "a, b, c", new_description: "",
      old_status: "pending", new_status: "pending",
      admin_override: false,
      created_at: "2026-05-01T00:00:00Z",
    };
    const csv = buildAuditCsv([r], quotes, profiles, services);
    expect(csv).toContain('"Plumbing, Pro"');
    expect(csv).toContain('"a, b, c"');
  });

  it('escapes embedded double quotes by doubling them and wrapping in quotes', () => {
    const r: AuditRow = {
      id: "rq", quote_id: "q1", editor_role: "provider",
      old_price: 0, new_price: 0,
      old_description: 'He said "hello"', new_description: 'ok',
      old_status: "pending", new_status: "pending",
      admin_override: false,
      created_at: "2026-05-02T00:00:00Z",
    };
    const csv = buildAuditCsv([r], quotes, profiles, services);
    expect(csv).toContain('"He said ""hello"""');
  });

  it("preserves and quotes fields containing newlines and CR without breaking row count", () => {
    const r: AuditRow = {
      id: "rn", quote_id: "q1", editor_role: "provider",
      old_price: 0, new_price: 0,
      old_description: "line1\nline2", new_description: "carriage\rreturn",
      old_status: "pending", new_status: "pending",
      admin_override: false,
      created_at: "2026-05-03T00:00:00Z",
    };
    const csv = buildAuditCsv([r], quotes, profiles, services);
    expect(csv).toContain('"line1\nline2"');
    expect(csv).toContain('"carriage\rreturn"');
    // Header line + one data record (which itself contains an embedded \n)
    // so total \n count = 1 (header sep) + 1 (embedded) = 2
    expect(csv.split("\n").length).toBe(3);
  });

  it("does not quote plain values that need no escaping", () => {
    const csv = buildAuditCsv([rows[0]], quotes, profiles, services);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).not.toMatch(/^"/);
    expect(dataLine.split(",")[2]).toBe("Provider A"); // unquoted
  });
});