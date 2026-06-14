import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, BookOpen, Star, Check, MessageCircle, CalendarCheck, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data: Record<string, unknown>;
};

const iconMap: Record<string, React.ReactNode> = {
  new_booking: <BookOpen className="h-4 w-4 text-primary" />,
  new_review: <Star className="h-4 w-4 text-warning" />,
  new_message: <MessageCircle className="h-4 w-4 text-accent" />,
  booking_update: <CalendarCheck className="h-4 w-4 text-primary" />,
  milestone: <Trophy className="h-4 w-4 text-primary" />,
};

const NotificationBell = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data as any) || []);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-display text-sm font-semibold">
            {t("notifications.title", "Notifications")}
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Check className="h-3 w-3" />
              {t("notifications.markAllRead", "Mark all read")}
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("notifications.empty", "No notifications yet")}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const isSpanish = i18n.language === "es";
                const data = n.data as Record<string, unknown> | null;
                const displayTitle = isSpanish && data?.title_es ? String(data.title_es) : n.title;
                const displayMessage = isSpanish && data?.message_es ? String(data.message_es) : n.message;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 transition-colors ${
                      n.is_read ? "opacity-60" : "bg-primary/5"
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      {iconMap[n.type] || <Bell className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{displayTitle}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{displayMessage}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <Link
          to="/notifications"
          className="block border-t px-4 py-2 text-center text-xs font-medium text-primary hover:underline"
          onClick={() => setOpen(false)}
        >
          {t("notifications.viewAll", "View all notifications")}
        </Link>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
