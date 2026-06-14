import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import CategoryCombobox from "./CategoryCombobox";
import MultiPhotoUploader, { type PhotoItem } from "./MultiPhotoUploader";
import { uploadPhotos } from "./uploadPhotos";

type Service = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  photo_url?: string | null;
  photo_urls?: string[] | null;
  estimated_hours?: number | null;
};

type Props = {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const EditServiceDialog = ({ service, open, onOpenChange, onSaved }: Props) => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({ title: "", description: "", price: "", category: "", estimated_hours: "" });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [lastServiceId, setLastServiceId] = useState<string | null>(null);
  if (service && service.id !== lastServiceId) {
    setLastServiceId(service.id);
    setForm({
      title: service.title,
      description: service.description || "",
      price: String(service.price),
      category: service.category || "",
      estimated_hours: service.estimated_hours != null ? String(service.estimated_hours) : "",
    });
    const existingUrls = service.photo_urls?.length
      ? service.photo_urls
      : service.photo_url
      ? [service.photo_url]
      : [];
    setPhotos(existingUrls.filter(Boolean).map((url) => ({ url: url!, isNew: false })));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !user) return;
    setSaving(true);

    try {
      const photoUrls = await uploadPhotos(user.id, photos);

      const { error } = await supabase
        .from("services")
        .update({
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category: form.category,
          estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
          photo_url: photoUrls[0] || null,
          photo_urls: photoUrls,
        } as any)
        .eq("id", service.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("providerDashboard.serviceUpdated", "Service updated!"));
        onOpenChange(false);
        onSaved();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {t("providerDashboard.editService", "Edit Service")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("providerDashboard.title")}</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>{t("providerDashboard.description")}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("providerDashboard.price")}</Label>
              <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("providerDashboard.category")}</Label>
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
            {saving ? t("providerDashboard.saving", "Saving...") : t("providerDashboard.saveChanges", "Save Changes")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditServiceDialog;
