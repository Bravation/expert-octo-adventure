import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight, X, List, Map as MapIcon, Star, Share2, Sparkles, RotateCcw } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SERVICE_CATEGORIES, SUBGROUP_TO_GROUP } from "@/constants/serviceCategories";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import ServiceCard, { type ServiceWithProvider } from "@/components/services/ServiceCard";
import BookingDialog from "@/components/services/BookingDialog";
import QuoteDialog from "@/components/services/QuoteDialog";
import RequestServiceDialog from "@/components/services/RequestServiceDialog";
import LocationFilter from "@/components/services/LocationFilter";
import SearchAutocomplete from "@/components/services/SearchAutocomplete";
import AdvancedFilters, { type AdvancedFiltersState } from "@/components/services/AdvancedFilters";

import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Skeleton } from "@/components/ui/skeleton";
import BackToTop from "@/components/BackToTop";
import ServiceRecommendations from "@/components/services/ServiceRecommendations";
import ServiceMapView from "@/components/services/ServiceMapView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { matchesProviderAreas, type ServiceArea, type CustomerLocation } from "@/lib/serviceAreas";

const FILTERS_STORAGE_KEY = "services:lastFilters";

type StoredFilters = {
  q?: string | null;
  group?: string | null;
  sub?: string | null;
  sort?: string | null;
  minRating?: number | null;
  newOnly?: boolean;
};

const loadStoredFilters = (): StoredFilters => {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredFilters) : {};
  } catch {
    return {};
  }
};

