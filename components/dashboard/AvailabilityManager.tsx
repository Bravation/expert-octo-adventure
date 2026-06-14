import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, Save } from "lucide-react";
import { useTranslation } from "react-i18next";

const DAYS = [
  { key: "sunday", value: 0 },
  { key: "monday", value: 1 },
  { key: "tuesday", value: 2 },
  { key: "wednesday", value: 3 },
  { key: "thursday", value: 4 },
  { key: "friday", value: 5 },
  { key: "saturday", value: 6 },
];

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

type DaySchedule = {
  id?: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string;
  end_time: string;
};

const AvailabilityManager = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchAvailability();
  }, [profile]);

  const fetchAvailability = async () => {
    const { data } = await supabase
      .from("provider_availability")
      .select("*")
      .eq("provider_id", profile!.id)
      .order("day_of_week");

    const existing = (data || []) as DaySchedule[];
    const merged = DAYS.map((day) => {
      const found = existing.find((e) => e.day_of_week === day.value);
      return found || {
        day_of_week: day.value,
        is_available: false,
        start_time: DEFAULT_START,
        end_time: DEFAULT_END,
      };
    });
    setSchedule(merged);
    setLoading(false);
  };

  const updateDay = (dayIndex: number, updates: Partial<DaySchedule>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, ...updates } : d))
    );
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validate times
    for (const day of schedule) {
      if (day.is_available && day.start_time >= day.end_time) {
        const dayName = DAYS.find((d) => d.value === day.day_of_week)?.key || "";
        toast.error(t("availability.invalidTime", { day: t(`availability.${dayName}`, dayName) }) || `End time must be after start time for ${dayName}`);
        return;
      }
    }

    setSaving(true);

    // Delete existing and re-insert
    await supabase
      .from("provider_availability")
      .delete()
      .eq("provider_id", profile.id);

    const rows = schedule.map((d) => ({
      provider_id: profile.id,
      day_of_week: d.day_of_week,
      is_available: d.is_available,
      start_time: d.start_time,
      end_time: d.end_time,
    }));

    const { error } = await supabase.from("provider_availability").insert(rows);
    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("availability.saved", "Availability saved successfully"));
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Clock className="h-5 w-5 text-primary" />
          {t("availability.title", "Weekly Availability")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {DAYS.map((day) => {
          const daySchedule = schedule.find((s) => s.day_of_week === day.value);
          if (!daySchedule) return null;

          return (
            <div
              key={day.value}
              className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                daySchedule.is_available ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={daySchedule.is_available}
                  onCheckedChange={(checked) => updateDay(day.value, { is_available: checked })}
                />
                <Label className="w-24 font-medium capitalize">
                  {t(`availability.${day.key}`, day.key)}
                </Label>
              </div>

              {daySchedule.is_available ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={daySchedule.start_time}
                    onChange={(e) => updateDay(day.value, { start_time: e.target.value })}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">{t("availability.to", "to")}</span>
                  <input
                    type="time"
                    value={daySchedule.end_time}
                    onChange={(e) => updateDay(day.value, { end_time: e.target.value })}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("availability.unavailable", "Unavailable")}
                </span>
              )}
            </div>
          );
        })}

        <Button onClick={handleSave} className="mt-4 w-full gap-2" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? t("availability.saving", "Saving...") : t("availability.save", "Save Availability")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AvailabilityManager;
