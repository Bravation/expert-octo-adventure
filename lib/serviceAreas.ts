export type ServiceArea = {
  id: string;
  provider_id: string;
  area_type: "radius" | "zip" | "region";
  label: string;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_miles: number | null;
  is_active: boolean;
};

export type CustomerLocation = {
  lat?: number | null;
  lng?: number | null;
  zip?: string | null;
  city?: string | null;
  state?: string | null;
};

// Haversine distance in miles
export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const norm = (s: string | null | undefined) =>
  (s || "").trim().toLowerCase();

/**
 * Returns true if a provider with the given areas serves the customer's location.
 * If provider has no active areas, returns true (opt-in feature).
 */
export function matchesProviderAreas(
  customer: CustomerLocation | null | undefined,
  areas: ServiceArea[] | null | undefined,
): boolean {
  const active = (areas || []).filter((a) => a.is_active);
  if (active.length === 0) return true;
  if (!customer) return false;

  for (const a of active) {
    if (a.area_type === "radius") {
      if (
        customer.lat != null &&
        customer.lng != null &&
        a.latitude != null &&
        a.longitude != null &&
        a.radius_miles != null
      ) {
        const d = distanceMiles(
          customer.lat,
          customer.lng,
          a.latitude,
          a.longitude,
        );
        if (d <= Number(a.radius_miles) + 1) return true; // +1mi tolerance for rounded coords
      }
    } else if (a.area_type === "zip") {
      if (norm(a.zip_code) && norm(a.zip_code) === norm(customer.zip)) {
        return true;
      }
    } else if (a.area_type === "region") {
      const ac = norm(a.city);
      const as = norm(a.state);
      const cc = norm(customer.city);
      const cs = norm(customer.state);
      if (ac && cc && ac === cc) return true;
      if (!ac && as && cs && as === cs) return true;
    }
  }
  return false;
}