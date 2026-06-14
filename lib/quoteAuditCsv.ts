import { format } from "date-fns";

export type AuditRow = {
  id: string;
  quote_id: string;
  edited_by_profile_id?: string | null;
  edited_by_user_id?: string | null;
  editor_role: string | null;
  old_price: number | null;
  new_price: number | null;
  old_description: string | null;
  new_description: string | null;
  old_status: string | null;
  new_status: string | null;
  admin_override: boolean;
  created_at: string;
};

export type QuoteMeta = { id: string; provider_id: string; customer_id: string; service_id: string };
export type ProfileMeta = { id: string; full_name: string | null };
export type ServiceMeta = { id: string; title: string };

export type AuditFilters = {
  providerFilter: string; // "all" or provider profile id
  overrideFilter: "all" | "yes" | "no";
  fromDate: string; // "" or YYYY-MM-DD
  toDate: string; // "" or YYYY-MM-DD
};

export function filterAuditRows(
  rows: AuditRow[],
  quotes: Record<string, QuoteMeta>,
  f: AuditFilters,
): AuditRow[] {
  return rows.filter((r) => {
    const q = quotes[r.quote_id];
    if (f.providerFilter !== "all" && q?.provider_id !== f.providerFilter) return false;
    if (f.overrideFilter === "yes" && !r.admin_override) return false;
    if (f.overrideFilter === "no" && r.admin_override) return false;
    const ts = new Date(r.created_at).getTime();
    if (f.fromDate && ts < new Date(f.fromDate + "T00:00:00").getTime()) return false;
    if (f.toDate && ts > new Date(f.toDate + "T23:59:59").getTime()) return false;
    return true;
  });
}

export function escapeCsv(value: string | null | undefined): string {
  const str = value == null ? "" : String(value);
  const needsQuotes =
    str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r");
  if (!needsQuotes) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export const AUDIT_CSV_HEADERS = [
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
];

export function buildAuditCsv(
  rows: AuditRow[],
  quotes: Record<string, QuoteMeta>,
  profiles: Record<string, ProfileMeta>,
  services: Record<string, ServiceMeta>,
): string {
  const lines = rows.map((r) => {
    const q = quotes[r.quote_id];
    const providerName = q ? profiles[q.provider_id]?.full_name || "" : "";
    const customerName = q ? profiles[q.customer_id]?.full_name || "" : "";
    const serviceTitle = q ? services[q.service_id]?.title || "" : "";
    return [
      escapeCsv(format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")),
      escapeCsv(serviceTitle),
      escapeCsv(providerName),
      escapeCsv(customerName),
      escapeCsv(r.editor_role || ""),
      escapeCsv(r.admin_override ? "Yes" : "No"),
      escapeCsv(r.old_price != null ? Number(r.old_price).toFixed(2) : ""),
      escapeCsv(r.new_price != null ? Number(r.new_price).toFixed(2) : ""),
      escapeCsv(r.old_status || ""),
      escapeCsv(r.new_status || ""),
      escapeCsv(r.old_description || ""),
      escapeCsv(r.new_description || ""),
    ].join(",");
  });
  return [AUDIT_CSV_HEADERS.join(","), ...lines].join("\n");
}