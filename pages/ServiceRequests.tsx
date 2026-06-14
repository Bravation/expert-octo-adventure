import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, X, Inbox, User } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type ServiceRequest = {
  id: string;
  service_id: string;
  customer_id: string;
  provider_id: string;
  custom_price: number;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  service?: { title: string; category: string | null; price: number } | null;
  customer?: { full_name: string; avatar_url: string | null; city: string | null; state: string | null } | null;
};

const statusVariant = (status: string) => {
  switch (status) {
    case "accepted": return "default";
    case "declined": return "destructive";
    default: return "secondary";
  }
};

const ServiceRequests = () => {
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (profile && profile.role !== "service_provider") {
      toast.error(t("serviceRequests.onlyProviders", "Only providers can view service requests"));
      navigate("/dashboard");
      return;
    }
    if (profile?.id) fetchRequests(profile.id);
  }, [authLoading, user, profile, navigate, t]);

  const fetchRequests = async (providerId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_quotes")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as any[];
    const serviceIds = Array.from(new Set(rows.map((r) => r.service_id).filter(Boolean)));
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)));

    const [servicesRes, profilesRes] = await Promise.all([
      serviceIds.length
        ? supabase.from("services").select("id, title, category, price").in("id", serviceIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      customerIds.length
        ? supabase
            .from("public_provider_profiles" as any)
            .select("id, full_name, avatar_url, city, state")
            .in("id", customerIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const serviceMap = new Map(((servicesRes.data as any[]) || []).map((s) => [s.id, s]));
    const profileMap = new Map(((profilesRes.data as any[]) || []).map((p) => [p.id, p]));

    // Fallback: if customer profile not surfaced via public view, fetch minimal name from profiles directly
    const missingCustomers = customerIds.filter((id) => !profileMap.has(id));
    if (missingCustomers.length) {
      const { data: extra } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city, state")
        .in("id", missingCustomers);
      ((extra as any[]) || []).forEach((p) => profileMap.set(p.id, p));
    }

    setRequests(
      rows.map((r) => ({
        ...r,
        service: serviceMap.get(r.service_id) || null,
        customer: profileMap.get(r.customer_id) || null,
      })),
    );
    setLoading(false);
  };

  const updateStatus = async (id: string, status: "accepted" | "declined") => {
    setActingId(id);
    const { error } = await supabase.from("custom_quotes").update({ status }).eq("id", id);
    setActingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      status === "accepted"
        ? t("serviceRequests.accepted", "Request accepted")
        : t("serviceRequests.declined", "Request declined"),
    );
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const pending = requests.filter((r) => r.status === "pending");
  const accepted = requests.filter((r) => r.status === "accepted");
  const declined = requests.filter((r) => r.status === "declined");

  const renderList = (list: ServiceRequest[]) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">{t("serviceRequests.empty", "No requests here yet")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {list.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="font-display text-base leading-tight">
                    {r.service?.title || t("serviceRequests.unknownService", "Service")}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(r.status) as any}>
                    {t(`serviceRequests.status.${r.status}`, r.status)}
                  </Badge>
                  <span className="rounded-md bg-primary/10 px-2 py-1 font-display text-sm font-bold text-primary">
                    ${Number(r.custom_price).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {r.customer?.avatar_url ? (
                    <img src={r.customer.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.customer?.full_name || t("serviceRequests.unknownCustomer", "Customer")}
                  </p>
                  {(r.customer?.city || r.customer?.state) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[r.customer?.city, r.customer?.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {r.description && (
                <pre className="whitespace-pre-wrap rounded-md border bg-background p-3 font-sans text-sm text-foreground">
                  {r.description}
                </pre>
              )}

              {r.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => updateStatus(r.id, "accepted")}
                    disabled={actingId === r.id}
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    {t("serviceRequests.accept", "Accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => updateStatus(r.id, "declined")}
                    disabled={actingId === r.id}
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    {t("serviceRequests.decline", "Decline")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6">
          <BackButton fallback="/dashboard" className="mb-2" />
          <h1 className="font-display text-3xl font-bold">
            {t("serviceRequests.heading", "Service Requests")}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ({t("nav.provider", "Provider")})
            </span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("serviceRequests.subtitle", "Review and respond to incoming requests from customers.")}
          </p>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pending">
              {t("serviceRequests.tabs.pending", "Pending")}{pending.length > 0 && ` (${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="accepted">
              {t("serviceRequests.tabs.accepted", "Accepted")}{accepted.length > 0 && ` (${accepted.length})`}
            </TabsTrigger>
            <TabsTrigger value="declined">
              {t("serviceRequests.tabs.declined", "Declined")}{declined.length > 0 && ` (${declined.length})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending">{renderList(pending)}</TabsContent>
          <TabsContent value="accepted">{renderList(accepted)}</TabsContent>
          <TabsContent value="declined">{renderList(declined)}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ServiceRequests;