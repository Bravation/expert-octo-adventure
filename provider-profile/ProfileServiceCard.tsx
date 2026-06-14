import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X, Camera } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/constants/serviceCategories";
import MultiPhotoUploader, { type PhotoItem } from "@/components/dashboard/MultiPhotoUploader";
import { uploadPhotos } from "@/components/dashboard/uploadPhotos";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PhotoGallery from "@/components/services/PhotoGallery";
import { cn } from "@/lib/utils";

type Props = {
  service: any;
  isOwner: boolean;
  userId?: string;
  providerId?: string;
  onServiceUpdate: (id: string, updates: Record<string, any>) => void;
};

const ProfileServiceCard = ({ service: s, isOwner, userId, providerId, onServiceUpdate }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [editingField, setEditingField] = useState<"title" | "description" | "category" | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const [savingField, setSavingField] = useState(false);

  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const [editingPhotos, setEditingPhotos] = useState(false);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [savingPhotos, setSavingPhotos] = useState(false);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const startEditField = (field: "title" | "description" | "category") => {
    const value = field === "title" ? s.title : field === "description" ? (s.description || "") : (s.category || "");
    setFieldValue(value);
    setEditingField(field);
  };

  const saveField = async () => {
    if (!editingField) return;
    const trimmed = fieldValue.trim();
    if (editingField === "title" && !trimmed) {
      toast.error(t("providerDashboard.titleRequired", "Title cannot be empty"));
      return;
    }
    setSavingField(true);
    const { error } = await supabase.from("services").update({ [editingField]: trimmed }).eq("id", s.id);
    setSavingField(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("providerDashboard.serviceUpdated", "Service updated"));
      onServiceUpdate(s.id, { [editingField]: trimmed });
      setEditingField(null);
    }
  };

  const startEditPrice = () => {
    setPriceValue(String(s.price));
    setEditingPrice(true);
  };

  const savePrice = async () => {
    const parsed = parseFloat(priceValue);
    if (isNaN(parsed) || parsed < 0) {
      toast.error(t("providerDashboard.invalidPrice", "Please enter a valid price"));
      return;
    }
    setSavingPrice(true);
    const { error } = await supabase.from("services").update({ price: parsed }).eq("id", s.id);
    setSavingPrice(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("providerDashboard.priceUpdated", "Price updated"));
      onServiceUpdate(s.id, { price: parsed });
      setEditingPrice(false);
    }
  };

  const startEditPhotos = () => {
    const existing = s.photo_urls?.length ? s.photo_urls : s.photo_url ? [s.photo_url] : [];
    setPhotoItems(existing.map((url: string) => ({ url, isNew: false })));
    setEditingPhotos(true);
  };

  const savePhotos = async () => {
    if (!userId) return;
    setSavingPhotos(true);
    try {
      const urls = await uploadPhotos(userId, photoItems);
      const { error } = await supabase
        .from("services")
        .update({ photo_urls: urls, photo_url: urls[0] || null })
        .eq("id", s.id);
      if (error) throw error;
      toast.success(t("providerDashboard.photosUpdated", "Photos updated"));
      onServiceUpdate(s.id, { photo_urls: urls, photo_url: urls[0] || null });
      setEditingPhotos(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photos");
    } finally {
      setSavingPhotos(false);
    }
  };

  const photos = s.photo_urls?.length ? s.photo_urls : s.photo_url ? [s.photo_url] : [];

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isOwner) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input") || target.closest("textarea") || target.closest("select")) return;
    if (providerId) navigate(`/provider/${providerId}`);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="overflow-hidden cursor-pointer" onDoubleClick={handleDoubleClick}>
      {/* Photos section */}
      {editingPhotos ? (
        <div className="p-4 space-y-3 border-b border-border">
          <MultiPhotoUploader photos={photoItems} onChange={setPhotoItems} max={8} />
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5 text-xs" onClick={savePhotos} disabled={savingPhotos}>
              <Save className="h-3 w-3" />
              {savingPhotos ? t("availability.saving", "Saving...") : t("settings.save", "Save")}
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingPhotos(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative group">
          {photos.length > 0 ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-0.5 overflow-hidden cursor-pointer aspect-[16/10] sm:aspect-[16/6]"
              onClick={() => {
                setGalleryIndex(0);
                setGalleryOpen(true);
              }}
            >
              {photos.slice(0, 3).map((url: string, i: number) => (
                <img
                  key={i}
                  src={url}
                  alt={s.photo_alts?.[i] || s.photo_captions?.[i] || s.title}
                  className={cn(
                    "h-full w-full object-cover object-center",
                    i > 0 && "hidden sm:block"
                  )}
                />
              ))}
            </div>
          ) : isOwner ? (
            <div className="flex h-24 items-center justify-center border-b border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
              {t("providerDashboard.noPhotos", "No photos yet")}
            </div>
          ) : null}
          {isOwner && (
            <button
              onClick={startEditPhotos}
              className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
              title={t("providerDashboard.editPhotos", "Edit photos")}
            >
              <span className="flex items-center gap-1.5 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow">
                <Camera className="h-3.5 w-3.5" />
                {t("providerDashboard.editPhotos", "Edit Photos")}
              </span>
            </button>
          )}
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Category */}
            {editingField === "category" ? (
              <div className="flex items-center gap-1.5 mb-1.5">
                <select
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                >
                  {[...SERVICE_CATEGORIES]
                    .map((group) => ({
                      ...group,
                      subgroups: [...group.subgroups].sort((a, b) =>
                        t(`serviceCategories.${a}`, a).localeCompare(t(`serviceCategories.${b}`, b))
                      ),
                    }))
                    .sort((a, b) =>
                      t(`serviceCategories.${a.group}`, a.group).localeCompare(t(`serviceCategories.${b.group}`, b.group))
                    )
                    .map((group) => (
                    <optgroup key={group.group} label={t(`serviceCategories.${group.group}`, group.group)}>
                      {group.subgroups.map((sub) => (
                        <option key={sub} value={sub}>{t(`serviceCategories.${sub}`, sub)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveField} disabled={savingField}>
                  <Save className="h-3.5 w-3.5 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingField(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mb-1.5">
                <Badge variant="secondary" className="text-xs">{String(t(`serviceCategories.${s.category}`, s.category))}</Badge>
                {isOwner && (
                  <button onClick={() => startEditField("category")} className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("common.edit", "Edit")}>
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Title */}
            {editingField === "title" ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Input value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} className="h-8 text-sm font-semibold" autoFocus />
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveField} disabled={savingField}>
                  <Save className="h-3.5 w-3.5 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingField(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="font-display font-semibold">{s.title}</p>
                {isOwner && (
                  <button onClick={() => startEditField("title")} className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("common.edit", "Edit")}>
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Description */}
            {editingField === "description" ? (
              <div className="mt-1 space-y-1.5">
                <Textarea value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} rows={2} className="text-sm" autoFocus />
                <div className="flex items-center gap-1.5">
                  <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveField} disabled={savingField}>
                    <Save className="h-3 w-3" />
                    {savingField ? t("availability.saving", "Saving...") : t("settings.save", "Save")}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingField(null)}>
                    {t("common.cancel", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1 mt-1">
                <p className="line-clamp-2 text-sm text-muted-foreground">{s.description || (isOwner ? t("provider.addDescription", "Add a description...") : "")}</p>
                {isOwner && (
                  <button onClick={() => startEditField("description")} className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("common.edit", "Edit")}>
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Price */}
          <div className="flex items-start gap-2">
            {editingPrice ? (
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-accent">$</span>
                <Input type="number" min="0" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} className="h-8 w-24 text-right font-display font-bold" />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={savePrice} disabled={savingPrice}>
                  <Save className="h-3.5 w-3.5 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingPrice(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="font-display text-lg font-bold text-accent">${Number(s.price).toFixed(2)}</span>
                {isOwner && (
                  <button onClick={startEditPrice} className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("common.edit", "Edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <PhotoGallery
        photos={photos}
        captions={s.photo_captions}
        alts={s.photo_alts}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        initialIndex={galleryIndex}
      />
      </Card>
      </TooltipTrigger>
      {!isOwner && (
        <TooltipContent side="top" className="text-xs">
          {t("services.doubleClickHint")}
        </TooltipContent>
      )}
    </Tooltip>
  );
};

export default ProfileServiceCard;
