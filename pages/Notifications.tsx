import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, BookOpen, Star, Check, MessageCircle, CalendarCheck, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data: Record<string, unknown>;
};

const NOTIFICATION_TYPE_KEYS = [
  { value: "all", key: "notifications.filterAll" },
  { value: "new_booking", key: "notifications.filterBookings" },
  { value: "new_review", key: "notifications.filterReviews" },
  { value: "new_message", key: "notifications.filterMessages" },
  { value: "booking_update", key: "notifications.filterStatusUpdates" },
];

const iconMap: Record<string, React.ReactNode> = {
  new_booking: <BookOpen className="h-5 w-5 text-primary" />,
  new_review: <Star className="h-5 w-5 text-yellow-500" />,
  new_message: <MessageCircle className="h-5 w-5 text-accent" />,
  booking_update: <CalendarCheck className="h-5 w-5 text-primary" />,
};

const Notifications = () => {
  const { user } = useAuth();
  const { t: translate, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data } = await query;
    setNotifications((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, typeFilter]);

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BackButton fallback="/dashboard" showLabel={false} className="mb-1" />
            <h1 className="font-display text-2xl font-bold">
              {translate("notifications.title", "Notifications")}
            </h1>
            {unreadCount > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {translate("notifications.unread", { count: unreadCount })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPE_KEYS.map((nt) => (
                  <SelectItem key={nt.value} value={nt.value}>
                    {translate(nt.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                <Check className="mr-1 h-4 w-4" />
                {translate("notifications.markAllRead")}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <Bell className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {translate("notifications.empty", "No notifications yet")}
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {notifications.map((n) => {
                const isSpanish = i18n.language === "es";
                const data = n.data as Record<string, unknown> | null;
                const displayTitle = isSpanish && data?.title_es ? String(data.title_es) : n.title;
                const displayMessage = isSpanish && data?.message_es ? String(data.message_es) : n.message;
                return (
              <button
                key={n.id}
                onClick={() => !n.is_read && markOneRead(n.id)}
                className={`flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50 ${
                  n.is_read ? "opacity-60" : "bg-primary/5"
                }`}
              >
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  {iconMap[n.type] || <Bell className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{displayTitle}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {NOTIFICATION_TYPE_KEYS.find((nt) => nt.value === n.type) ? translate(NOTIFICATION_TYPE_KEYS.find((nt) => nt.value === n.type)!.key) : n.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{displayMessage}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground/70">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
