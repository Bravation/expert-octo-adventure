import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Filter, ShieldAlert, ArrowRight, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  filterAuditRows,
  buildAuditCsv,
  type AuditRow as AuditRowT,
  type QuoteMeta as QuoteMetaT,
  type ProfileMeta as ProfileMetaT,
  type ServiceMeta as ServiceMetaT,
} from "@/lib/quoteAuditCsv";

type AuditRow = {
  id: string;
  quote_id: string;
  edited_by_profile_id: string | null;
  edited_by_user_id: string | null;
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

type QuoteMeta = { id: string; provider_id: string; customer_id: string; service_id: string };
type ProfileMeta = { id: string; full_name: string | null };
type ServiceMeta = { id: string; title: string };

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(2)}`;

const AdminQuoteAuditLog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteMeta>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileMeta>>({});
  const [services, setServices] = useState<Record<string, ServiceMeta>>({});

  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [overrideFilter, setOverrideFilter] = useState<"all" | "yes" | "no">("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const isExportingRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin" as const,
      });
      if (!data) {
        toast.error("You don't have admin access");
        navigate("/dashboard");
        return;
      }
      setIsAdmin(true);
    })();
  }, [user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("quote_edit_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      const auditRows = (data || []) as AuditRow[];
      setRows(auditRows);

      const quoteIds = Array.from(new Set(auditRows.map((r) => r.quote_id)));
      if (quoteIds.length) {
        const { data: qData } = await supabase
          .from("custom_quotes")
          .select("id, provider_id, customer_id, service_id")
          .in("id", quoteIds);
        const qMap: Record<string, QuoteMeta> = {};
        ((qData as any[]) || []).forEach((q) => (qMap[q.id] = q));
        setQuotes(qMap);

        const profileIds = Array.from(
          new Set(
            Object.values(qMap)
              .flatMap((q) => [q.provider_id, q.customer_id])
              .filter(Boolean),
          ),
        );
        const serviceIds = Array.from(new Set(Object.values(qMap).map((q) => q.service_id).filter(Boolean)));

        if (profileIds.length) {
          const { data: pData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", profileIds);
          const pMap: Record<string, ProfileMeta> = {};
          ((pData as any[]) || []).forEach((p) => (pMap[p.id] = p));
          setProfiles(pMap);
        }
        if (serviceIds.length) {
          const { data: sData } = await supabase
            .from("services")
            .select("id, title")
            .in("id", serviceIds);
          const sMap: Record<string, ServiceMeta> = {};
          ((sData as any[]) || []).forEach((s) => (sMap[s.id] = s));
          setServices(sMap);
        }
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  const providerOptions = useMemo(() => {
    const ids = Array.from(
      new Set(Object.values(quotes).map((q) => q.provider_id).filter(Boolean)),
    );
    return ids
      .map((id) => ({ id, name: profiles[id]?.full_name || id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [quotes, profiles]);

  const filtered = useMemo(() => {
    return filterAuditRows(rows, quotes, {
      providerFilter,
      overrideFilter,
      fromDate,
      toDate,
    });
  }, [rows, quotes, providerFilter, overrideFilter, fromDate, toDate]);

  const resetFilters = () => {
    setProviderFilter("all");
    setOverrideFilter("all");
    setFromDate("");
    setToDate("");
  };

  const hasFilters =
    providerFilter !== "all" || overrideFilter !== "all" || !!fromDate || !!toDate;

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
      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
      link.download = `quote_audit_log_${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      didSucceed = true;
    } catch (err) {
      console.error("CSV export failed", err);
      const message = err instanceof Error && err.message ? err.message : "Unknown error";
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
  }, [filtered, quotes, profiles, services]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <BackButton fallback="/dashboard" showLabel={false} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold font-display">Quote Edit Audit Log</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Every change made to a custom quote · <span className="font-medium text-foreground">{filtered.length}</span> shown
              {rows.length !== filtered.length && ` of ${rows.length}`}
            </p>
          </div>
          {!loading && filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Export CSV
            </Button>
          )}
        </div>

        <Card className="mb-6">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" /> Provider
              </Label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {providerOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Admin override
              </Label>
              <Select value={overrideFilter} onValueChange={(v) => setOverrideFilter(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="yes">Override used</SelectItem>
                  <SelectItem value="no">No override</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="from">From</Label>
              <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="to">To</Label>
              <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            {hasFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="mr-1 h-3 w-3" /> Reset filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No audit entries match the current filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const q = quotes[r.quote_id];
              const providerName = q ? profiles[q.provider_id]?.full_name || "Unknown provider" : "—";
              const customerName = q ? profiles[q.customer_id]?.full_name || "Unknown customer" : "—";
              const serviceTitle = q ? services[q.service_id]?.title || "Service" : "—";
              const priceChanged = r.old_price !== r.new_price;
              const statusChanged = r.old_status !== r.new_status;
              const descChanged = (r.old_description || "") !== (r.new_description || "");
              return (
                <Card key={r.id} className="overflow-hidden">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold leading-tight">{serviceTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {providerName} <span className="opacity-50">·</span> requested by {customerName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.editor_role && (
                          <Badge variant="outline" className="text-xs capitalize">{r.editor_role.replace("_", " ")}</Badge>
                        )}
                        {r.admin_override && (
                          <Badge variant="destructive" className="text-xs">
                            <ShieldAlert className="mr-1 h-3 w-3" /> Admin override
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "MMM d, yyyy · HH:mm")}
                        </span>
                      </div>
                    </div>

                    {priceChanged && (
                      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground">Price</span>
                        <span className="font-medium">{fmtMoney(r.old_price)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={`font-semibold ${r.admin_override ? "text-destructive" : "text-primary"}`}>
                          {fmtMoney(r.new_price)}
                        </span>
                      </div>
                    )}

                    {statusChanged && (
                      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground">Status</span>
                        <Badge variant="secondary" className="text-xs">{r.old_status || "—"}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge className="text-xs">{r.new_status || "—"}</Badge>
                      </div>
                    )}

                    {descChanged && (
                      <details className="rounded-md border bg-background p-3 text-xs">
                        <summary className="cursor-pointer font-medium text-muted-foreground">Description changed</summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Before</p>
                            <pre className="whitespace-pre-wrap font-sans text-foreground/80">{r.old_description || "—"}</pre>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">After</p>
                            <pre className="whitespace-pre-wrap font-sans text-foreground">{r.new_description || "—"}</pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQuoteAuditLog;