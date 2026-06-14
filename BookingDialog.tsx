import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CreditCard, Info, Zap, Calendar as CalendarIcon, Clock, Check, ChevronDown } from "lucide-react";
import type { ServiceWithProvider } from "./ServiceCard";
import { supabase } from "@/integrations/supabase/client";



type BookingDialogProps = {
  service: ServiceWithProvider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { date: Date; time: string; hours: number; notes: string; payWithPayPal: boolean; paymentMethod: "paypal" | "stripe" }) => void;
  loading?: boolean;
  bookingFeePercentage?: number;
};

type SuggestedSlot = {
  date: Date;
  time: string; // "HH:MM"
  dayLabelKey: string; // i18n key e.g. booking.slots.today
  fallbackDayLabel: string;
  partKey: string;
  fallbackPartLabel: string;
};

const DEFAULT_PARTS: { key: string; fallback: string; time: string }[] = [
  { key: "booking.slots.morning", fallback: "Morning", time: "09:00" },
  { key: "booking.slots.afternoon", fallback: "Afternoon", time: "13:00" },
  { key: "booking.slots.evening", fallback: "Evening", time: "17:00" },
];

const buildDefaultSlots = (): SuggestedSlot[] => {
  const slots: SuggestedSlot[] = [];
  const now = new Date();
  const todayHour = now.getHours();
  for (let dayOffset = 0; dayOffset < 4 && slots.length < 6; dayOffset++) {
    const d = new Date();
    d.setDate(now.getDate() + dayOffset);
    d.setHours(0, 0, 0, 0);
    const dayLabelKey =
      dayOffset === 0 ? "booking.slots.today" :
      dayOffset === 1 ? "booking.slots.tomorrow" :
      "booking.slots.weekday";
    const fallbackDayLabel =
      dayOffset === 0 ? "Today" :
      dayOffset === 1 ? "Tomorrow" :
      d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

    for (const part of DEFAULT_PARTS) {
      // skip times already past today
      if (dayOffset === 0) {
        const partHour = parseInt(part.time.split(":")[0], 10);
        if (partHour <= todayHour + 1) continue;
      }
      slots.push({
        date: d,
        time: part.time,
        dayLabelKey,
        fallbackDayLabel,
        partKey: part.key,
        fallbackPartLabel: part.fallback,
      });
      if (slots.length >= 6) break;
    }
  }
  return slots;
};

