import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Sparkles, Send, CheckCircle2, AlertCircle, Lightbulb, Bug, Star, HelpCircle, History } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

const categoryIcons: Record<string, typeof Bug> = {
  bug_report: Bug,
  feature_request: Lightbulb,
  complaint: AlertCircle,
  praise: Star,
  question: HelpCircle,
  general: MessageSquarePlus,
};

const categoryColors: Record<string, string> = {
  bug_report: "bg-destructive/10 text-destructive",
  feature_request: "bg-primary/10 text-primary",
  complaint: "bg-orange-500/10 text-orange-600",
  praise: "bg-green-500/10 text-green-600",
  question: "bg-blue-500/10 text-blue-600",
  general: "bg-muted text-muted-foreground",
};

const sentimentEmoji: Record<string, string> = {
  positive: "😊",
  neutral: "😐",
  negative: "😟",
};

const SuggestionBox = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ai_response: string;
    category: string;
    sentiment: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t("suggestionBox.loginRequired", "Please log in to submit feedback"));
      return;
    }
    if (!subject.trim() || !message.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-suggestion", {
        body: { subject: subject.trim(), message: message.trim() },
      });

      if (error) throw error;

      setResult({
        ai_response: data.ai_response,
        category: data.category,
        sentiment: data.sentiment,
      });
      toast.success(t("suggestionBox.submitted", "Feedback submitted successfully!"));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("suggestionBox.error", "Failed to submit feedback"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubject("");
    setMessage("");
    setResult(null);
  };

  const CategoryIcon = result ? categoryIcons[result.category] || MessageSquarePlus : MessageSquarePlus;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleReset(); }}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 shadow-lg transition-colors hover:bg-accent/90 md:bottom-6"
          aria-label={t("suggestionBox.title", "Suggestion Box")}
        >
          <MessageSquarePlus className="h-5 w-5 text-accent-foreground" />
          <span className="text-sm font-medium text-accent-foreground">
            {t("suggestionBox.bubble", "Suggestion")}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("suggestionBox.title", "Suggestion Box")}
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("suggestionBox.description", "Share your feedback, report issues, or suggest new features. Our AI will review and respond instantly!")}
            </p>
            <div className="space-y-2">
              <Label htmlFor="suggestion-subject">{t("suggestionBox.subject", "Subject")}</Label>
              <Input
                id="suggestion-subject"
                placeholder={t("suggestionBox.subjectPlaceholder", "Brief summary of your feedback...")}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggestion-message">{t("suggestionBox.message", "Message")}</Label>
              <Textarea
                id="suggestion-message"
                placeholder={t("suggestionBox.messagePlaceholder", "Tell us more details...")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={4}
                required
                disabled={submitting}
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/1000</p>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={submitting || !subject.trim() || !message.trim()}>
              {submitting ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" />
                  {t("suggestionBox.analyzing", "AI is analyzing...")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t("suggestionBox.submit", "Submit Feedback")}
                </>
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Success header */}
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                {t("suggestionBox.received", "Feedback received & analyzed!")}
              </span>
            </div>

            {/* Category & Sentiment */}
            <div className="flex items-center gap-2">
              <Badge className={`gap-1.5 ${categoryColors[result.category] || categoryColors.general}`}>
                <CategoryIcon className="h-3.5 w-3.5" />
                {result.category.replace("_", " ")}
              </Badge>
              <span className="text-lg" title={`Sentiment: ${result.sentiment}`}>
                {sentimentEmoji[result.sentiment] || "😐"}
              </span>
            </div>

            {/* AI Response */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t("suggestionBox.aiResponse", "AI Response")}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result.ai_response}</ReactMarkdown>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleReset}>
                {t("suggestionBox.submitAnother", "Submit Another")}
              </Button>
              <Button className="flex-1" onClick={() => { setOpen(false); handleReset(); }}>
                {t("suggestionBox.done", "Done")}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-muted-foreground"
              onClick={() => { setOpen(false); handleReset(); navigate("/suggestions"); }}
            >
              <History className="h-4 w-4" />
              {t("suggestionBox.viewHistory", "View all feedback")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SuggestionBox;
