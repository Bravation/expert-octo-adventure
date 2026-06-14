import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, Briefcase, ChevronDown, ChevronUp } from "lucide-react";

type ProviderMilestone = {
  completed_bookings: number;
  current_commission_rate: number;
};

const ProviderCommissionDropdown = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [milestone, setMilestone] = useState<ProviderMilestone | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("provider_milestones")
      .select("completed_bookings, current_commission_rate")
      .eq("provider_id", profile.id)
      .single()
      .then(({ data }) => {
        if (data) setMilestone(data as any);
        else setMilestone({ completed_bookings: 0, current_commission_rate: 15 });
      });
  }, [profile]);

  if (!milestone) return null;

  const completedBookings = milestone.completed_bookings;
  const currentRate = Number(milestone.current_commission_rate);
  const nextMilestone = (Math.floor(completedBookings / 20) + 1) * 20;
  const progressToNext = ((completedBookings % 20) / 20) * 100;
  const nextRate = Math.max(5, currentRate - 1);
  const isAtMin = currentRate <= 5;
  const discount = 15 - currentRate;

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <TrendingDown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-display font-semibold text-sm">
              {t("providerIncentive.title", "Commission Incentive")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("providerIncentive.currentRate", "Current commission: {{rate}}%", { rate: currentRate })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {discount > 0 && (
            <Badge variant="default" className="bg-success/10 text-success border-success/30">
              -{discount}%
            </Badge>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Progress to next milestone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-primary" />
                {t("providerIncentive.completedBookings", "Completed bookings")}
              </span>
              <span className="font-semibold">{completedBookings}</span>
            </div>
            {!isAtMin && (
              <>
                <Progress value={progressToNext} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {t("providerIncentive.nextMilestone", "{{remaining}} more completed bookings to unlock {{nextRate}}% commission", {
                    remaining: nextMilestone - completedBookings,
                    nextRate,
                  })}
                </p>
              </>
            )}
            {isAtMin && (
              <p className="text-xs text-success font-medium">
                {t("providerIncentive.maxDiscount", "🎉 You've reached the minimum commission rate!")}
              </p>
            )}
          </div>

          {/* Tier breakdown */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("providerIncentive.tiers", "Commission Tiers")}
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {[0, 20, 40, 60, 80, 100, 120, 140, 160, 200].map((threshold) => {
                const rate = Math.max(5, 15 - Math.floor(threshold / 20));
                const isActive = completedBookings >= threshold && (threshold === 200 || completedBookings < threshold + 20);
                if (threshold > 0 && rate === 5 && Math.max(5, 15 - Math.floor((threshold - 20) / 20)) === 5) return null;
                return (
                  <div
                    key={threshold}
                    className={`flex justify-between rounded px-2 py-1 ${
                      isActive ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span>{threshold}+ {t("providerIncentive.bookings", "bookings")}</span>
                    <span>{rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderCommissionDropdown;