const BookingDialog = ({ service, open, onOpenChange, onConfirm, loading, bookingFeePercentage = 10 }: BookingDialogProps) => {
  const { t } = useTranslation();
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");
  const [hours, setHours] = useState("1");
  const [notes, setNotes] = useState("");
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [showDetailed, setShowDetailed] = useState(false);
  const [availabilityDays, setAvailabilityDays] = useState<Set<number> | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "stripe">("paypal");

  const servicePrice = service ? Number(service.price) : 0;
  const bookingFee = useMemo(() => +(servicePrice * bookingFeePercentage / 100).toFixed(2), [servicePrice, bookingFeePercentage]);
  const totalPrice = useMemo(() => +(servicePrice + bookingFee).toFixed(2), [servicePrice, bookingFee]);

  // Stripe gross-up so provider nets servicePrice exactly
  const stripeCustomerCharge = useMemo(
    () => +(((1.15 * servicePrice + 0.30) / 0.971)).toFixed(2),
    [servicePrice],
  );
  const stripeProcessing = useMemo(
    () => +(0.029 * stripeCustomerCharge + 0.30).toFixed(2),
    [stripeCustomerCharge],
  );
  const stripePlatformFee = useMemo(() => +(0.15 * servicePrice).toFixed(2), [servicePrice]);

  // Reset state when dialog opens for a new service
  useEffect(() => {
    if (open) {
      setSelectedSlotIdx(null);
      setShowDetailed(false);
      setDate(undefined);
      setTime("09:00");
      setHours(service?.estimated_hours ? String(service.estimated_hours) : "1");
      setNotes("");
      setPaymentMethod("paypal");
    }
  }, [open, service?.id, service?.estimated_hours]);

  // Fetch provider availability to filter slots to days the provider works
  useEffect(() => {
    if (!open || !service?.provider_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("provider_availability")
        .select("day_of_week,is_available")
        .eq("provider_id", service.provider_id);
      if (cancelled) return;
      if (data && data.length > 0) {
        setAvailabilityDays(new Set(data.filter((r: any) => r.is_available).map((r: any) => r.day_of_week)));
      } else {
        setAvailabilityDays(null); // no availability set → show all
      }
    })();
    return () => { cancelled = true; };
  }, [open, service?.provider_id]);

  const suggestedSlots = useMemo(() => {
    const all = buildDefaultSlots();
    if (!availabilityDays || availabilityDays.size === 0) return all;
    return all.filter((s) => availabilityDays.has(s.date.getDay())).slice(0, 6);
  }, [availabilityDays, open]);

  const selectedSlot = selectedSlotIdx != null ? suggestedSlots[selectedSlotIdx] : null;

  const handlePickSlot = (idx: number) => {
    const slot = suggestedSlots[idx];
    if (!slot) return;
    setSelectedSlotIdx(idx);
    setDate(slot.date);
    setTime(slot.time);
  };

  const handleQuickConfirm = () => {
    if (!selectedSlot) return;
    onConfirm({
      date: selectedSlot.date,
      time: selectedSlot.time,
      hours: parseFloat(hours) || 1,
      notes,
      payWithPayPal: paymentMethod === "paypal",
      paymentMethod,
    });
  };

  const handleSubmit = (payWithPayPal: boolean) => {
    if (!date) return;
    onConfirm({ date, time, hours: parseFloat(hours), notes, payWithPayPal: paymentMethod === "paypal" ? payWithPayPal : false, paymentMethod });
  };

  const formatTimeLabel = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10));
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {t("booking.quickBookTitle", "Quick Book")}
          </DialogTitle>
        </DialogHeader>
        {service && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-display font-semibold">{service.title}</p>
              <p className="text-sm text-muted-foreground">
                {t("services.by")} {service.profiles?.full_name}
              </p>
            </div>

            {/* Price Breakdown */}
            <div className="rounded-lg border p-3 space-y-2">
              {paymentMethod === "paypal" ? (
              <>
              <div className="flex justify-between text-sm">
                <span>{t("booking.servicePrice")}</span>
                <span className="font-medium">${servicePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  {t("booking.bookingFee")} ({bookingFeePercentage}%)
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
                <span className="font-medium">${bookingFee.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{t("booking.total")}</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {t("booking.feeNote")}
              </p>
              </>
              ) : (
              <>
                <div className="flex justify-between text-sm"><span>{t("booking.servicePrice")}</span><span className="font-medium">${servicePrice.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>{t("booking.platformFee15", "Platform fee (15%)")}</span><span className="font-medium">${stripePlatformFee.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>{t("booking.stripeFee", "Card processing (2.9% + $0.30)")}</span><span className="font-medium">${stripeProcessing.toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between font-semibold"><span>{t("booking.totalYouPay", "Total you pay")}</span><span>${stripeCustomerCharge.toFixed(2)}</span></div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />{t("booking.stripeFeeNote", "Full charge collected upfront via Stripe. Provider receives ${{p}} after fees.", { p: servicePrice.toFixed(2) })}</p>
              </>
              )}
            </div>

            {/* Payment method selector */}
            <div className="rounded-lg border p-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("booking.payWith", "Pay with")}</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod("paypal")}
                  className={cn("rounded-md border px-3 py-2 text-sm font-medium transition-all",
                    paymentMethod === "paypal" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border")}>
                  {t("booking.payPalOption", "PayPal (booking fee)")}
                </button>
                <button type="button" onClick={() => setPaymentMethod("stripe")}
                  className={cn("rounded-md border px-3 py-2 text-sm font-medium transition-all",
                    paymentMethod === "stripe" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border")}>
                  {t("booking.stripeOption", "Card via Stripe (full)")}
                </button>
              </div>
            </div>
          </div>
        )}

        {!showDetailed ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                {t("booking.pickASlot", "Pick a suggested time")}
              </Label>
              {suggestedSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  {t("booking.noSlots", "No suggested slots available — open more options below.")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {suggestedSlots.map((slot, idx) => {
                    const active = selectedSlotIdx === idx;
                    return (
                      <button
                        key={`${slot.date.toISOString()}-${slot.time}`}
                        type="button"
                        onClick={() => handlePickSlot(idx)}
                        className={cn(
                          "relative flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all",
                          "hover:border-primary hover:shadow-sm",
                          active
                            ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                            : "border-border bg-card"
                        )}
                      >
                        {active && (
                          <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
                        )}
                        <span className="text-sm font-semibold">
                          {t(slot.dayLabelKey, slot.fallbackDayLabel)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(slot.partKey, slot.fallbackPartLabel)} · {formatTimeLabel(slot.time)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDetailed(true)}
              className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <ChevronDown className="h-3 w-3" />
              {t("booking.moreOptions", "More options (custom date, time, notes)")}
            </button>

            <Button
              type="button"
              className={cn("w-full font-semibold", paymentMethod === "paypal" ? "bg-[hsl(var(--paypal-blue))] hover:bg-[hsl(var(--paypal-blue))]/90 text-white" : "")}
              disabled={!selectedSlot || loading}
              onClick={handleQuickConfirm}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {loading
                ? t("booking.confirming")
                : paymentMethod === "paypal"
                  ? t("booking.payBookingFee", { amount: `$${bookingFee.toFixed(2)}` })
                  : t("booking.payWithStripe", { amount: `$${stripeCustomerCharge.toFixed(2)}`, defaultValue: `Pay {{amount}} with Stripe` })}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {t("booking.servicePaymentNote")}
            </p>
          </div>
        ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {t("booking.selectDate")}
              </Label>
              <button
                type="button"
                onClick={() => setShowDetailed(false)}
                className="text-xs text-primary hover:underline"
              >
                {t("booking.backToQuick", "← Back to quick slots")}
              </button>
            </div>
            <div className="mt-1 flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date()}
                className={cn("p-3 pointer-events-auto rounded-md border")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("booking.preferredTime")}</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("booking.estimatedHours")}</Label>
              <Input type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("booking.notes")}</Label>
            <Textarea placeholder={t("booking.notesPlaceholder")} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              className={cn("w-full font-semibold", paymentMethod === "paypal" ? "bg-[hsl(var(--paypal-blue))] hover:bg-[hsl(var(--paypal-blue))]/90 text-white" : "")}
              disabled={!date || loading}
              onClick={() => handleSubmit(true)}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {loading ? t("booking.confirming") : paymentMethod === "paypal"
                ? t("booking.payBookingFee", { amount: `$${bookingFee.toFixed(2)}` })
                : t("booking.payWithStripe", { amount: `$${stripeCustomerCharge.toFixed(2)}`, defaultValue: `Pay {{amount}} with Stripe` })}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {t("booking.servicePaymentNote")}
            </p>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDialog;
