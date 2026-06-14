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
import { Inbox, User, ArrowRight, Check, X, Clock, Send } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

type MyRequest = {
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
  provider?: { full_name: string; avatar_url: string | null; city: string | null; state: string | null } | null;
};

const statusVariant = (status: string) => {
  switch (status) {
    case "accepted": return "default";
    case "declined": return "destructive";
    default: return "secondary";
  }
};

type TimelineStep = {
  key: "submitted" | "review" | "resolved";
  label: string;
  icon: typeof Check;
  date?: string;
  state: "done" | "current" | "upcoming" | "rejected";
};

const QuoteTimeline = ({ request }: { request: MyRequest }) => {
  const { t } = useTranslation();
  const isAccepted = request.status === "accepted";
  const isDeclined = request.status === "declined";
  const isPending = !isAccepted && !isDeclined;

  const steps: TimelineStep[] = [
    {
      key: "submitted",
      label: t("myRequests.timeline.submitted", "Submitted"),
      icon: Send,
      date: request.created_at,
      state: "done",
    },
    {
      key: "review",
      label: t("myRequests.timeline.review", "Under Review"),
      icon: Clock,
      date: isPending ? undefined : request.created_at,
      state: isPending ? "current" : "done",
    },
    {
      key: "resolved",
      label: isDeclined
        ? t("myRequests.timeline.declined", "Declined")
        : t("myRequests.timeline.accepted", "Accepted"),
      icon: isDeclined ? X : Check,
      date: isPending ? undefined : request.updated_at,
      state: isAccepted ? "done" : isDeclined ? "rejected" : "upcoming",
    },
  ];

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("myRequests.timeline.title", "Status Timeline")}
      </p>
      <ol className="flex items-start justify-between gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isLast = i === steps.length - 1;
          const dotClasses = cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
            step.state === "done" && "border-primary bg-primary text-primary-foreground",
            step.state === "current" &&
              "border-primary bg-primary/10 text-primary animate-pulse",
            step.state === "rejected" &&
              "border-destructive bg-destructive text-destructive-foreground",
            step.state === "upcoming" &&
              "border-border bg-background text-muted-foreground",
          );
          const connectorClasses = cn(
            "mt-4 h-0.5 flex-1",
            step.state === "done" || step.state === "rejected"
              ? step.state === "rejected"
                ? "bg-destructive/40"
                : "bg-primary"
              : "bg-border",
          );
          return (
            <li key={step.key} className="flex flex-1 items-start gap-0">
              <div className="flex min-w-0 flex-col items-center">
                <div className={dotClasses}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-1.5 text-center text-[11px] font-medium leading-tight">
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-center text-[10px] text-muted-foreground">
                    {format(new Date(step.date), "MMM d, p")}
                  </p>
                )}
              </div>
              {!isLast && <div className={connectorClasses} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const MyRequests = () => {
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (profile?.id) fetchRequests(profile.id);
  }, [authLoading, user, profile, navigate]);

  const fetchRequests = async (customerId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_quotes")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      return;
    }

    const rows = (data || []) as any[];
    const serviceIds = Array.from(new Set(rows.map((r) => r.service_id).filter(Boolean)));
    const providerIds = Array.from(new Set(rows.map((r) => r.provider_id).filter(Boolean)));

    const [servicesRes, profilesRes] = await Promise.all([
      serviceIds.length
        ? supabase.from("services").select("id, title, category, price").in("id", serviceIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      providerIds.length
        ? supabase
            .from("public_provider_profiles" as any)
            .select("id, full_name, avatar_url, city, state")
            .in("id", providerIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const serviceMap = new Map(((servicesRes.data as any[]) || []).map((s) => [s.id, s]));
    const profileMap = new Map(((profilesRes.data as any[]) || []).map((p) => [p.id, p]));

    const missingProviders = providerIds.filter((id) => !profileMap.has(id));
    if (missingProviders.length) {
      const { data: extra } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city, state")
        .in("id", missingProviders);
      ((extra as any[]) || []).forEach((p) => profileMap.set(p.id, p));
    }

    setRequests(
      rows.map((r) => ({
        ...r,
        service: serviceMap.get(r.service_id) || null,
        provider: profileMap.get(r.provider_id) || null,
      })),
    );
    setLoading(false);
  };

  const submitted = requests.filter((r) => r.status === "pending");
  const accepted = requests.filter((r) => r.status === "accepted");
  const declined = requests.filter((r) => r.status === "declined");

  const renderList = (list: MyRequest[]) => {
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
          <p className="text-sm">{t("myRequests.empty", "No requests here yet")}</p>
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
                    {r.service?.title || t("myRequests.unknownService", "Service")}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(r.status) as any}>
                    {t(`myRequests.status.${r.status}`, r.status)}
                  </Badge>
                  <span className="rounded-md bg-primary/10 px-2 py-1 font-display text-sm font-bold text-primary">
                    ${Number(r.custom_price).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <QuoteTimeline request={r} />

              <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {r.provider?.avatar_url ? (
                    <img src={r.provider.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.provider?.full_name || t("myRequests.unknownProvider", "Provider")}
                  </p>
                  {(r.provider?.city || r.provider?.state) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[r.provider?.city, r.provider?.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {r.description && (
                <pre className="whitespace-pre-wrap rounded-md border bg-background p-3 font-sans text-sm text-foreground">
                  {r.description}
                </pre>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/provider/${r.provider_id}`)}
              >
                {t("myRequests.viewProvider", "View Provider")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
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
            {t("myRequests.heading", "My Service Requests")}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ({t("nav.customer", "Customer")})
            </span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("myRequests.subtitle", "Track the status of all your service requests.")}
          </p>
        </div>

        <Tabs defaultValue="submitted" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="submitted">
              {t("myRequests.tabs.submitted", "Submitted")}{submitted.length > 0 && ` (${submitted.length})`}
            </TabsTrigger>
            <TabsTrigger value="accepted">
              {t("myRequests.tabs.accepted", "Accepted")}{accepted.length > 0 && ` (${accepted.length})`}
            </TabsTrigger>
            <TabsTrigger value="declined">
              {t("myRequests.tabs.declined", "Declined")}{declined.length > 0 && ` (${declined.length})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="submitted">{renderList(submitted)}</TabsContent>
          <TabsContent value="accepted">{renderList(accepted)}</TabsContent>
          <TabsContent value="declined">{renderList(declined)}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyRequests;
