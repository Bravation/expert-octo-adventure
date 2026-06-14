import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ArrowRight, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type PriceAdjustment = {
  id: string;
  booking_id: string;
  old_price: number;
  new_price: number;
  reason: string | null;
  status: string;
  proposed_by: string;
  created_at: string;
};

type PriceAdjustmentPanelProps = {
  bookingId: string;
  currentPrice: number;
  bookingStatus: string;
  onPriceUpdated?: () => void;
};

const PriceAdjustmentPanel = ({
  bookingId,
  currentPrice,
  bookingStatus,
  onPriceUpdated,
}: PriceAdjustmentPanelProps) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdjustments();

    const channel = supabase
      .channel(`price-adjustments-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "price_adjustments",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => {
          fetchAdjustments();
          onPriceUpdated?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  const fetchAdjustments = async () => {
    const { data, error } = await supabase
      .from("price_adjustments")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    if (!error) setAdjustments((data as PriceAdjustment[]) || []);
    setLoading(false);
  };

  const canPropose = ["pending", "confirmed", "in_progress"].includes(bookingStatus);
  const hasPending = adjustments.some((a) => a.status === "pending");

  const handlePropose = async () => {
    if (!profile || !newPrice) return;
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      toast.error(t("priceAdjustment.invalidPrice", "Please enter a valid price"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("price_adjustments").insert({
      booking_id: bookingId,
      old_price: currentPrice,
      new_price: price,
      reason: reason || null,
      proposed_by: profile.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("priceAdjustment.proposed", "Price adjustment proposed"));
      setNewPrice("");
      setReason("");
      setShowForm(false);
      fetchAdjustments();
    }
  };

  const handleRespond = async (adjustmentId: string, accept: boolean) => {
    const status = accept ? "accepted" : "rejected";
    const { error } = await supabase
      .from("price_adjustments")
      .update({ status })
      .eq("id", adjustmentId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        accept
          ? t("priceAdjustment.accepted", "Price adjustment accepted")
          : t("priceAdjustment.rejected", "Price adjustment rejected")
      );
      fetchAdjustments();
      if (accept) onPriceUpdated?.();
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30 text-xs">Pending</Badge>;
      case "accepted":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">Accepted</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (loading) return null;

  return (
    <Collapsible>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2">
            <DollarSign className="h-3 w-3" />
            {t("priceAdjustment.title", "Price Adjustments")}
            {adjustments.filter((a) => a.status === "pending" && a.proposed_by !== profile?.id).length > 0 && (
              <Badge className="h-4 px-1 text-[10px] bg-warning text-warning-foreground">
                {adjustments.filter((a) => a.status === "pending" && a.proposed_by !== profile?.id).length}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-2 space-y-2">
        {/* Pending adjustments needing response */}
        {adjustments
          .filter((a) => a.status === "pending" && a.proposed_by !== profile?.id)
          .map((adj) => (
            <div
              key={adj.id}
              className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">${Number(adj.old_price).toFixed(2)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold text-foreground">${Number(adj.new_price).toFixed(2)}</span>
                {statusBadge(adj.status)}
              </div>
              {adj.reason && (
                <p className="text-xs text-muted-foreground italic">"{adj.reason}"</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => handleRespond(adj.id, true)}
                >
                  <Check className="h-3 w-3" /> {t("priceAdjustment.accept", "Accept")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => handleRespond(adj.id, false)}
                >
                  <X className="h-3 w-3" /> {t("priceAdjustment.reject", "Reject")}
                </Button>
              </div>
            </div>
          ))}

        {/* Own pending proposals */}
        {adjustments
          .filter((a) => a.status === "pending" && a.proposed_by === profile?.id)
          .map((adj) => (
            <div
              key={adj.id}
              className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-3"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">${Number(adj.old_price).toFixed(2)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold">${Number(adj.new_price).toFixed(2)}</span>
                {statusBadge(adj.status)}
                <span className="text-xs text-muted-foreground ml-auto">
                  {t("priceAdjustment.yourProposal", "Your proposal")}
                </span>
              </div>
              {adj.reason && (
                <p className="text-xs text-muted-foreground italic">"{adj.reason}"</p>
              )}
            </div>
          ))}

        {/* Past adjustments (accepted/rejected) */}
        {adjustments
          .filter((a) => a.status !== "pending")
          .slice(0, 3)
          .map((adj) => (
            <div
              key={adj.id}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-2 text-sm"
            >
              <span className="text-muted-foreground">${Number(adj.old_price).toFixed(2)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className={adj.status === "accepted" ? "font-semibold text-success" : "line-through text-muted-foreground"}>
                ${Number(adj.new_price).toFixed(2)}
              </span>
              {statusBadge(adj.status)}
            </div>
          ))}

        {/* Propose form */}
        {canPropose && !hasPending && !showForm && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3 w-3" />
            {t("priceAdjustment.propose", "Propose Price Change")}
          </Button>
        )}

        {showForm && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t("priceAdjustment.currentPrice", "Current")}: ${Number(currentPrice).toFixed(2)}
              </span>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={t("priceAdjustment.newPricePlaceholder", "New price")}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="h-8 text-sm"
            />
            <Textarea
              placeholder={t("priceAdjustment.reasonPlaceholder", "Reason (optional)")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handlePropose}
                disabled={submitting || !newPrice}
              >
                {submitting ? "..." : t("priceAdjustment.submit", "Submit")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setShowForm(false);
                  setNewPrice("");
                  setReason("");
                }}
              >
                {t("priceAdjustment.cancel", "Cancel")}
              </Button>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default PriceAdjustmentPanel;
