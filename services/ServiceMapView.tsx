import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Locate, Loader2 } from "lucide-react";
import { X as XIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ServiceWithProvider } from "./ServiceCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Region presets with bounding boxes (SW, NE)
const REGION_BOUNDS: Record<string, L.LatLngBoundsLiteral> = {
  pr: [
    [17.85, -67.35],
    [18.55, -65.2],
  ],
  usvi: [
    [17.65, -65.1],
    [18.45, -64.55],
  ],
  dr: [
    [17.55, -72.05],
    [19.95, -68.3],
  ],
  caribbean: [
    [10.0, -85.0],
    [27.0, -59.0],
  ],
  florida: [
    [24.4, -87.7],
    [31.1, -79.9],
  ],
  us: [
    [24.5, -125.0],
    [49.5, -66.9],
  ],
  world: [
    [-60, -170],
    [75, 175],
  ],
};

type RegionKey = keyof typeof REGION_BOUNDS;
type RegionValue = RegionKey | "mine";

// Fix default marker icons for Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type GroupedProvider = {
  providerId: string;
  name: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  rating: number;
  totalReviews: number;
  services: ServiceWithProvider[];
};

type Props = {
  services: ServiceWithProvider[];
  onBook: (service: ServiceWithProvider) => void;
  onRequestQuote?: (service: ServiceWithProvider) => void;
  userLocation?: { lat: number; lng: number } | null;
  radiusMiles?: number;
};

