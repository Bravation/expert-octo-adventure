import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Locate } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type LocationFilterProps = {
  onLocationChange: (loc: { lat: number; lng: number; label: string } | null) => void;
  initialZip?: string;
  onZipChange?: (zip: string) => void;
  autoDetect?: boolean;
};

const LocationFilter = ({ onLocationChange, initialZip = "", onZipChange, autoDetect = true }: LocationFilterProps) => {
  const { t } = useTranslation();
  const [zipCode, setZipCode] = useState(initialZip);
  const [detecting, setDetecting] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    if (initialZip) {
      handleZipSearch(initialZip);
    } else if (autoDetect) {
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("location.notSupported"));
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: t("location.myLocation") };
        onLocationChange(loc);
        setActiveLabel(loc.label);
        setDetecting(false);
      },
      () => {
        toast.error(t("location.denied"));
        setDetecting(false);
      }
    );
  };

  const handleZipSearch = async (overrideZip?: string) => {
    const zip = (overrideZip ?? zipCode).trim();
    if (!zip) {
      onLocationChange(null);
      setActiveLabel(null);
      onZipChange?.("");
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=us&format=json&limit=1`,
        { headers: { "User-Agent": "LovableApp/1.0" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const loc = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: zip };
        onLocationChange(loc);
        setActiveLabel(loc.label);
        onZipChange?.(zip);
      } else {
        toast.error(t("location.notFound", "ZIP code not found"));
        onLocationChange(null);
        setActiveLabel(null);
        onZipChange?.("");
      }
    } catch {
      toast.error(t("location.geocodeError", "Could not look up ZIP code"));
    }
  };

  const clearLocation = () => {
    setActiveLabel(null);
    setZipCode("");
    onLocationChange(null);
    onZipChange?.("");
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("location.zipPlaceholder")}
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleZipSearch()}
          className="pl-10"
        />
      </div>
      <Button variant="outline" size="icon" onClick={detectLocation} disabled={detecting} title={t("location.detect")}>
        <Locate className={`h-4 w-4 ${detecting ? "animate-pulse" : ""}`} />
      </Button>
      {activeLabel && (
        <Button variant="ghost" size="sm" onClick={clearLocation} className="text-xs text-muted-foreground">
          ✕ {activeLabel}
        </Button>
      )}
    </div>
  );
};

export default LocationFilter;
