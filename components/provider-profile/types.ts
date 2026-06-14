import type { PhotoItem } from "@/components/dashboard/MultiPhotoUploader";

export type DaySchedule = {
  id?: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string;
  end_time: string;
};

export const DAYS = [
  { key: "sunday", value: 0 },
  { key: "monday", value: 1 },
  { key: "tuesday", value: 2 },
  { key: "wednesday", value: 3 },
  { key: "thursday", value: 4 },
  { key: "friday", value: 5 },
  { key: "saturday", value: 6 },
];

export const formatTime12h = (time: string | null) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`;
};
