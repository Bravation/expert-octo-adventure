import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfWeek, differenceInWeeks, differenceInMonths, addMonths, addWeeks, subDays, subMonths, subYears, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type Booking = {
  id: string;
  status: string;
  total_price: number;
  commission_amount: number;
  created_at: string;
  service_price: number;
};

interface ProviderAnalyticsProps {
  bookings: Booking[];
}

type Granularity = "weekly" | "monthly";

const chartConfig = {
  bookings: { label: "Bookings", color: "hsl(var(--primary))" },
  earnings: { label: "Earnings", color: "hsl(var(--accent))" },
  completed: { label: "Completed", color: "hsl(var(--primary))" },
  cancelled: { label: "Cancelled", color: "hsl(var(--destructive))" },
};

function getWeekKey(date: Date) {
  const d = startOfWeek(date, { weekStartsOn: 0 });
  return format(d, "yyyy-MM-dd");
}

function getWeekLabel(weekStart: string) {
  const d = new Date(weekStart + "T00:00:00");
  return format(d, "MMM d");
}

function getDefaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 5);
  from.setDate(1);
  return { from, to };
}

const ProviderAnalytics = ({ bookings }: ProviderAnalyticsProps) => {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);

  const data = useMemo(() => {
    type Row = { label: string; bookings: number; earnings: number; completed: number; cancelled: number };
    const from = dateRange.from ?? new Date();
    const to = dateRange.to ?? new Date();

    if (granularity === "monthly") {
      const months: Record<string, Row> = {};
      const count = Math.max(differenceInMonths(to, from), 0) + 1;
      for (let i = 0; i < count; i++) {
        const d = addMonths(from, i);
        const key = format(d, "yyyy-MM");
        const label = format(d, "MMM yy");
        months[key] = { label, bookings: 0, earnings: 0, completed: 0, cancelled: 0 };
      }
      bookings.forEach((b) => {
        const d = new Date(b.created_at);
        const key = format(d, "yyyy-MM");
        if (months[key]) {
          months[key].bookings += 1;
          if (b.status === "completed") {
            months[key].completed += 1;
            months[key].earnings += Number(b.total_price) - Number(b.commission_amount);
          }
          if (b.status === "cancelled") months[key].cancelled += 1;
        }
      });
      return Object.values(months);
    }

    // Weekly
    const weeks: Record<string, Row> = {};
    const count = Math.max(differenceInWeeks(to, from), 0) + 1;
    for (let i = 0; i < count; i++) {
      const d = addWeeks(startOfWeek(from, { weekStartsOn: 0 }), i);
      const key = format(d, "yyyy-MM-dd");
      if (!weeks[key]) {
        weeks[key] = { label: getWeekLabel(key), bookings: 0, earnings: 0, completed: 0, cancelled: 0 };
      }
    }
    bookings.forEach((b) => {
      const key = getWeekKey(new Date(b.created_at));
      if (weeks[key]) {
        weeks[key].bookings += 1;
        if (b.status === "completed") {
          weeks[key].completed += 1;
          weeks[key].earnings += Number(b.total_price) - Number(b.commission_amount);
        }
        if (b.status === "cancelled") weeks[key].cancelled += 1;
      }
    });
    return Object.values(weeks);
  }, [bookings, granularity, dateRange]);

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">{t("providerDashboard.noAnalytics", "No analytics data yet")}</p>
          <p className="text-sm text-muted-foreground/70">{t("providerDashboard.noAnalyticsHint", "Charts will appear once you have bookings")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 text-xs", !dateRange.from && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateRange.from && dateRange.to
                  ? `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
                  : t("providerDashboard.pickDateRange", "Pick date range")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range)}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {[
            { label: t("providerDashboard.last7days", "7D"), range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: new Date() }) },
            { label: t("providerDashboard.last30days", "30D"), range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: new Date() }) },
            { label: t("providerDashboard.last3months", "3M"), range: () => ({ from: startOfDay(subMonths(new Date(), 3)), to: new Date() }) },
            { label: t("providerDashboard.lastYear", "1Y"), range: () => ({ from: startOfDay(subYears(new Date(), 1)), to: new Date() }) },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="text-xs px-2 h-8"
              onClick={() => {
                const r = preset.range();
                setDateRange(r);
                if (preset.label === "7D" || preset.label === "30D") setGranularity("weekly");
                else setGranularity("monthly");
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <ToggleGroup
          type="single"
          value={granularity}
          onValueChange={(v) => v && setGranularity(v as Granularity)}
          size="sm"
        >
          <ToggleGroupItem value="weekly" className="text-xs px-3">
            {t("providerDashboard.weekly", "Weekly")}
          </ToggleGroupItem>
          <ToggleGroupItem value="monthly" className="text-xs px-3">
            {t("providerDashboard.monthly", "Monthly")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">{t("providerDashboard.bookingTrends", "Booking Trends")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="cancelled" stackId="a" fill="var(--color-cancelled)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">{t("providerDashboard.earningsOverTime", "Earnings Over Time")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${Number(value).toFixed(2)}`} />} />
                <Line type="monotone" dataKey="earnings" stroke="var(--color-earnings)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-earnings)" }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProviderAnalytics;
