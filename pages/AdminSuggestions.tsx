import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  AlertCircle,
  Star,
  HelpCircle,
  Sparkles,
  Inbox,
  Shield,
  Filter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Suggestion = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  category: string | null;
  sentiment: string | null;
  ai_response: string | null;
  status: string;
  created_at: string;
};

const categoryIcons: Record<string, typeof Bug> = {
  bug_report: Bug,
  feature_request: Lightbulb,
  complaint: AlertCircle,
  praise: Star,
  question: HelpCircle,
  general: MessageSquarePlus,
};

const categoryColors: Record<string, string> = {
  bug_report: "bg-destructive/10 text-destructive border-destructive/20",
  feature_request: "bg-primary/10 text-primary border-primary/20",
  complaint: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  praise: "bg-green-500/10 text-green-600 border-green-500/20",
  question: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  general: "bg-muted text-muted-foreground border-border",
};

const sentimentEmoji: Record<string, string> = {
  positive: "😊",
  neutral: "😐",
  negative: "😟",
};

const statusOptions = ["pending", "reviewed", "in_progress", "resolved", "dismissed"];

const AdminSuggestions = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (!user) return;

    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin" as const,
      });
      if (!data) {
        navigate("/dashboard");
        toast.error(t("admin.unauthorized", "You don't have admin access"));
        return;
      }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user, navigate, t]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchSuggestions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSuggestions(data as Suggestion[]);
      }
      setLoading(false);
    };
    fetchSuggestions();
  }, [isAdmin]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("suggestions")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast.error(t("admin.updateError", "Failed to update status"));
    } else {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
      toast.success(t("admin.statusUpdated", "Status updated"));
    }
  };

  const filtered = suggestions.filter((s) => {
    if (filterCategory !== "all" && s.category !== filterCategory) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  const categoryKeys = ["bug_report", "feature_request", "complaint", "praise", "question", "general"];

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <BackButton fallback="/dashboard" showLabel={false} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold font-display">
                {t("admin.suggestionsTitle", "Manage Feedback")}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("admin.suggestionsSubtitle", "View and manage all user submissions")}
              {" · "}
              <span className="font-medium text-foreground">{suggestions.length}</span>{" "}
              {t("admin.total", "total")}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t("admin.filterCategory", "Category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.allCategories", "All Categories")}</SelectItem>
              {categoryKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {key.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t("admin.filterStatus", "Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.allStatuses", "All Statuses")}</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterCategory !== "all" || filterStatus !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterCategory("all"); setFilterStatus("all"); }}
            >
              {t("admin.clearFilters", "Clear filters")}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {t("admin.noSuggestions", "No feedback found")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {filterCategory !== "all" || filterStatus !== "all"
                  ? t("admin.noSuggestionsFiltered", "Try adjusting your filters")
                  : t("admin.noSuggestionsEmpty", "No user feedback has been submitted yet.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((s) => {
              const Icon = categoryIcons[s.category || "general"] || MessageSquarePlus;
              const colorClass = categoryColors[s.category || "general"] || categoryColors.general;
              return (
                <Card key={s.id} className="overflow-hidden">
                  <CardContent className="p-5 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground leading-tight">{s.subject}</h3>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`gap-1.5 ${colorClass}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {(s.category || "general").replace("_", " ")}
                      </Badge>
                      {s.sentiment && (
                        <span className="text-base" title={`Sentiment: ${s.sentiment}`}>
                          {sentimentEmoji[s.sentiment] || "😐"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={s.user_id}>
                        {t("admin.userId", "User")}: {s.user_id.slice(0, 8)}…
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.message}</p>

                    {/* AI Response */}
                    {s.ai_response && (
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Sparkles className="h-3.5 w-3.5" />
                          {t("suggestionsHistory.aiResponse", "AI Response")}
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{s.ai_response}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Status Management */}
                    <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                      <span className="text-xs text-muted-foreground font-medium">
                        {t("admin.status", "Status")}:
                      </span>
                      <Select
                        value={s.status}
                        onValueChange={(val) => handleStatusChange(s.id, val)}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-xs capitalize">
                              {opt.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSuggestions;
