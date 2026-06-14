import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Clock, Check, X, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DAYS, formatTime12h, type DaySchedule } from "./types";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type Props = {
  availability: any[];
  isOwner: boolean;
  profileId: string;
  onAvailabilityUpdate: (rows: any[]) => void;
};

const AvailabilitySection = ({ availability, isOwner, profileId, onAvailabilityUpdate }: Props) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [saving, setSaving] = useState(false);

  const DAY_NAMES = [
    t("days.sunday", "Sunday"),
    t("days.monday", "Monday"),
    t("days.tuesday", "Tuesday"),
    t("days.wednesday", "Wednesday"),
    t("days.thursday", "Thursday"),
    t("days.friday", "Friday"),
    t("days.saturday", "Saturday"),
  ];

  const startEdit = () => {
    const merged = DAYS.map((day) => {
      const found = availability.find((e: any) => e.day_of_week === day.value);
      return found
        ? { id: found.id, day_of_week: found.day_of_week, is_available: found.is_available, start_time: found.start_time, end_time: found.end_time }
        : { day_of_week: day.value, is_available: false, start_time: "09:00", end_time: "17:00" };
    });
    setSchedule(merged);
    setEditing(true);
  };

  const updateDay = (dayIndex: number, updates: Partial<DaySchedule>) => {
    setSchedule((prev) => prev.map((d) => (d.day_of_week === dayIndex ? { ...d, ...updates } : d)));
  };

  const saveAvailability = async () => {
    for (const day of schedule) {
      if (day.is_available && day.start_time >= day.end_time) {
        const dayName = DAYS.find((d) => d.value === day.day_of_week)?.key || "";
        toast.error(t("availability.invalidTime", { day: t(`availability.${dayName}`, dayName) }) || `End time must be after start time for ${dayName}`);
        return;
      }
    }

    setSaving(true);
    await supabase.from("provider_availability").delete().eq("provider_id", profileId);

    const rows = schedule.map((d) => ({
      provider_id: profileId,
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
      onAvailabilityUpdate(rows);
      setEditing(false);
    }
  };

  if (!availability.length && !isOwner) return null;

  return (
    <>
      <h2 className="mb-4 mt-8 flex items-center gap-2 font-display text-xl font-semibold">
        <Clock className="h-5 w-5 text-primary" />
        {t("provider.availability", "Availability")}
        {isOwner && !editing && (
          <button onClick={startEdit} className="ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("common.edit", "Edit")}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </h2>

      {editing ? (
        <Card>
          <CardContent className="space-y-3 p-4">
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
                    <Switch checked={daySchedule.is_available} onCheckedChange={(checked) => updateDay(day.value, { is_available: checked })} />
                    <Label className="w-24 font-medium capitalize">{t(`availability.${day.key}`, day.key)}</Label>
                  </div>
                  {daySchedule.is_available ? (
                    <div className="flex items-center gap-2">
                      <input type="time" value={daySchedule.start_time} onChange={(e) => updateDay(day.value, { start_time: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                      <span className="text-sm text-muted-foreground">{t("availability.to", "to")}</span>
                      <input type="time" value={daySchedule.end_time} onChange={(e) => updateDay(day.value, { end_time: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("availability.unavailable", "Unavailable")}</span>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Button onClick={saveAvailability} className="gap-2" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? t("availability.saving", "Saving...") : t("availability.save", "Save Availability")}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : availability.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {availability.map((slot: any) => (
                <div
                  key={slot.id || slot.day_of_week}
                  className={`flex items-center gap-2 rounded-lg border p-3 ${
                    slot.is_available ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30 opacity-60"
                  }`}
                >
                  {slot.is_available ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <X className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{DAY_NAMES[slot.day_of_week]}</p>
                    {slot.is_available && (
                      <p className="text-xs text-muted-foreground">
                        {formatTime12h(slot.start_time)} – {formatTime12h(slot.end_time)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground">{t("provider.noAvailability", "No availability set yet. Click the pencil icon to add your schedule.")}</p>
      )}
    </>
  );
};

export default AvailabilitySection;
