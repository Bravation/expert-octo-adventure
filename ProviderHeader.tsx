import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, User, Briefcase, Pencil, Save } from "lucide-react";
import StarRating from "@/components/services/StarRating";
import ShareProfileLink from "@/components/dashboard/ShareProfileLink";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type Props = {
  provider: any;
  isOwner: boolean;
  userId?: string;
  onProviderUpdate: (updates: Record<string, any>) => void;
};

const ProviderHeader = ({ provider, isOwner, userId, onProviderUpdate }: Props) => {
  const { t } = useTranslation();
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  const startEditBio = () => {
    setBioValue(provider?.bio || "");
    setEditingBio(true);
  };

  const saveBio = async () => {
    if (!userId) return;
    setSavingBio(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bioValue.trim().slice(0, 500) })
      .eq("user_id", userId);
    setSavingBio(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("settings.saved", "Profile updated successfully"));
      onProviderUpdate({ bio: bioValue.trim() });
      setEditingBio(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background shadow-lg">
            {provider.avatar_url ? (
              <img src={provider.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-primary" />
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="font-display text-2xl font-bold">{provider.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <StarRating rating={Number(provider.average_rating) || 0} totalReviews={provider.total_reviews || 0} size="md" />
              {(provider.city || provider.state) && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {[provider.city, provider.state].filter(Boolean).join(", ")}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                {provider.total_services_completed || 0} {t("provider.completed")}
              </span>
            </div>

            {editingBio ? (
              <div className="mt-3 max-w-xl space-y-2">
                <Textarea
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={t("settings.bioPlaceholder", "Tell us about yourself...")}
                  className="text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveBio} disabled={savingBio} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {savingBio ? t("availability.saving", "Saving...") : t("settings.save", "Save")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingBio(false)}>
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <span className="text-xs text-muted-foreground">{bioValue.length}/500</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 max-w-xl">
                <p className="text-sm text-muted-foreground">
                  {provider.bio || (isOwner ? t("provider.addBio", "Add a bio to tell customers about yourself...") : "")}
                </p>
                {isOwner && (
                  <button
                    onClick={startEditBio}
                    className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t("common.edit", "Edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="mt-3">
              <ShareProfileLink profileId={provider.id} providerName={provider.full_name} compact />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProviderHeader;
