import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const PayPalReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const paymentType = searchParams.get("payment_type") || "booking_fee";

  useEffect(() => {
    const capturePayment = async () => {
      const token = searchParams.get("token");
      const bookingId = searchParams.get("booking_id");

      if (!token) {
        setStatus("error");
        setErrorMsg(t("paypal.missingToken"));
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("paypal-checkout", {
          body: {
            action: "capture-order",
            order_id: token,
            booking_id: bookingId,
            payment_type: paymentType,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || "Capture failed");
        }

        setStatus("success");
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message);
      }
    };

    capturePayment();
  }, [searchParams, t, paymentType]);

  const successTitle = paymentType === "booking_fee" 
    ? t("paypal.bookingFeeSuccessTitle", "Booking Fee Paid!") 
    : t("paypal.servicePaymentSuccessTitle", "Service Payment Complete!");

  const successMessage = paymentType === "booking_fee"
    ? t("paypal.bookingFeeSuccessMessage", "Your booking fee has been paid and the reservation is confirmed. The provider will be notified.")
    : t("paypal.servicePaymentSuccessMessage", "Your service payment has been processed successfully.");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium">{t("paypal.processing")}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-display font-bold">{successTitle}</h1>
            <p className="text-muted-foreground">{successMessage}</p>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              {t("paypal.goToDashboard")}
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-display font-bold">{t("paypal.errorTitle")}</h1>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
              {t("paypal.goToDashboard")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PayPalReturn;
