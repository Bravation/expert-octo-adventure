import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, MapPin, Trash2, Target, Map as MapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ServiceArea } from "@/lib/serviceAreas";

const ServiceAreasSection = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [tab, setTab] = useState<"radius" | "zip" | "region">("radius");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(25);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAreas = async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from("provider_service_areas" as any)
      .select("*")
      .eq("provider_id", profile.id)
      .order("created_at", { ascending: false });
    if (!error) setAreas((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const resetForm = () => {
    setZip("");
    setRadius(25);
    setCity("");
    setState("");
    setTab("radius");
  };

  const geocodeZip = async (
    z: string,
  ): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(z)}&country=us&format=json&limit=1`,
        { headers: { "User-Agent": "LovableApp/1.0" } },
      );
      const data = await res.json();
      if (data?.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {
      // ignore
    }
    return null;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    let payload: Partial<ServiceArea> & { provider_id: string } = {
      provider_id: profile.id,
      area_type: tab,
      label: "",
      is_active: true,
    } as any;

    if (tab === "radius") {
      if (!zip.trim()) {
        toast.error(t("serviceAreas.zipRequired", "ZIP code is required"));
        setSaving(false);
        return;
      }
      const coords = await geocodeZip(zip.trim());
      if (!coords) {
        toast.error(t("serviceAreas.zipNotFound", "ZIP code not found"));
        setSaving(false);
        return;
      }
      payload = {
        ...payload,
        zip_code: zip.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        radius_miles: radius,
        label: `${radius} mi around ${zip.trim()}`,
      };
    } else if (tab === "zip") {
      if (!zip.trim()) {
        toast.error(t("serviceAreas.zipRequired", "ZIP code is required"));
        setSaving(false);
        return;
      }
      payload = {
        ...payload,
        zip_code: zip.trim(),
        label: `ZIP ${zip.trim()}`,
      };
    } else {
      if (!city.trim() && !state.trim()) {
        toast.error(t("serviceAreas.cityOrStateRequired", "City or state is required"));
        setSaving(false);
        return;
      }
      payload = {
        ...payload,
        city: city.trim(),
        state: state.trim(),
        label: [city.trim(), state.trim()].filter(Boolean).join(", "),
      };
    }

    const { error } = await supabase
      .from("provider_service_areas" as any)
      .insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("serviceAreas.added", "Service area added"));
    setDialogOpen(false);
    resetForm();
    fetchAreas();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("provider_service_areas" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("serviceAreas.deleted", "Service area removed"));
    fetchAreas();
  };

  const handleToggle = async (id: string, value: boolean) => {
    const { error } = await supabase
      .from("provider_service_areas" as any)
      .update({ is_active: value })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    fetchAreas();
  };

  const iconFor = (type: ServiceArea["area_type"]) => {
    if (type === "radius") return <Target className="h-4 w-4" />;
    if (type === "zip") return <MapPin className="h-4 w-4" />;
    return <MapIcon className="h-4 w-4" />;
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {t("serviceAreas.heading", "Service Areas")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "serviceAreas.subtitle",
              "Choose where you accept jobs. Leave empty to appear everywhere.",
            )}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {t("serviceAreas.add", "Add area")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">
                {t("serviceAreas.addNew", "Add a service area")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="radius">
                    {t("serviceAreas.tabRadius", "Radius")}
                  </TabsTrigger>
                  <TabsTrigger value="zip">
                    {t("serviceAreas.tabZip", "ZIP")}
                  </TabsTrigger>
                  <TabsTrigger value="region">
                    {t("serviceAreas.tabRegion", "Region")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="radius" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>{t("serviceAreas.centerZip", "Center ZIP code")}</Label>
                    <Input
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="10001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {t("serviceAreas.radius", "Radius")}: {radius} mi
                    </Label>
                    <Slider
                      value={[radius]}
                      onValueChange={(v) => setRadius(v[0])}
                      min={5}
                      max={100}
                      step={5}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="zip" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>{t("serviceAreas.zipCode", "ZIP code")}</Label>
                    <Input
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="10001"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "serviceAreas.zipHint",
                        "Add one area per ZIP code. You can add several.",
                      )}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="region" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{t("serviceAreas.city", "City")}</Label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Brooklyn"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("serviceAreas.state", "State")}</Label>
                      <Input
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="NY"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving
                  ? t("serviceAreas.saving", "Saving...")
                  : t("serviceAreas.save", "Save area")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
      ) : areas.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-6 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">
            {t("serviceAreas.empty", "No service areas yet")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(
              "serviceAreas.emptyHint",
              "Without areas, you appear in every customer search. Add one to focus on specific places.",
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {areas.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {iconFor(a.area_type)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.label}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {t(`serviceAreas.type_${a.area_type}`, a.area_type)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={a.is_active}
                    onCheckedChange={(v) => handleToggle(a.id, v)}
                    aria-label={t("serviceAreas.toggleActive", "Toggle active")}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(a.id)}
                    aria-label={t("serviceAreas.delete", "Delete")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceAreasSection;