import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, Star, ChevronDown, ChevronUp } from "lucide-react";

type CustomerMilestone = {
  positive_reviews: number;
  current_booking_fee_percentage: number;
};

const CommissionIncentiveDropdown = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [milestone, setMilestone] = useState<CustomerMilestone | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("customer_milestones" as any)
      .select("positive_reviews, current_booking_fee_percentage")
      .eq("customer_id", profile.id)
      .single()
      .then(({ data }) => {
        if (data) setMilestone(data as any);
        else setMilestone({ positive_reviews: 0, current_booking_fee_percentage: 10 });
      });
  }, [profile]);

  if (!milestone) return null;

  const positiveReviews = milestone.positive_reviews;
  const currentFee = Number(milestone.current_booking_fee_percentage);
  const nextMilestone = (Math.floor(positiveReviews / 10) + 1) * 10;
  const progressToNext = ((positiveReviews % 10) / 10) * 100;
  const nextFee = Math.max(3, currentFee - 1);
  const isAtMin = currentFee <= 3;
  const discount = 10 - currentFee;

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
              {t("incentive.title", "Commission Incentive")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("incentive.currentFee", "Current booking fee: {{fee}}%", { fee: currentFee })}
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
                <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                {t("incentive.positiveReviews", "Positive reviews (4-5★)")}
              </span>
              <span className="font-semibold">{positiveReviews}</span>
            </div>
            {!isAtMin && (
              <>
                <Progress value={progressToNext} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {t("incentive.nextMilestone", "{{remaining}} more positive reviews to unlock {{nextFee}}% booking fee", {
                    remaining: nextMilestone - positiveReviews,
                    nextFee,
                  })}
                </p>
              </>
            )}
            {isAtMin && (
              <p className="text-xs text-success font-medium">
                {t("incentive.maxDiscount", "🎉 You've reached the maximum discount!")}
              </p>
            )}
          </div>

          {/* Tier breakdown */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("incentive.tiers", "Discount Tiers")}
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {[0, 10, 20, 30, 40, 50, 60, 70].map((threshold) => {
                const fee = Math.max(3, 10 - Math.floor(threshold / 10));
                const isActive = positiveReviews >= threshold && (threshold === 70 || positiveReviews < threshold + 10);
                if (threshold > 0 && fee === 3 && Math.max(3, 10 - Math.floor((threshold - 10) / 10)) === 3) return null;
                return (
                  <div
                    key={threshold}
                    className={`flex justify-between rounded px-2 py-1 ${
                      isActive ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span>{threshold}+ {t("incentive.reviews", "reviews")}</span>
                    <span>{fee}%</span>
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

export default CommissionIncentiveDropdown;
