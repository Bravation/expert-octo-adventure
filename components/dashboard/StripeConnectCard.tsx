import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Status = {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  stripe_account_id?: string;
};

const StripeConnectCard = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("stripe-connect-status", { body: {} });
    if (error) setStatus({ connected: false });
    else setStatus(data as Status);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startOnboarding = async () => {
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
      body: { origin: window.location.origin },
    });
    setWorking(false);
    if (error || !data?.url) {
      toast.error(error?.message || (data as any)?.error || "Failed to start onboarding");
      return;
    }
    window.location.href = data.url;
  };

  const ready = !!status?.charges_enabled && !!status?.details_submitted;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold">{t("stripeConnect.title", "Stripe Payouts")}</p>
            <p className="text-sm text-muted-foreground">
              {t("stripeConnect.subtitle", "Accept card payments and receive payouts directly. Platform fee 15%; Stripe processing 2.9% + $0.30 is added on top so you always net your full price.")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("stripeConnect.checking", "Checking status...")}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {ready ? (
              <>
                <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {t("stripeConnect.ready", "Ready")}</Badge>
                <Badge variant={status?.payouts_enabled ? "default" : "secondary"}>
                  {t("stripeConnect.payouts", "Payouts")}: {status?.payouts_enabled ? "✓" : "○"}
                </Badge>
              </>
            ) : status?.connected ? (
              <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> {t("stripeConnect.incomplete", "Onboarding incomplete")}</Badge>
            ) : (
              <Badge variant="outline">{t("stripeConnect.notConnected", "Not connected")}</Badge>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={startOnboarding} disabled={working || loading} size="sm">
            {working
              ? t("stripeConnect.opening", "Opening Stripe...")
              : ready
                ? t("stripeConnect.manage", "Manage on Stripe")
                : status?.connected
                  ? t("stripeConnect.continue", "Continue onboarding")
                  : t("stripeConnect.connect", "Connect Stripe")}
          </Button>
          {!loading && (
            <Button variant="outline" size="sm" onClick={load} disabled={working}>
              {t("stripeConnect.refresh", "Refresh")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StripeConnectCard;