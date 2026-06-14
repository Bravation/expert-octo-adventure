import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, ArrowRight, MapPin, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveServiceImage, handleServiceImageError } from "@/lib/serviceImages";

interface FeaturedService {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string | null;
  photo_url: string | null;
  provider: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    average_rating: number | null;
    total_reviews: number | null;
    city: string | null;
    state: string | null;
  };
}

export default function FeaturedServices() {
  const [services, setServices] = useState<FeaturedService[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    async function fetchFeatured() {
      const { data, error } = await supabase
        .from("services")
        .select(`
          id, title, description, price, category, photo_url,
          provider:public_provider_profiles!services_provider_id_fkey (
            id, full_name, avatar_url, average_rating, total_reviews, city, state
          )
        `)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        // Sort by rating * reviews to surface truly popular providers
        const scored = (data as any[])
          .filter((s) => s.provider?.average_rating && s.provider.average_rating >= 4)
          .map((s) => ({
            ...s,
            provider: s.provider,
            _score:
              (s.provider.average_rating || 0) * Math.log2((s.provider.total_reviews || 1) + 1),
          }))
          .sort((a, b) => b._score - a._score)
          .slice(0, 6);

        setServices(scored);
      }
      setLoading(false);
    }
    fetchFeatured();
  }, []);

  const getCategoryTranslation = (category: string | null) => {
    if (!category) return "";
    return category;
  };

  if (loading) {
    return (
      <section className="py-20">
        <div className="container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="mx-auto h-5 w-80 mb-12" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (services.length === 0) return null;

  return (
    <section className="py-20">
      <div className="container">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flame className="h-6 w-6 text-accent" />
          <h2 className="text-center font-display text-3xl font-bold">
            {t("featured.heading")}
          </h2>
        </div>
        <p className="mx-auto mt-1 max-w-lg text-center text-muted-foreground mb-12">
          {t("featured.subtitle")}
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className="group overflow-hidden border bg-card transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer"
              onClick={() => navigate(`/provider/${service.provider.id}`)}
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={resolveServiceImage(service.photo_url, null, service.category)}
                  alt={service.title}
                  onError={handleServiceImageError(service.category)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground shadow-md">
                  {t(`serviceExamples.${service.category}.title`, service.category || "")}
                </Badge>
                <div className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-sm font-bold text-foreground shadow">
                  ${service.price.toFixed(2)}
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-display text-lg font-semibold truncate">
                  {t(`serviceExamples.${service.category}.title`, service.title)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {t(`serviceExamples.${service.category}.description`, service.description || "")}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarImage src={service.provider.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {service.provider.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {service.provider.full_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3.5 w-3.5 fill-current text-accent" />
                        {service.provider.average_rating?.toFixed(1)}
                        <span className="text-muted-foreground/70">
                          ({service.provider.total_reviews})
                        </span>
                      </span>
                      {service.provider.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {service.provider.city}, {service.provider.state}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button
            size="lg"
            variant="outline"
            className="gap-2 text-base"
            onClick={() => navigate("/services")}
          >
            {t("featured.viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