const Services = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // If URL has no relevant filter params, hydrate from localStorage
  const hasUrlFilters =
    !!searchParams.get("q") ||
    !!searchParams.get("group") ||
    !!searchParams.get("sub") ||
    !!searchParams.get("sort") ||
    !!searchParams.get("minRating") ||
    !!searchParams.get("new");
  const stored = hasUrlFilters ? {} : loadStoredFilters();

  const [services, setServices] = useState<ServiceWithProvider[]>([]);
  const [providerAreas, setProviderAreas] = useState<Map<string, ServiceArea[]>>(new Map());
  const [search, setSearch] = useState(searchParams.get("q") ?? stored.q ?? "");
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    searchParams.get("group") ?? stored.group ?? null
  );
  const [selectedSubgroup, setSelectedSubgroup] = useState<string | null>(
    searchParams.get("sub") ?? stored.sub ?? null
  );
  const initialGroup = searchParams.get("group") ?? stored.group ?? null;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(initialGroup ? [initialGroup] : [])
  );
  const [showSidebar, setShowSidebar] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("services_view_mode") : null;
    return saved === "map" || saved === "list" ? saved : "list";
  });
  useEffect(() => {
    try { localStorage.setItem("services_view_mode", viewMode); } catch {}
  }, [viewMode]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [zipParam, setZipParam] = useState<string>(searchParams.get("zip") || "");
  const [maxDistanceMi, setMaxDistanceMi] = useState(() => {
    const v = parseInt(searchParams.get("dist") || "", 10);
    return Number.isFinite(v) && v > 0 ? v : 30;
  });
  const [newOnly, setNewOnly] = useState(
    searchParams.get("new") ? searchParams.get("new") === "1" : !!stored.newOnly
  );
  const [bookingService, setBookingService] = useState<ServiceWithProvider | null>(null);
  const [quoteService, setQuoteService] = useState<ServiceWithProvider | null>(null);
  const [requestService, setRequestService] = useState<ServiceWithProvider | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(12);
  const [loadingMore, setLoadingMore] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(() => {
    const minRParam = parseInt(searchParams.get("minRating") || "", 10);
    const minRFromUrl = Number.isFinite(minRParam) && minRParam >= 1 && minRParam <= 5 ? minRParam : null;
    const minR = searchParams.get("minRating") ? minRFromUrl : (stored.minRating ?? null);
    const sort = searchParams.get("sort") || stored.sort || "relevance";
    return {
      priceRange: [0, 1000],
      minRating: minR,
      availabilityFilter: null,
      sortBy: sort,
    };
  });
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Sync filters to URL query string
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const setOrDel = (key: string, val: string | null | undefined) => {
      if (val) params.set(key, val);
      else params.delete(key);
    };
    setOrDel("q", search.trim() || null);
    setOrDel("sort", advancedFilters.sortBy && advancedFilters.sortBy !== "relevance" ? advancedFilters.sortBy : null);
    setOrDel("zip", zipParam || null);
    setOrDel("group", selectedGroup);
    setOrDel("sub", selectedSubgroup);
    setOrDel("minRating", advancedFilters.minRating ? String(advancedFilters.minRating) : null);
    setOrDel("dist", maxDistanceMi !== 30 ? String(maxDistanceMi) : null);
    setOrDel("new", newOnly ? "1" : null);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, advancedFilters.sortBy, advancedFilters.minRating, zipParam, selectedGroup, selectedSubgroup, maxDistanceMi, newOnly]);

  // Persist user's last-used filters to localStorage
  useEffect(() => {
    try {
      const data: StoredFilters = {
        q: search.trim() || null,
        group: selectedGroup,
        sub: selectedSubgroup,
        sort: advancedFilters.sortBy && advancedFilters.sortBy !== "relevance" ? advancedFilters.sortBy : null,
        minRating: advancedFilters.minRating,
        newOnly,
      };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage errors (private mode, quota)
    }
  }, [search, selectedGroup, selectedSubgroup, advancedFilters.sortBy, advancedFilters.minRating, newOnly]);

  useEffect(() => { fetchServices(); }, []);

  const fetchServices = async () => {
    const [servicesRes, providersRes, areasRes] = await Promise.all([
      supabase
        .from("services")
        .select("id, title, description, price, category, provider_id, photo_url, photo_urls, photo_captions, photo_alts, status, created_at, updated_at")
        .eq("status", "available"),
      supabase
        .from("public_provider_profiles" as any)
        .select("id, full_name, avatar_url, city, state, average_rating, total_reviews, total_services_completed, latitude, longitude"),
      supabase
        .from("public_provider_service_areas" as any)
        .select("id, provider_id, area_type, label, zip_code, city, state, latitude, longitude, radius_miles, is_active"),
    ]);
    if (servicesRes.error) console.error(servicesRes.error);
    else {
      const providerMap = new Map((providersRes.data as any[] || []).map((p: any) => [p.id, p]));
      const servicesData = ((servicesRes.data as any) || []).map((s: any) => ({
        ...s,
        profiles: providerMap.get(s.provider_id) || null,
      }));
      setServices(servicesData);
      const aMap = new Map<string, ServiceArea[]>();
      ((areasRes.data as any[]) || []).forEach((a: any) => {
        const list = aMap.get(a.provider_id) || [];
        list.push(a as ServiceArea);
        aMap.set(a.provider_id, list);
      });
      setProviderAreas(aMap);
      if (servicesData.length > 0) {
        const maxServicePrice = Math.max(...servicesData.map((s: any) => s.price || 0));
        setAdvancedFilters(prev => ({
          ...prev,
          priceRange: [prev.priceRange[0], Math.max(prev.priceRange[1], maxServicePrice)]
        }));
      }
    }
    setLoading(false);
  };

  const handleBook = (service: ServiceWithProvider) => {
    if (!user) { navigate("/auth"); return; }
    if (profile?.role !== "customer") { toast.error(t("services.onlyCustomers")); return; }
    setBookingService(service);
  };

  const [customerFeePercentage, setCustomerFeePercentage] = useState(10);

  // Fetch customer's discounted booking fee
  useEffect(() => {
    if (!profile) return;
    supabase
      .from("customer_milestones" as any)
      .select("current_booking_fee_percentage")
      .eq("customer_id", profile.id)
      .single()
      .then(({ data }) => {
        if (data) setCustomerFeePercentage(Number((data as any).current_booking_fee_percentage));
      });
  }, [profile]);

  const confirmBooking = async (data: { date: Date; time: string; hours: number; notes: string; payWithPayPal: boolean; paymentMethod?: "paypal" | "stripe" }) => {
    if (!profile || !bookingService) return;
    setBookingLoading(true);

    const servicePrice = Number(bookingService.price);
    const bookingFee = +(servicePrice * customerFeePercentage / 100).toFixed(2);
    const totalPrice = +(servicePrice + bookingFee).toFixed(2);

    // Create the booking with fee breakdown
    const { data: bookingData, error } = await supabase.from("bookings").insert({
      customer_id: profile.id,
      service_id: bookingService.id,
      provider_id: bookingService.provider_id,
      total_price: totalPrice,
      service_price: servicePrice,
      booking_fee: bookingFee,
      booking_fee_percentage: customerFeePercentage,
      booking_fee_status: 'unpaid',
      service_payment_status: 'unpaid',
      scheduled_date: data.date.toISOString().split("T")[0],
      scheduled_time: data.time,
      estimated_hours: data.hours,
      notes: data.notes,
    } as any).select("id").single();

    if (error) {
      setBookingLoading(false);
      toast.error(error.message);
      return;
    }

    // Stripe Connect full payment flow
    if (data.paymentMethod === "stripe" && bookingData) {
      try {
        const { data: stripeData, error: stripeErr } = await supabase.functions.invoke("stripe-create-booking-checkout", {
          body: { booking_id: bookingData.id, origin: window.location.origin },
        });
        if (stripeErr || !stripeData?.url) {
          throw new Error((stripeData as any)?.error || stripeErr?.message || "Stripe checkout failed");
        }
        window.location.href = stripeData.url;
        return;
      } catch (err: any) {
        setBookingLoading(false);
        toast.error(err.message || "Stripe checkout failed");
        return;
      }
    }

    // Pay booking fee via PayPal
    if (data.payWithPayPal && bookingData) {
      try {
        const returnUrl = `${window.location.origin}/paypal-return?booking_id=${bookingData.id}&payment_type=booking_fee`;
        const cancelUrl = `${window.location.origin}/services`;
        const { data: paypalData, error: paypalError } = await supabase.functions.invoke("paypal-checkout", {
          body: {
            action: "create-order",
            booking_id: bookingData.id,
            amount: bookingFee,
            payment_type: "booking_fee",
            currency: "USD",
            description: `Booking Fee - ${bookingService.title}`,
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        });

        if (paypalError || !paypalData?.success) {
          throw new Error(paypalData?.error || paypalError?.message || "PayPal error");
        }

        const approvalUrl = paypalData.approval_url;
        if (approvalUrl) {
          window.location.href = approvalUrl;
          return;
        }
        throw new Error("No approval URL returned");
      } catch (err: any) {
        setBookingLoading(false);
        toast.error(err.message || "PayPal checkout failed");
        return;
      }
    }

    setBookingLoading(false);
    toast.success(t("services.bookingCreated"));
    setBookingService(null);
    navigate("/dashboard");
  };

  const handleRequestQuote = (service: ServiceWithProvider) => {
    if (!user) { navigate("/auth"); return; }
    if (profile?.role !== "customer") { toast.error(t("services.onlyCustomers")); return; }
    setQuoteService(service);
  };

  const handleRequestService = (service: ServiceWithProvider) => {
    if (!user) { navigate("/auth"); return; }
    if (profile?.role !== "customer") { toast.error(t("services.onlyCustomers")); return; }
    setRequestService(service);
  };

  const submitServiceRequest = async (data: { preferredDate: string; preferredTime: string; location: string; details: string }) => {
    if (!profile || !requestService) return;
    setRequestLoading(true);
    const parts: string[] = [t("requestService.tagPrefix", "[Service Request]")];
    if (data.preferredDate) parts.push(`${t("requestService.preferredDate", "Preferred Date")}: ${data.preferredDate}`);
    if (data.preferredTime) parts.push(`${t("requestService.preferredTime", "Preferred Time")}: ${data.preferredTime}`);
    if (data.location) parts.push(`${t("requestService.location", "Service Location")}: ${data.location}`);
    parts.push(`${t("requestService.details", "Details")}: ${data.details}`);
    const description = parts.join("\n");
    const { error } = await supabase.from("custom_quotes").insert({
      service_id: requestService.id,
      provider_id: requestService.provider_id,
      customer_id: profile.id,
      custom_price: Number(requestService.price),
      description,
    });
    setRequestLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("requestService.sent", "Request sent! The provider will respond shortly."));
      setRequestService(null);
    }
  };

  const submitQuote = async (data: { price: number; description: string }) => {
    if (!profile || !quoteService) return;
    setQuoteLoading(true);
    const { error } = await supabase.from("custom_quotes").insert({
      service_id: quoteService.id,
      provider_id: quoteService.provider_id,
      customer_id: profile.id,
      custom_price: data.price,
      description: data.description,
    });
    setQuoteLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("quote.sent"));
      setQuoteService(null);
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const selectSubgroup = (subgroup: string) => {
    setSelectedSubgroup(subgroup);
    setSelectedGroup(SUBGROUP_TO_GROUP[subgroup] || null);
    setShowSidebar(false);
  };

  const selectGroup = (group: string) => {
    setSelectedGroup(group);
    setSelectedSubgroup(null);
    setShowSidebar(false);
  };

  const clearFilter = () => { setSelectedGroup(null); setSelectedSubgroup(null); };

  const resetAllFilters = () => {
    setSearch("");
    setSelectedGroup(null);
    setSelectedSubgroup(null);
    setExpandedGroups(new Set());
    setNewOnly(false);
    setZipParam("");
    setUserLocation(null);
    setMaxDistanceMi(30);
    setAdvancedFilters({
      priceRange: [0, 1000],
      minRating: null,
      availabilityFilter: null,
      sortBy: "relevance",
    });
    try {
      localStorage.removeItem(FILTERS_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSearchParams(new URLSearchParams(), { replace: true });
    toast.success(t("services.filtersReset", "Filters reset"));
  };

  // Haversine distance in km
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getDistance = (s: ServiceWithProvider): number | null => {
    if (!userLocation || !userLocation.lat || !userLocation.lng) return null;
    const pLat = s.profiles?.latitude;
    const pLng = s.profiles?.longitude;
    if (pLat == null || pLng == null) return null;
    return haversine(userLocation.lat, userLocation.lng, pLat, pLng) * 0.621371;
  };

  // Smart ranking: location first if set, then custom sort, then defaults
  const rankServices = (list: ServiceWithProvider[]) => {
    const hasLocation = !!(userLocation?.lat && userLocation?.lng);
    return [...list].sort((a, b) => {
      // Pre-sort by distance for relevance & nearest when location is set
      if (hasLocation && (advancedFilters.sortBy === "relevance" || advancedFilters.sortBy === "nearest")) {
        const distA = getDistance(a);
        const distB = getDistance(b);
        if (distA != null && distB == null) return -1;
        if (distA == null && distB != null) return 1;
        if (distA != null && distB != null && distA !== distB) return distA - distB;
        if (advancedFilters.sortBy === "nearest") return 0;
      }

      // Apply custom sorting
      const completedTiebreak = (Number(b.profiles?.total_services_completed) || 0) - (Number(a.profiles?.total_services_completed) || 0);

      switch (advancedFilters.sortBy) {
        case "nearest":
          return completedTiebreak;
        case "price_low": {
          const priceDiff = (a.price || 0) - (b.price || 0);
          if (priceDiff !== 0) return priceDiff;
          return completedTiebreak;
        }
        case "price_high": {
          const priceDiff = (b.price || 0) - (a.price || 0);
          if (priceDiff !== 0) return priceDiff;
          return completedTiebreak;
        }
        case "rating": {
          const ratingDiff = (Number(b.profiles?.average_rating) || 0) - (Number(a.profiles?.average_rating) || 0);
          if (ratingDiff !== 0) return ratingDiff;
          const reviewDiff = (b.profiles?.total_reviews || 0) - (a.profiles?.total_reviews || 0);
          if (reviewDiff !== 0) return reviewDiff;
          const dateDiff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          if (dateDiff !== 0) return dateDiff;
          return completedTiebreak;
        }
        case "reviews": {
          const reviewDiff = (b.profiles?.total_reviews || 0) - (a.profiles?.total_reviews || 0);
          if (reviewDiff !== 0) return reviewDiff;
          const ratingDiff = (Number(b.profiles?.average_rating) || 0) - (Number(a.profiles?.average_rating) || 0);
          if (ratingDiff !== 0) return ratingDiff;
          const dateDiff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          if (dateDiff !== 0) return dateDiff;
          return completedTiebreak;
        }
        case "newest": {
          const dateDiff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          if (dateDiff !== 0) return dateDiff;
          const ratingDiff = (Number(b.profiles?.average_rating) || 0) - (Number(a.profiles?.average_rating) || 0);
          if (ratingDiff !== 0) return ratingDiff;
          const reviewDiff = (Number(b.profiles?.total_reviews) || 0) - (Number(a.profiles?.total_reviews) || 0);
          if (reviewDiff !== 0) return reviewDiff;
          return completedTiebreak;
        }
        default: { // relevance
          const ratingA = Number(a.profiles?.average_rating) || 0;
          const ratingB = Number(b.profiles?.average_rating) || 0;
          if (ratingB !== ratingA) return ratingB - ratingA;
          if (completedTiebreak !== 0) return completedTiebreak;
          return a.title.localeCompare(b.title);
        }
      }
    });
  };

  const norm = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtered = rankServices(
    services.filter((s) => {
      const q = norm(search);
      const matchesSearch = !search ||
        norm(s.title).includes(q) ||
        norm(s.category || "").includes(q) ||
        norm(s.description || "").includes(q);
        
      // Distance filter
      if (userLocation?.lat && userLocation?.lng) {
        const dist = getDistance(s);
        if (dist != null && dist > maxDistanceMi) return false;
      }

      // Provider service-area filter (only when customer has a location)
      if (userLocation?.lat && userLocation?.lng) {
        const areas = providerAreas.get(s.provider_id) || [];
        if (areas.length > 0) {
          const customerLoc: CustomerLocation = {
            lat: userLocation.lat,
            lng: userLocation.lng,
            zip: zipParam || null,
            city: profile?.city || null,
            state: profile?.state || null,
          };
          if (!matchesProviderAreas(customerLoc, areas)) return false;
        }
      }
      
      // Price range filter
      const price = s.price || 0;
      if (price < advancedFilters.priceRange[0] || price > advancedFilters.priceRange[1]) {
        return false;
      }
      
      // Rating filter
      if (advancedFilters.minRating !== null) {
        const rating = Number(s.profiles?.average_rating) || 0;
        if (rating < advancedFilters.minRating) return false;
      }

      // New only filter (created in last 7 days)
      if (newOnly) {
        if (!s.created_at) return false;
        const ageDays = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > 7) return false;
      }
      
      // Category filters
      if (selectedSubgroup) return matchesSearch && s.category === selectedSubgroup;
      if (selectedGroup) {
        const groupCat = SERVICE_CATEGORIES.find((c) => c.group === selectedGroup);
        return matchesSearch && groupCat?.subgroups.includes(s.category || "");
      }
      return matchesSearch;
    })
  );

  const sortedCategories = [...SERVICE_CATEGORIES]
    .map((c) => ({
      ...c,
      subgroups: [...c.subgroups].sort((a, b) =>
        t(`serviceCategories.${a}`, a).localeCompare(t(`serviceCategories.${b}`, b))
      ),
    }))
    .sort((a, b) =>
      t(`serviceCategories.${a.group}`, a.group).localeCompare(t(`serviceCategories.${b.group}`, b.group))
    );

  const filteredCategories = search
    ? sortedCategories.map((c) => ({
        ...c,
        subgroups: c.subgroups.filter(
          (s) => norm(s).includes(norm(search)) || norm(c.group).includes(norm(search))
        ),
      })).filter((c) => c.subgroups.length > 0)
    : sortedCategories;

  // Infinite scroll logic
  const displayedServices = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    // Simulate loading delay for smooth UX
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + 12, filtered.length));
      setLoadingMore(false);
    }, 300);
  };

  const scrollTargetRef = useInfiniteScroll(loadMore, { threshold: 0.8 });

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(12);
  }, [search, selectedGroup, selectedSubgroup, userLocation, maxDistanceMi, advancedFilters, newOnly]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">{t("services.heading")}</h1>
          <p className="mt-2 text-muted-foreground">{t("services.subtitle")}</p>
        </div>

        {/* Service Recommendations */}
        <ServiceRecommendations 
          onBook={handleBook}
          onRequestQuote={handleRequestQuote}
          className="mb-8"
          limit={4}
        />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchAutocomplete
            value={search}
            onChange={setSearch}
            services={services}
            categories={SERVICE_CATEGORIES.flatMap((c) => [c.group, ...c.subgroups])}
            placeholder={t("services.searchPlaceholder")}
          />
          <div className="flex-1 max-w-xs">
            <LocationFilter
              onLocationChange={setUserLocation}
              initialZip={zipParam}
              onZipChange={setZipParam}
              autoDetect={!zipParam}
            />
          </div>
          {userLocation?.lat && userLocation?.lng ? (
            <div className="flex items-center gap-2 min-w-[180px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{maxDistanceMi} mi</span>
              <Slider
                value={[maxDistanceMi]}
                onValueChange={([v]) => setMaxDistanceMi(v)}
                min={5}
                max={150}
                step={5}
                className="w-28"
              />
            </div>
          ) : null}
          <Button variant="outline" className="gap-2 sm:hidden" onClick={() => setShowSidebar(!showSidebar)}>
            {t("services.categories")} <ChevronDown className="h-4 w-4" />
          </Button>
          
          {/* Copy shareable link */}
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              const url = window.location.href;
              const shareData = {
                title: t("services.heading"),
                text: t("services.shareText", "Check out these services on ServiHub"),
                url,
              };
              // Prefer native share sheet on mobile/supported browsers
              if (typeof navigator.share === "function" && navigator.canShare?.(shareData) !== false) {
                try {
                  await navigator.share(shareData);
                  return;
                } catch (err: any) {
                  // User cancelled — silently exit; on real errors, fall through to clipboard
                  if (err?.name === "AbortError") return;
                }
              }
              try {
                await navigator.clipboard.writeText(url);
                toast.success(t("services.linkCopied", "Link copied to clipboard"));
              } catch {
                toast.error(t("services.linkCopyFailed", "Could not copy link"));
              }
            }}
            aria-label={t("services.shareFilters", "Copy shareable link")}
          >
            <Share2 className="h-4 w-4" />
            <span>{t("services.share", "Share")}</span>
          </Button>

          {/* New Only Toggle - hidden when no recent services */}
          {(() => {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const newCount = services.filter(s => s.created_at && new Date(s.created_at).getTime() >= sevenDaysAgo).length;
            if (newCount === 0) return null;
            return (
              <Button
                variant={newOnly ? "default" : "outline"}
                className="gap-2"
                onClick={() => setNewOnly(v => !v)}
                title={t("services.newOnlyTooltip", "Show services added in the last 7 days")}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">{t("services.newOnly", "New only")}</span>
                <Badge
                  variant={newOnly ? "secondary" : "default"}
                  className="ml-1 h-5 px-1.5 text-xs"
                >
                  {newCount}
                </Badge>
              </Button>
            );
          })()}

          {/* Reset Filters */}
          {(search ||
            selectedGroup ||
            selectedSubgroup ||
            newOnly ||
            zipParam ||
            advancedFilters.minRating !== null ||
            advancedFilters.sortBy !== "relevance" ||
            advancedFilters.priceRange[0] > 0 ||
            advancedFilters.priceRange[1] < 1000 ||
            maxDistanceMi !== 30) && (
            <Button
              variant="ghost"
              className="gap-2"
              onClick={resetAllFilters}
              title={t("services.resetFiltersTooltip", "Clear all filters and saved preferences")}
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">{t("services.resetFilters", "Reset filters")}</span>
            </Button>
          )}

          {(selectedGroup || selectedSubgroup) && (
            <Badge variant="secondary" className="gap-1 py-1">
              {t(`serviceCategories.${selectedSubgroup || selectedGroup}`, selectedSubgroup || selectedGroup)}
              <button onClick={clearFilter}><X className="h-3 w-3" /></button>
            </Badge>
          )}
        </div>

        {/* Minimum Rating Filter (always visible) */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{t("services.minRating", "Min Rating")}:</span>
          {[null, 4, 3, 2, 1].map((rating) => (
            <Button
              key={rating ?? "any"}
              variant={advancedFilters.minRating === rating ? "default" : "outline"}
              size="sm"
              onClick={() => setAdvancedFilters(prev => ({ ...prev, minRating: rating }))}
              className="gap-1"
            >
              {rating === null ? t("services.anyRating", "Any") : <>{rating}+ <Star className="h-3 w-3 fill-current" /></>}
            </Button>
          ))}
        </div>

        {/* Sort Filter (always visible) */}
        {(() => {
          const sortOptions = [
            { key: "relevance", label: t("services.sortRelevance", "Relevance") },
            ...(userLocation?.lat && userLocation?.lng
              ? [{ key: "nearest", label: t("services.sortNearest", "Nearest") }]
              : []),
            { key: "price_low", label: t("services.priceLowToHigh", "Low to High") },
            { key: "price_high", label: t("services.priceHighToLow", "High to Low") },
            { key: "rating", label: t("services.sortHighestRated", "Highest Rated") },
            { key: "reviews", label: t("services.sortMostReviewed", "Most Reviewed") },
            { key: "newest", label: t("services.sortNewest", "Newest") },
          ];
          return (
            <div className="mb-4">
              {/* Mobile: compact dropdown */}
              <div className="flex items-center gap-2 sm:hidden">
                <span className="text-sm font-medium text-foreground shrink-0">{t("services.sortBy", "Sort by")}:</span>
                <Select
                  value={advancedFilters.sortBy}
                  onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, sortBy: value as AdvancedFiltersState["sortBy"] }))}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Desktop/tablet: button group */}
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{t("services.sortBy", "Sort by")}:</span>
                {sortOptions.map((option) => (
                  <Button
                    key={option.key}
                    variant={advancedFilters.sortBy === option.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdvancedFilters(prev => ({ ...prev, sortBy: option.key as AdvancedFiltersState["sortBy"] }))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Advanced Filters */}
        <div className="mb-6">
          <AdvancedFilters
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            maxPrice={Math.max(...services.map(s => s.price || 0), 1000)}
          />
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <aside className={`${showSidebar ? "block" : "hidden"} sm:block w-full sm:w-64 shrink-0`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("services.categories")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-0.5 px-3 pb-4">
                    <button onClick={clearFilter} className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${!selectedGroup ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                      {t("services.allCategories")}
                    </button>
                    {filteredCategories.map((cat) => (
                      <div key={cat.group}>
                        <button onClick={() => { toggleGroup(cat.group); selectGroup(cat.group); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${selectedGroup === cat.group && !selectedSubgroup ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                          <span className="truncate">{t(`serviceCategories.${cat.group}`, cat.group)}</span>
                          {expandedGroups.has(cat.group) ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        </button>
                        {expandedGroups.has(cat.group) && (
                          <div className="ml-3 space-y-0.5 border-l pl-3">
                            {cat.subgroups.map((sub) => (
                              <button key={sub} onClick={() => selectSubgroup(sub)} className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${selectedSubgroup === sub ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                                {t(`serviceCategories.${sub}`, sub)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </aside>

          <div className="flex-1">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-pulse space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-3">
                        <div className="aspect-[4/3] bg-muted rounded-lg" />
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-full" />
                          <div className="h-3 bg-muted rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{t("services.noServices")}</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {services.length === 0 ? t("services.noServicesEmpty") : t("services.noServicesSearch")}
                </p>
                {(selectedGroup || selectedSubgroup || search) && (
                  <Button variant="outline" onClick={() => { clearFilter(); setSearch(""); setAdvancedFilters({ priceRange: [0, 1000], minRating: null, availabilityFilter: null, sortBy: "relevance" }); }} className="mt-4">
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {displayedServices.length} of {filtered.length} services
                  </p>
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "map")} className="ml-auto">
                    <TabsList className="h-8">
                      <TabsTrigger value="list" className="gap-1.5 px-3 text-xs h-7">
                        <List className="h-3.5 w-3.5" />
                        {t("services.listView")}
                      </TabsTrigger>
                      <TabsTrigger value="map" className="gap-1.5 px-3 text-xs h-7">
                        <MapIcon className="h-3.5 w-3.5" />
                        {t("services.mapView")}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                {viewMode === "map" ? (
                  <ServiceMapView
                    services={filtered}
                    onBook={handleBook}
                    onRequestQuote={handleRequestQuote}
                    userLocation={userLocation}
                    radiusMiles={userLocation ? maxDistanceMi : undefined}
                  />
                ) : (
                  <>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {displayedServices.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          onBook={handleBook}
                          onRequestQuote={handleRequestQuote}
                          onRequestService={handleRequestService}
                          distanceMi={getDistance(service)}
                        />
                      ))}
                    </div>

                    {/* Loading indicator */}
                    {loadingMore && (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 mt-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="space-y-3">
                            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-2/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Infinite scroll trigger */}
                    {hasMore && !loadingMore && (
                      <div ref={scrollTargetRef} className="h-20 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Scroll for more...</p>
                      </div>
                    )}

                    {/* End of results */}
                    {!hasMore && displayedServices.length > 12 && (
                      <div className="flex justify-center py-8">
                        <p className="text-sm text-muted-foreground">You've reached the end of the results</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <BookingDialog
        service={bookingService}
        open={!!bookingService}
        onOpenChange={(open) => !open && setBookingService(null)}
        onConfirm={confirmBooking}
        loading={bookingLoading}
        bookingFeePercentage={customerFeePercentage}
      />

      <QuoteDialog
        service={quoteService}
        open={!!quoteService}
        onOpenChange={(open) => !open && setQuoteService(null)}
        onSubmit={submitQuote}
        loading={quoteLoading}
      />

      <RequestServiceDialog
        service={requestService}
        open={!!requestService}
        onOpenChange={(open) => !open && setRequestService(null)}
        onSubmit={submitServiceRequest}
        loading={requestLoading}
      />

      <BackToTop />
    </div>
  );
};

export default Services;
