import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import CategoryCombobox from "@/components/dashboard/CategoryCombobox";
import MultiPhotoUploader, { type PhotoItem } from "@/components/dashboard/MultiPhotoUploader";
import { uploadPhotos } from "@/components/dashboard/uploadPhotos";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type Props = {
  userId: string;
  profileId: string;
  onServiceAdded: () => void;
};

const AddServiceDialog = ({ userId, profileId, onServiceAdded }: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", category: "", estimated_hours: "" });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const photoUrls = await uploadPhotos(userId, photos);
      const { error } = await supabase.from("services").insert({
        provider_id: profileId,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        category: form.category,
        estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls,
      } as any);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("providerDashboard.serviceAdded", "Service added!"));
        setForm({ title: "", description: "", price: "", category: "", estimated_hours: "" });
        setPhotos([]);
        setOpen(false);
        onServiceAdded();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("providerDashboard.addService", "Add Service")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{t("providerDashboard.addService", "Add Service")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("providerDashboard.title", "Title")}</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>{t("providerDashboard.description", "Description")}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("providerDashboard.price", "Price")}</Label>
              <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("providerDashboard.category", "Category")}</Label>
              <CategoryCombobox value={form.category} onValueChange={(val) => setForm({ ...form, category: val })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("providerDashboard.estimatedHours", "Estimated hours to complete")}</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              placeholder={t("providerDashboard.estimatedHoursPlaceholder", "e.g. 2")}
              value={form.estimated_hours}
              onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("providerDashboard.estimatedHoursHint", "Approximate time this job usually takes. Shown to customers when booking.")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("providerDashboard.photos", "Photos")}</Label>
            <MultiPhotoUploader photos={photos} onChange={setPhotos} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? t("providerDashboard.saving", "Saving...") : t("providerDashboard.addService", "Add Service")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddServiceDialog;
