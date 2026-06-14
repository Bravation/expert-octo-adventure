import { SUBGROUP_TO_GROUP } from "@/constants/serviceCategories";

// Curated, license-safe Unsplash images keyed by category group.
// Each URL uses the public Unsplash CDN with sizing params.
const GROUP_IMAGES: Record<string, string> = {
  "Animal & Agricultural Services": "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=800&q=80",
  "Automotive Services": "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80",
  "Beauty & Grooming": "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
  "Childcare & Family Services": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80",
  "Content Creation": "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
  "Corporate & Administrative": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
  "Creative & Performing Arts": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
  "Education & Training Services": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80",
  "Events": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80",
  "Fashion & Textile Services": "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80",
  "Financial & Legal": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80",
  "Food Services": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
  "Funeral & Memorial Services": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=800&q=80",
  "Health & Wellness": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80",
  "Health, Science & Technical Services": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80",
  "Home Improvement": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
  "Home Maintenance": "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80",
  "Hospitality": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80",
  "Insurance & Risk Services": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80",
  "Lifestyle & Convenience": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
  "Logistics, Delivery & Transportation": "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80",
  "Maintenance & Support Services": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
  "Marine & Watercraft Services": "https://images.unsplash.com/photo-1502209524164-acea936639a2?auto=format&fit=crop&w=800&q=80",
  "Marketing & Advertising": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
  "Real Estate Services": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
  "Security Services": "https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?auto=format&fit=crop&w=800&q=80",
  "Specialized Niches": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  "Sustainability & Eco Services": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80",
  "Technology & IT": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  "Travel & Tourism": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80",
  "Visual Design": "https://images.unsplash.com/photo-1561070791-2526d30994b8?auto=format&fit=crop&w=800&q=80",
  "Writing & Publishing": "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
};

const GENERIC_FALLBACK =
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80";

/**
 * Returns a category-appropriate Unsplash image URL for a given service category.
 * `category` may be a subgroup (e.g. "Plumbing") or a group name.
 */
export function getCategoryFallbackImage(category?: string | null): string {
  if (!category) return GENERIC_FALLBACK;
  if (GROUP_IMAGES[category]) return GROUP_IMAGES[category];
  const group = SUBGROUP_TO_GROUP[category];
  if (group && GROUP_IMAGES[group]) return GROUP_IMAGES[group];
  return GENERIC_FALLBACK;
}

/**
 * Returns the first valid-looking photo URL, or a category fallback.
 * Treats empty strings, "/placeholder.svg", and null/undefined as missing.
 */
export function resolveServiceImage(
  photoUrl?: string | null,
  photoUrls?: string[] | null,
  category?: string | null,
): string {
  const candidates = [
    ...(photoUrls ?? []),
    ...(photoUrl ? [photoUrl] : []),
  ].filter((u): u is string => typeof u === "string" && u.trim().length > 0 && u !== "/placeholder.svg");
  return candidates[0] ?? getCategoryFallbackImage(category);
}

/**
 * onError handler for <img> tags: swaps the src to a category fallback once,
 * preventing infinite loops if the fallback itself fails.
 */
export function handleServiceImageError(
  category?: string | null,
): React.ReactEventHandler<HTMLImageElement> {
  return (event) => {
    const img = event.currentTarget;
    const fallback = getCategoryFallbackImage(category);
    if (img.dataset.fallbackApplied === "true") return;
    img.dataset.fallbackApplied = "true";
    img.src = fallback;
  };
}