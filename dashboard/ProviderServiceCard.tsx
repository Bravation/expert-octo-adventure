import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { resolveServiceImage, handleServiceImageError } from "@/lib/serviceImages";

type Service = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  photo_url?: string | null;
  photo_urls?: string[] | null;
};

type Props = {
  service: Service;
  providerId?: string;
  onEdit: (service: Service) => void;
  onDeleted: () => void;
};

const ProviderServiceCard = ({ service, providerId, onEdit, onDeleted }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("services").delete().eq("id", service.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("providerDashboard.serviceDeleted", "Service deleted"));
      onDeleted();
    }
    setDeleting(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input") || target.closest("textarea") || target.closest("select")) return;
    if (providerId) navigate(`/provider/${providerId}`);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
    <Card className="group overflow-hidden cursor-pointer" onDoubleClick={handleDoubleClick}>
      {(() => {
        const validPhotos = (service.photo_urls?.length ? service.photo_urls : service.photo_url ? [service.photo_url] : [])
          .filter((u): u is string => typeof u === "string" && u.trim().length > 0 && u !== "/placeholder.svg");
        const photos = validPhotos.length > 0
          ? validPhotos.slice(0, 3)
          : [resolveServiceImage(service.photo_url, service.photo_urls, service.category)];
        return (
          <div className="flex h-36 gap-0.5 overflow-hidden">
            {photos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={service.title}
                onError={handleServiceImageError(service.category)}
                className="h-full flex-1 object-cover"
              />
            ))}
          </div>
        );
      })()}
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <Badge variant="secondary" className="mb-2">
              {t(`serviceCategories.${service.category}`, service.category)}
            </Badge>
            <p className="font-display font-semibold">{service.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
          </div>
          <span className="shrink-0 font-display font-bold text-primary">
            ${Number(service.price).toFixed(2)}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(service)}>
            <Pencil className="h-3.5 w-3.5" />
            {t("providerDashboard.edit", "Edit")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                {t("providerDashboard.delete", "Delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("providerDashboard.deleteConfirmTitle", "Delete service?")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("providerDashboard.deleteConfirmDesc", "This action cannot be undone. This will permanently delete your service listing.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("providerDashboard.cancel", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting
                    ? t("providerDashboard.deleting", "Deleting...")
                    : t("providerDashboard.confirmDelete", "Delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {t("services.doubleClickHint")}
      </TooltipContent>
    </Tooltip>
  );
};

export default ProviderServiceCard;
