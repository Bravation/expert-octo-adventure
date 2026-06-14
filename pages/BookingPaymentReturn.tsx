import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const BookingPaymentReturn = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "success" | "pending" | "cancelled" | "error">("loading");
  const bookingId = params.get("booking_id");
  const cancelled = params.get("cancelled");

  useEffect(() => {
    if (cancelled) { setState("cancelled"); return; }
    if (!bookingId) { setState("error"); return; }

    let tries = 0;
    let timer: any;
    const poll = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("service_payment_status")
        .eq("id", bookingId)
        .single();
      const s = (data as any)?.service_payment_status;
      if (s === "paid") { setState("success"); return; }
      if (s === "failed") { setState("error"); return; }
      tries += 1;
      if (tries > 15) { setState("pending"); return; }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, [bookingId, cancelled]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {state === "loading" && (<><Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" /><p className="text-lg">{t("bookingPayment.processing", "Confirming your payment...")}</p></>)}
        {state === "success" && (<><CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" /><h1 className="text-2xl font-display font-bold">{t("bookingPayment.successTitle", "Payment Successful")}</h1><p className="text-muted-foreground">{t("bookingPayment.successMsg", "Your booking is confirmed and the provider has been notified.")}</p><Button className="w-full" onClick={() => navigate("/dashboard")}>{t("bookingPayment.dashboard", "Go to Dashboard")}</Button></>)}
        {state === "pending" && (<><Loader2 className="h-12 w-12 text-primary mx-auto" /><h1 className="text-2xl font-display font-bold">{t("bookingPayment.pendingTitle", "Payment Pending")}</h1><p className="text-muted-foreground">{t("bookingPayment.pendingMsg", "We're still waiting for confirmation. You'll see the update in your dashboard shortly.")}</p><Button className="w-full" onClick={() => navigate("/dashboard")}>{t("bookingPayment.dashboard", "Go to Dashboard")}</Button></>)}
        {state === "cancelled" && (<><XCircle className="h-16 w-16 text-muted-foreground mx-auto" /><h1 className="text-2xl font-display font-bold">{t("bookingPayment.cancelledTitle", "Payment Cancelled")}</h1><p className="text-muted-foreground">{t("bookingPayment.cancelledMsg", "You cancelled the checkout. The booking is still saved — you can try again from your dashboard.")}</p><Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>{t("bookingPayment.dashboard", "Go to Dashboard")}</Button></>)}
        {state === "error" && (<><XCircle className="h-16 w-16 text-destructive mx-auto" /><h1 className="text-2xl font-display font-bold">{t("bookingPayment.errorTitle", "Payment Error")}</h1><p className="text-muted-foreground">{t("bookingPayment.errorMsg", "Something went wrong with your payment. Please try again or contact support.")}</p><Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>{t("bookingPayment.dashboard", "Go to Dashboard")}</Button></>)}
      </div>
    </div>
  );
};

export default BookingPaymentReturn;