import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Star, CheckCircle, MessageSquare, CreditCard, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ReviewDialog from "./ReviewDialog";
import ChatPanel from "./ChatPanel";
import ServiceRecommendations from "@/components/services/ServiceRecommendations";
import PullToRefresh from "@/components/PullToRefresh";
import PriceAdjustmentPanel from "./PriceAdjustmentPanel";
import CommissionIncentiveDropdown from "./CommissionIncentiveDropdown";

type Booking = {
  id: string;
  status: string;
  total_price: number;
  service_price: number;
  booking_fee: number;
  booking_fee_status: string;
  service_payment_status: string;
  created_at: string;
  notes: string;
  provider_id: string;
  service_id: string;
  services?: { title: string } | null;
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning-foreground border-warning/30",
  confirmed: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-accent/10 text-accent border-accent/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const CustomerDashboard = () => {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (profile) fetchAll();
  }, [profile]);

  const fetchAll = async () => {
    const [bookingsRes, reviewsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("*, services!bookings_service_id_fkey(title)")
        .eq("customer_id", profile!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("booking_id")
        .eq("reviewer_id", profile!.id),
    ]);
    setBookings((bookingsRes.data as any) || []);
    setReviewedBookingIds(new Set((reviewsRes.data || []).map((r: any) => r.booking_id)));
    setLoading(false);
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!profile || !reviewBooking) return;
    setReviewLoading(true);
    const { error } = await supabase.from("reviews").insert({
      booking_id: reviewBooking.id,
      service_id: reviewBooking.service_id,
      provider_id: reviewBooking.provider_id,
      reviewer_id: profile.id,
      rating,
      comment: comment || null,
    });
    setReviewLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("review.success", "Review submitted! Thank you."));
      setReviewBooking(null);
      fetchAll();
    }
  };

  const handlePayService = async (booking: Booking) => {
    try {
      const returnUrl = `${window.location.origin}/paypal-return?booking_id=${booking.id}&payment_type=service_payment`;
      const cancelUrl = `${window.location.origin}/dashboard`;
      const { data: paypalData, error: paypalError } = await supabase.functions.invoke("paypal-checkout", {
        body: {
          action: "create-order",
          booking_id: booking.id,
          amount: Number(booking.service_price),
          payment_type: "service_payment",
          currency: "USD",
          description: `Service Payment - ${(booking as any).services?.title || "Service"}`,
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      });
      if (paypalError || !paypalData?.success) {
        throw new Error(paypalData?.error || paypalError?.message || "PayPal error");
      }
      if (paypalData.approval_url) {
        window.location.href = paypalData.approval_url;
      }
    } catch (err: any) {
      toast.error(err.message || "PayPal checkout failed");
    }
  };

  const handleRefresh = useCallback(async () => {
    await fetchAll();
  }, [profile]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div>

      {/* Commission Incentive Dropdown */}
      <div className="mb-6">
        <CommissionIncentiveDropdown />
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="mt-10 rounded-xl border-2 border-dashed p-12 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium">{t("customerDashboard.noBookings")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("customerDashboard.noBookingsHint")}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {bookings.map((booking) => {
            const isCompleted = booking.status === "completed";
            const isReviewed = reviewedBookingIds.has(booking.id);

            return (
              <Card key={booking.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-display font-semibold">
                        {(booking as any).services?.title || t("customerDashboard.service")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isCompleted && !isReviewed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setReviewBooking(booking)}
                        >
                          <Star className="h-3.5 w-3.5" />
                          {t("review.leaveReview", "Leave Review")}
                        </Button>
                      )}
                      {isCompleted && isReviewed && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                          {t("review.reviewed", "Reviewed")}
                        </span>
                      )}
                      <Badge variant="outline" className={statusColors[booking.status] || ""}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  {/* Payment Breakdown */}
                  <div className="flex flex-wrap items-center gap-3 text-sm border-t pt-3">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{t("booking.bookingFee")}:</span>
                      <span className="font-medium">${Number(booking.booking_fee || 0).toFixed(2)}</span>
                      <Badge variant={booking.booking_fee_status === 'paid' ? 'default' : 'secondary'} className="text-xs ml-1">
                        {booking.booking_fee_status === 'paid' ? t("booking.bookingFeePaid") : t("booking.bookingFeeUnpaid")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{t("booking.servicePrice")}:</span>
                      <span className="font-medium">${Number(booking.service_price || 0).toFixed(2)}</span>
                      <Badge variant={booking.service_payment_status === 'paid' ? 'default' : 'secondary'} className="text-xs ml-1">
                        {booking.service_payment_status === 'paid' ? t("booking.servicePaymentPaid") : t("booking.servicePaymentUnpaid")}
                      </Badge>
                    </div>
                    <span className="font-display font-bold text-primary ml-auto">
                      {t("booking.total")}: ${Number(booking.total_price).toFixed(2)}
                    </span>
                  </div>
                  {/* Price Adjustments */}
                  <PriceAdjustmentPanel
                    bookingId={booking.id}
                    currentPrice={Number(booking.service_price)}
                    bookingStatus={booking.status}
                    onPriceUpdated={fetchAll}
                  />
                  {/* Pay Service button if booking is completed and service unpaid */}
                  {booking.status === "completed" && booking.service_payment_status !== "paid" && (
                    <Button
                      size="sm"
                      className="w-full sm:w-auto bg-[hsl(var(--paypal-blue))] hover:bg-[hsl(var(--paypal-blue))]/90 text-white gap-2"
                      onClick={() => handlePayService(booking)}
                    >
                      <CreditCard className="h-4 w-4" />
                      {t("booking.payServiceViaPayPal", "Pay Service ${{amount}} via PayPal").replace("{{amount}}", Number(booking.service_price || 0).toFixed(2))}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Service Recommendations */}
      <div className="mt-10">
        <ServiceRecommendations 
          onBook={(service) => {
            // For now, just show a toast since we don't have full booking flow in dashboard
            toast.info(`Booking feature coming soon for ${service.title}`);
          }}
          onRequestQuote={(service) => {
            toast.info(`Quote request feature coming soon for ${service.title}`);
          }}
          limit={6}
        />
      </div>

      {/* Messages Section */}
      <div className="mt-10">
        <ChatPanel />
      </div>

      <ReviewDialog
        open={!!reviewBooking}
        onOpenChange={(open) => !open && setReviewBooking(null)}
        serviceName={(reviewBooking as any)?.services?.title || ""}
        onSubmit={handleSubmitReview}
        loading={reviewLoading}
      />
    </div>
    </PullToRefresh>
  );
};

export default CustomerDashboard;