const ServiceMapView = ({ services, onBook, onRequestQuote, userLocation, radiusMiles }: Props) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState<RegionValue>(() => {
    if (typeof window === "undefined") return "pr";
    try {
      const saved = window.localStorage.getItem("serviceMap.region");
      if (saved === "mine") return "mine";
      if (saved && saved in REGION_BOUNDS) return saved as RegionKey;
    } catch {
      // ignore (private mode, etc.)
    }
    return "pr";
  });
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [addressResults, setAddressResults] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([]);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const [lookupCancelledMsg, setLookupCancelledMsg] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("serviceMap.region", region);
    } catch {
      // ignore
    }
  }, [region]);

  const effectiveUserLocation = userLocation ?? myLocation;

  const requestMyLocation = (onSuccess?: (loc: { lat: number; lng: number }) => void) => {
    if (!("geolocation" in navigator)) {
      const msg = t("services.geolocationUnavailable");
      setLocationError(msg);
      toast({ title: msg, variant: "destructive" });
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        if (mapRef.current) mapRef.current.setView([loc.lat, loc.lng], 12);
        onSuccess?.(loc);
        setLocating(false);
        setLocationError(null);
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? t("services.geolocationDenied")
            : err.code === err.TIMEOUT
              ? t("services.geolocationTimeout")
              : t("services.geolocationUnavailable");
        setLocationError(msg);
        toast({ title: msg, variant: "destructive" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleRegionChange = (v: RegionValue) => {
    setRegion(v);
    if (v === "mine") requestMyLocation();
  };

  // If "mine" is restored from localStorage, fetch location on mount
  useEffect(() => {
    if (region === "mine" && !myLocation && !userLocation) {
      requestMyLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetToMyLocation = () => {
    try {
      window.localStorage.removeItem("serviceMap.region");
    } catch {
      // ignore
    }
    setRegion("mine");
    requestMyLocation();
  };

  const handleGeocodeAddress = async () => {
    const q = addressQuery.trim().slice(0, 200);
    if (!q) return;
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setGeocoding(true);
    setLookupCancelledMsg(false);
    setAddressResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("geocode_failed");
      const data: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
      if (!data.length) {
        toast({ title: t("services.addressNotFound"), variant: "destructive" });
        return;
      }
      const results = data.map((d) => ({
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        label: d.display_name,
      }));
      if (results.length === 1) {
        selectAddressResult(results[0]);
      } else {
        setAddressResults(results);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        // Cancelled by user — silent.
      } else {
        toast({ title: t("services.addressLookupFailed"), variant: "destructive" });
      }
    } finally {
      if (geocodeAbortRef.current === controller) {
        geocodeAbortRef.current = null;
      }
      setGeocoding(false);
    }
  };

  const cancelGeocode = () => {
    geocodeAbortRef.current?.abort();
    geocodeAbortRef.current = null;
    setGeocoding(false);
  };

  // Escape key cancels an in-flight Nominatim lookup.
  useEffect(() => {
    if (!geocoding) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelGeocode();
        setLookupCancelledMsg(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocoding]);

  // Auto-dismiss the "Lookup cancelled" notice after a short delay.
  useEffect(() => {
    if (!lookupCancelledMsg) return;
    const id = window.setTimeout(() => setLookupCancelledMsg(false), 3000);
    return () => window.clearTimeout(id);
  }, [lookupCancelledMsg]);

  const selectAddressResult = (r: { lat: number; lng: number; label: string }) => {
    const loc = { lat: r.lat, lng: r.lng };
    setMyLocation(loc);
    setRegion("mine");
    setLocationError(null);
    setAddressResults([]);
    setAddressQuery("");
    if (mapRef.current) mapRef.current.setView([loc.lat, loc.lng], 12);
  };

  // Group services by provider with valid coordinates
  const providers: GroupedProvider[] = [];
  const providerMap = new Map<string, GroupedProvider>();

  for (const s of services) {
    const lat = s.profiles?.latitude;
    const lng = s.profiles?.longitude;
    if (lat == null || lng == null) continue;

    const existing = providerMap.get(s.provider_id);
    if (existing) {
      existing.services.push(s);
    } else {
      const group: GroupedProvider = {
        providerId: s.provider_id,
        name: s.profiles?.full_name || t("services.provider"),
        lat,
        lng,
        city: s.profiles?.city || undefined,
        state: s.profiles?.state || undefined,
        rating: Number(s.profiles?.average_rating) || 0,
        totalReviews: s.profiles?.total_reviews || 0,
        services: [s],
      };
      providerMap.set(s.provider_id, group);
      providers.push(group);
    }
  }

  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : providers.length > 0
      ? [providers[0].lat, providers[0].lng]
      : [18.2208, -66.5901];

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous map if it exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current);
    mapRef.current = map;

    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 12);
    } else if (region === "mine" && myLocation) {
      map.setView([myLocation.lat, myLocation.lng], 12);
    } else if (providers.length > 0) {
      map.setView(defaultCenter, 11);
    } else if (region !== "mine") {
      map.fitBounds(REGION_BOUNDS[region], { padding: [20, 20] });
    } else {
      // "mine" selected but no location yet — fall back to PR bounds until resolved
      map.fitBounds(REGION_BOUNDS.pr, { padding: [20, 20] });
    }

    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const tileAttr = isDark
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

    L.tileLayer(tileUrl, { attribution: tileAttr }).addTo(map);

    // Add markers via cluster group
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    for (const p of providers) {
      const locationParts = [p.city, p.state].filter(Boolean).join(", ");
      const locationHtml = locationParts ? `<span class="mx-1">·</span><span>${locationParts}</span>` : "";

      const svcBg = isDark ? "#2a2a2e" : "#f3f4f6";
      const svcText = isDark ? "#e4e4e7" : "inherit";
      const mutedText = isDark ? "#a1a1aa" : "#888";
      const quoteBg = isDark ? "#27272a" : "#fff";
      const quoteText = isDark ? "#e4e4e7" : "#333";
      const quoteBorder = isDark ? "#3f3f46" : "#ddd";

      const servicesHtml = p.services
        .slice(0, 3)
        .map(
          (s) =>
            `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:4px;background:${svcBg};padding:4px 6px;margin-top:4px;">
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:${svcText};">${s.title}</span>
              <span style="font-size:12px;font-weight:600;white-space:nowrap;color:${svcText};">$${Number(s.price).toFixed(0)}</span>
            </div>`
        )
        .join("");

      const moreHtml =
        p.services.length > 3
          ? `<p style="font-size:11px;color:${mutedText};margin-top:4px;">+${p.services.length - 3} more</p>`
          : "";

      const popupContent = `
        <div style="min-width:220px;max-width:280px;">
          <a href="/provider/${p.providerId}" style="font-weight:600;font-size:14px;color:#2563eb;text-decoration:none;">${p.name}</a>
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:${mutedText};margin-top:4px;">
            <span>⭐ ${p.rating.toFixed(1)}</span>
            <span>(${p.totalReviews})</span>
            ${locationHtml}
          </div>
          <div style="margin-top:8px;max-height:120px;overflow-y:auto;">
            ${servicesHtml}
            ${moreHtml}
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="map-book-btn" data-service-id="${p.services[0].id}" style="flex:1;padding:4px 8px;font-size:12px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;">${t("services.bookNow")}</button>
            ${
              onRequestQuote
                ? `<button class="map-quote-btn" data-service-id="${p.services[0].id}" style="flex:1;padding:4px 8px;font-size:12px;background:${quoteBg};color:${quoteText};border:1px solid ${quoteBorder};border-radius:4px;cursor:pointer;">${t("services.requestQuote")}</button>`
                : ""
            }
          </div>
        </div>
      `;

      const marker = L.marker([p.lat, p.lng]);
      marker.bindPopup(popupContent, { minWidth: 240, maxWidth: 300 });
      clusterGroup.addLayer(marker);
    }

    map.addLayer(clusterGroup);

    // Handle popup button clicks via event delegation
    map.on("popupopen", () => {
      const container = map.getContainer();

      container.querySelectorAll(".map-book-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = (e.target as HTMLElement).getAttribute("data-service-id");
          const svc = services.find((s) => s.id === id);
          if (svc) onBook(svc);
        });
      });

      container.querySelectorAll(".map-quote-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = (e.target as HTMLElement).getAttribute("data-service-id");
          const svc = services.find((s) => s.id === id);
          if (svc && onRequestQuote) onRequestQuote(svc);
        });
      });
    });

    // Radius circle overlay + recenter if user location available
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 12);

      if (radiusMiles) {
        const radiusMeters = radiusMiles * 1609.34;
        const circle = L.circle([userLocation.lat, userLocation.lng], {
          radius: radiusMeters,
          color: "hsl(221, 83%, 53%)",
          fillColor: "hsl(221, 83%, 53%)",
          fillOpacity: 0.08,
          weight: 2,
          dashArray: "6 4",
        }).addTo(map);

        // Label at top of circle
        const bounds = circle.getBounds();
        const topPoint = bounds.getNorth();
        const icon = L.divIcon({
          className: "",
          html: `<span style="background:hsl(221,83%,53%);color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);">${radiusMiles} mi</span>`,
          iconAnchor: [20, 12],
        });
        L.marker([topPoint, userLocation.lng], { icon, interactive: false }).addTo(map);
      }
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers.length, userLocation?.lat, userLocation?.lng, myLocation?.lat, myLocation?.lng, radiusMiles, isDark, region]);

  // Refit when user changes region (only meaningful when no userLocation override)
  useEffect(() => {
    if (!mapRef.current) return;
    if (region === "mine") {
      if (myLocation) mapRef.current.setView([myLocation.lat, myLocation.lng], 12);
      return;
    }
    if (effectiveUserLocation) return;
    mapRef.current.fitBounds(REGION_BOUNDS[region], { padding: [20, 20] });
  }, [region, effectiveUserLocation, myLocation]);

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetToMyLocation}
          className="gap-1"
          disabled={locating}
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
          {locating ? t("services.locating") : t("services.resetToMyLocation")}
        </Button>
        <span className="text-sm text-muted-foreground">{t("services.region")}</span>
        <Select
          value={region}
          onValueChange={(v) => handleRegionChange(v as RegionValue)}
          disabled={locating}
        >
          <SelectTrigger className="w-[200px]">
            {locating ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("services.locating")}
              </span>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">{t("services.regions.mine")}</SelectItem>
            <SelectItem value="pr">{t("services.regions.pr")}</SelectItem>
            <SelectItem value="usvi">{t("services.regions.usvi")}</SelectItem>
            <SelectItem value="dr">{t("services.regions.dr")}</SelectItem>
            <SelectItem value="caribbean">{t("services.regions.caribbean")}</SelectItem>
            <SelectItem value="florida">{t("services.regions.florida")}</SelectItem>
            <SelectItem value="us">{t("services.regions.us")}</SelectItem>
            <SelectItem value="world">{t("services.regions.world")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {locationError && (
        <div
          role="alert"
          className="mb-3 flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <div className="flex items-center justify-between gap-2">
            <span>{locationError}</span>
            <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => requestMyLocation()}
              disabled={locating}
            >
              {locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Locate className="h-3.5 w-3.5" />
              )}
              {t("services.retry")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => setLocationError(null)}
            >
              {t("services.dismissError")}
            </Button>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGeocodeAddress();
            }}
            className="flex items-center gap-2"
          >
            <Input
              type="text"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              placeholder={t("services.addressPlaceholder")}
              maxLength={200}
              className="h-8 flex-1 bg-background text-foreground"
              disabled={geocoding}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled={geocoding || !addressQuery.trim()}
            >
              {geocoding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              {t("services.searchAddress")}
            </Button>
          </form>
          {geocoding && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-2 text-xs text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>{t("services.searchingAddress")}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={cancelGeocode}
              >
                <XIcon className="h-3.5 w-3.5" />
                {t("services.cancel")}
              </Button>
            </div>
          )}
          {!geocoding && lookupCancelledMsg && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
            >
              {t("services.lookupCancelled")}
            </div>
          )}
          {addressResults.length > 0 && (
            <div className="rounded-md border border-border bg-background text-foreground">
              <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
                <span>{t("services.addressResults")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setAddressResults([])}
                >
                  {t("services.clearResults")}
                </Button>
              </div>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border">
                {addressResults.map((r, i) => (
                  <li key={`${r.lat},${r.lng},${i}`}>
                    <button
                      type="button"
                      onClick={() => selectAddressResult(r)}
                      className="flex w-full items-start gap-2 px-2 py-2 text-left text-xs hover:bg-muted"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{r.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border border-border"
        style={{ height: "65vh", minHeight: 400 }}
      />
      {locating && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 shadow-md backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("services.locating")}</p>
          </div>
        </div>
      )}
      {providers.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 shadow-md backdrop-blur">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("services.noProvidersOnMap")}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceMapView;
