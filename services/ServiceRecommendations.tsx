import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { resolveServiceImage, handleServiceImageError } from "@/lib/serviceImages";

type ServiceWithProvider = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  photo_url?: string;
  photo_urls?: string[];
  profiles?: {
    full_name: string;
    avatar_url?: string;
    city?: string;
    state?: string;
    average_rating?: number;
    total_reviews?: number;
    total_services_completed?: number;
    latitude?: number;
    longitude?: number;
  };
  distance_mi?: number;
  recommendation_score?: number;
  recommendation_reason?: string;
};

interface ServiceRecommendationsProps {
  onBook?: (service: ServiceWithProvider) => void;
  onRequestQuote?: (service: ServiceWithProvider) => void;
  className?: string;
  limit?: number;
}

const ServiceRecommendations = ({ onBook, onRequestQuote, className = "", limit = 8 }: ServiceRecommendationsProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<ServiceWithProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchRecommendations();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('recommendations', {
        method: 'GET',
      });

      if (error) throw error;

      setRecommendations(data?.recommendations?.slice(0, limit) || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch recommendations:', err);
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = (service: ServiceWithProvider) => {
    if (onBook) {
      onBook(service);
    } else {
      toast.info("Booking functionality requires authentication");
    }
  };

  const handleRequestQuote = (service: ServiceWithProvider) => {
    if (onRequestQuote) {
      onRequestQuote(service);
    } else {
      toast.info("Quote requests require authentication");
    }
  };

  if (!user) {
    return null; // Don't show recommendations for non-authenticated users
  }

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Recommended for You</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Silently hide if no recommendations or error
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-semibold">
          {t("recommendations.title", "Recommended for You")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("recommendations.subtitle", "Based on your booking history and location")}
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {recommendations.map((service) => {
          const provider = service.profiles;
          const mainPhoto = resolveServiceImage(service.photo_url, service.photo_urls, service.category);

          return (
            <Card key={service.id} className="group overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/8 hover:-translate-y-0.5">
              {/* Service Photo */}
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={mainPhoto}
                  alt={service.title}
                  onError={handleServiceImageError(service.category)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Recommendation Reason Badge */}
                {service.recommendation_reason && (
                  <div className="absolute top-2 left-2 max-w-[calc(100%-1rem)]">
                    <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-sm border-0 text-xs font-medium truncate">
                      {service.recommendation_reason}
                    </Badge>
                  </div>
                )}
                
                {/* Price */}
                <div className="absolute right-2 top-2 rounded-lg bg-background/95 px-2 py-1 font-display text-sm font-bold text-foreground shadow-sm backdrop-blur-sm">
                  ${Number(service.price).toFixed(2)}
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Title & Category */}
                <div className="space-y-1">
                  <h3 className="font-display text-sm font-semibold leading-tight line-clamp-1">
                    {service.title}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {t(`serviceCategories.${service.category}`, service.category)}
                  </Badge>
                </div>

                {/* Provider Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {provider?.full_name || t("services.provider")}
                  </span>
                  {provider?.average_rating && provider.average_rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current text-yellow-400" />
                      <span>{Number(provider.average_rating).toFixed(1)}</span>
                    </div>
                  )}
                  {service.distance_mi && service.distance_mi < 50 && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {service.distance_mi < 0.1 
                          ? `${(service.distance_mi * 5280).toFixed(0)} ft`
                          : `${service.distance_mi.toFixed(1)} mi`
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button 
                    size="sm" 
                    className="flex-1 text-xs font-medium transition-all hover:scale-[1.02]" 
                    onClick={() => handleBook(service)}
                  >
                    {t("services.bookNow")}
                  </Button>
                  {onRequestQuote && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 text-xs font-medium transition-all hover:scale-[1.02]" 
                      onClick={() => handleRequestQuote(service)}
                    >
                      {t("services.requestQuote")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceRecommendations;