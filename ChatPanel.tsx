import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  booking_id: string;
  customer_id: string;
  provider_id: string;
  last_message_at: string;
  other_name?: string;
  other_avatar?: string;
  service_title?: string;
  last_message?: string;
  unread_count?: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

const ChatPanel = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) fetchConversations();
  }, [profile]);

  // Realtime messages subscription
  useEffect(() => {
    if (!activeConversation) return;

    const channel = supabase
      .channel(`messages-${activeConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          // Mark as read if we're the recipient
          if ((payload.new as Message).sender_id !== profile?.id) {
            supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", (payload.new as Message).id)
              .then();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation, profile]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    if (!profile) return;
    const isProvider = profile.role === "service_provider";
    const myField = isProvider ? "provider_id" : "customer_id";
    const otherField = isProvider ? "customer_id" : "provider_id";

    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .eq(myField, profile.id)
      .order("last_message_at", { ascending: false });

    if (!convos || convos.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Fetch other party profiles & booking/service info
    const otherIds = convos.map((c: any) => c[otherField]);
    const bookingIds = convos.map((c: any) => c.booking_id);

    const [profilesRes, bookingsRes, messagesRes] = await Promise.all([
      supabase.from("conversation_partner_profiles").select("id, full_name, avatar_url").in("id", otherIds),
      supabase.from("bookings").select("id, service_id, services!bookings_service_id_fkey(title)").in("id", bookingIds),
      // Get last message & unread count for each conversation
      supabase
        .from("messages")
        .select("conversation_id, content, created_at, sender_id, is_read")
        .in("conversation_id", convos.map((c: any) => c.id))
        .order("created_at", { ascending: false }),
    ]);

    const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
    const bookingMap = Object.fromEntries((bookingsRes.data || []).map((b: any) => [b.id, b]));

    // Group messages by conversation for last message + unread count
    const messagesByConvo: Record<string, any[]> = {};
    (messagesRes.data || []).forEach((m: any) => {
      if (!messagesByConvo[m.conversation_id]) messagesByConvo[m.conversation_id] = [];
      messagesByConvo[m.conversation_id].push(m);
    });

    const enriched = convos.map((c: any) => {
      const other = profileMap[c[otherField]];
      const booking = bookingMap[c.booking_id];
      const convoMessages = messagesByConvo[c.id] || [];
      const lastMsg = convoMessages[0];
      const unread = convoMessages.filter((m: any) => !m.is_read && m.sender_id !== profile.id).length;

      return {
        ...c,
        other_name: other?.full_name || "User",
        other_avatar: other?.avatar_url || "",
        service_title: (booking as any)?.services?.title || "",
        last_message: lastMsg?.content || "",
        unread_count: unread,
      };
    });

    setConversations(enriched);
    setLoading(false);
  };

  const openConversation = async (convo: Conversation) => {
    setActiveConversation(convo);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);

    // Mark unread messages as read
    if (profile) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", convo.id)
        .neq("sender_id", profile.id)
        .eq("is_read", false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || !profile) return;
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConversation.id,
      sender_id: profile.id,
      content: newMessage.trim(),
    } as any);

    if (!error) {
      // Update conversation last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", activeConversation.id);
      setNewMessage("");
    }
    setSending(false);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Active conversation view
  if (activeConversation) {
    return (
      <div className="flex h-[400px] sm:h-[500px] flex-col rounded-xl border bg-card">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => { setActiveConversation(null); fetchConversations(); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarImage src={activeConversation.other_avatar} />
            <AvatarFallback>{activeConversation.other_name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{activeConversation.other_name}</p>
            <p className="truncate text-xs text-muted-foreground">{activeConversation.service_title}</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("chat.noMessages", "No messages yet. Say hello!")}
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === profile?.id;
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm leading-relaxed",
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    <p>{msg.content}</p>
                    <p className={cn("mt-1 text-[10px]", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t("chat.typePlaceholder", "Type a message...")}
            className="flex-1"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    );
  }

  // Conversation list
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t("chat.title", "Messages")}
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {totalUnread}
            </span>
          )}
        </h3>
      </div>

      {conversations.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("chat.noConversations", "No conversations yet. Messages will appear here when you have active bookings.")}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="divide-y">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => openConversation(convo)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={convo.other_avatar} />
                  <AvatarFallback>{convo.other_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold">{convo.other_name}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{convo.service_title}</p>
                  {convo.last_message && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{convo.last_message}</p>
                  )}
                </div>
                {(convo.unread_count || 0) > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {convo.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default ChatPanel;
