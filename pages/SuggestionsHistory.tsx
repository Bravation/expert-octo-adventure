import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { MessageSquarePlus, Bug, Lightbulb, AlertCircle, Star, HelpCircle, Sparkles, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

type Suggestion = {
  id: string;
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

const SuggestionsHistory = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <BackButton fallback="/settings" showLabel={false} />
          <div>
            <h1 className="text-2xl font-bold font-display">
              {t("suggestionsHistory.title", "My Feedback")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("suggestionsHistory.subtitle", "View all your past submissions and AI responses")}
            </p>
          </div>
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
        ) : suggestions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {t("suggestionsHistory.empty", "No feedback yet")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t("suggestionsHistory.emptyDescription", "Use the suggestion box to share your feedback, and your submissions will appear here.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {suggestions.map((s) => {
              const Icon = categoryIcons[s.category || "general"] || MessageSquarePlus;
              const colorClass = categoryColors[s.category || "general"] || categoryColors.general;
              return (
                <Card key={s.id} className="overflow-hidden">
                  <CardContent className="p-5 space-y-3">
                    {/* Header row */}
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

                    {/* Badges */}
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
                      <Badge variant="outline" className="text-xs capitalize">
                        {s.status}
                      </Badge>
                    </div>

                    {/* User message */}
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.message}</p>

                    {/* AI Response */}
                    {s.ai_response && (
                      <div className="rounded-lg border bg-muted/30 p-4 mt-2">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Sparkles className="h-3.5 w-3.5" />
                          {t("suggestionsHistory.aiResponse", "AI Response")}
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{s.ai_response}</ReactMarkdown>
                        </div>
                      </div>
                    )}
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

export default SuggestionsHistory;
