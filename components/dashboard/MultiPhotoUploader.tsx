import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type PhotoItem = { url: string; isNew: boolean; file?: File };

type Props = {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  max?: number;
};

const MultiPhotoUploader = ({ photos, onChange, max = 8 }: Props) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = max - photos.length;
    if (remaining <= 0) {
      toast.error(t("providerDashboard.maxPhotos", `Maximum ${max} photos allowed`));
      return;
    }

    const validFiles = files.slice(0, remaining).filter((f) => {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(t("providerDashboard.photoTooLarge", "Photo must be under 5MB"));
        return false;
      }
      return true;
    });

    const newPhotos: PhotoItem[] = validFiles.map((file) => ({
      url: URL.createObjectURL(file),
      isNew: true,
      file,
    }));

    onChange([...photos, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6"
                onClick={() => removePhoto(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {photos.length < max && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-24 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ImagePlus className="h-5 w-5" />
          {t("providerDashboard.uploadPhoto", "Upload a photo")} ({photos.length}/{max})
        </button>
      )}
    </div>
  );
};

export default MultiPhotoUploader;
export type { PhotoItem };
