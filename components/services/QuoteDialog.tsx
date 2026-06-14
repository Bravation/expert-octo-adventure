import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import type { ServiceWithProvider } from "./ServiceCard";

type QuoteDialogProps = {
  service: ServiceWithProvider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { price: number; description: string }) => void;
  loading?: boolean;
};

const QuoteDialog = ({ service, open, onOpenChange, onSubmit, loading }: QuoteDialogProps) => {
  const { t } = useTranslation();
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ price: parseFloat(price), description });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{t("quote.requestTitle")}</DialogTitle>
        </DialogHeader>
        {service && (
          <div className="rounded-lg bg-muted/50 p-3 mb-2">
            <p className="font-display font-semibold">{service.title}</p>
            <p className="text-sm text-muted-foreground">
              {t("services.by")} {service.profiles?.full_name} · {t("quote.listedPrice")}: ${Number(service.price).toFixed(2)}
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("quote.yourBudget")}</Label>
            <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("quote.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("quote.descPlaceholder")} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("quote.sending") : t("quote.sendRequest")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteDialog;
