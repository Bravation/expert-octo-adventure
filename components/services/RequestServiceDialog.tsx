import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { Send, AlertCircle } from "lucide-react";
import { z } from "zod";
import type { ServiceWithProvider } from "./ServiceCard";

type RequestServiceDialogProps = {
  service: ServiceWithProvider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { preferredDate: string; preferredTime: string; location: string; details: string }) => void;
  loading?: boolean;
};

type FieldErrors = {
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  details?: string;
};

const RequestServiceDialog = ({ service, open, onOpenChange, onSubmit, loading }: RequestServiceDialogProps) => {
  const { t } = useTranslation();
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const schema = useMemo(() => {
    return z.object({
      preferredDate: z.string().min(1, t("requestService.errors.dateRequired", "Please select a preferred date")),
      preferredTime: z.string().min(1, t("requestService.errors.timeRequired", "Please select a preferred time")),
      location: z
        .string()
        .min(5, t("requestService.errors.locationMin", "Location must be at least 5 characters"))
        .max(200, t("requestService.errors.locationMax", "Location must be under 200 characters")),
      details: z
        .string()
        .min(20, t("requestService.errors.detailsMin", "Details must be at least 20 characters"))
        .max(1000, t("requestService.errors.detailsMax", "Details must be under 1000 characters")),
    }).refine(
      (data) => data.preferredDate >= todayStr,
      {
        message: t("requestService.errors.datePast", "Date cannot be in the past"),
        path: ["preferredDate"],
      }
    );
  }, [t, todayStr]);

  const validate = useCallback((): FieldErrors => {
    const result = schema.safeParse({ preferredDate, preferredTime, location: location.trim(), details: details.trim() });
    if (result.success) return {};
    const fieldErrors: FieldErrors = {};
    result.error.errors.forEach((err) => {
      const path = err.path[0] as keyof FieldErrors;
      if (!fieldErrors[path]) fieldErrors[path] = err.message;
    });
    return fieldErrors;
  }, [schema, preferredDate, preferredTime, location, details]);

  const currentErrors = useMemo(() => {
    if (!submitted && Object.keys(touched).length === 0) return {};
    const errs = validate();
    // Only show errors for touched fields unless submitted
    if (!submitted) {
      const filtered: FieldErrors = {};
      (Object.keys(touched) as (keyof FieldErrors)[]).forEach((key) => {
        if (errs[key]) filtered[key] = errs[key];
      });
      return filtered;
    }
    return errs;
  }, [submitted, touched, validate]);

  const isValid = useMemo(() => {
    const errs = validate();
    return Object.keys(errs).length === 0;
  }, [validate]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const resetForm = useCallback(() => {
    setPreferredDate("");
    setPreferredTime("");
    setLocation("");
    setDetails("");
    setErrors({});
    setTouched({});
    setSubmitted(false);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 1) return;
    if (!isValid) return;
    onSubmit({ preferredDate, preferredTime, location: location.trim(), details: details.trim() });
  };

  // Combine real-time and submit errors for display
  const displayErrors = submitted ? errors : currentErrors;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{t("requestService.title", "Request this Service")}</DialogTitle>
          <DialogDescription>
            {t("requestService.subtitle", "Send the provider a quick request. No payment is required until they accept.")}
          </DialogDescription>
        </DialogHeader>
        {service && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="font-display font-semibold">{service.title}</p>
            <p className="text-sm text-muted-foreground">
              {t("services.by")} {service.profiles?.full_name} · ${Number(service.price).toFixed(2)}
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs-date">{t("requestService.preferredDate", "Preferred Date")}</Label>
              <Input
                id="rs-date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                onBlur={() => handleBlur("preferredDate")}
                min={todayStr}
                aria-invalid={!!displayErrors.preferredDate}
                aria-describedby={displayErrors.preferredDate ? "rs-date-error" : undefined}
              />
              {displayErrors.preferredDate && (
                <p id="rs-date-error" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {displayErrors.preferredDate}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-time">{t("requestService.preferredTime", "Preferred Time")}</Label>
              <Input
                id="rs-time"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                onBlur={() => handleBlur("preferredTime")}
                aria-invalid={!!displayErrors.preferredTime}
                aria-describedby={displayErrors.preferredTime ? "rs-time-error" : undefined}
              />
              {displayErrors.preferredTime && (
                <p id="rs-time-error" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {displayErrors.preferredTime}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-location">{t("requestService.location", "Service Location")}</Label>
            <Input
              id="rs-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => handleBlur("location")}
              placeholder={t("requestService.locationPlaceholder", "Address, city, or ZIP")}
              maxLength={200}
              aria-invalid={!!displayErrors.location}
              aria-describedby={displayErrors.location ? "rs-location-error" : undefined}
            />
            {displayErrors.location && (
              <p id="rs-location-error" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {displayErrors.location}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="rs-details">{t("requestService.details", "Details")}</Label>
              <span className={`text-xs ${details.trim().length > 0 && details.trim().length < 20 ? "text-destructive" : "text-muted-foreground"}`}>
                {details.trim().length}/1000
              </span>
            </div>
            <Textarea
              id="rs-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              onBlur={() => handleBlur("details")}
              placeholder={t("requestService.detailsPlaceholder", "Describe what you need so the provider can prepare...")}
              maxLength={1000}
              rows={4}
              aria-invalid={!!displayErrors.details}
              aria-describedby={displayErrors.details ? "rs-details-error" : undefined}
            />
            {displayErrors.details && (
              <p id="rs-details-error" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {displayErrors.details}
              </p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !isValid}
          >
            <Send className="mr-2 h-4 w-4" />
            {loading ? t("requestService.sending", "Sending...") : t("requestService.send", "Send Request")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RequestServiceDialog;
