import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, User } from "lucide-react";
import StarRating from "./StarRating";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PhotoGallery from "./PhotoGallery";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveServiceImage, handleServiceImageError } from "@/lib/serviceImages";

export type ServiceWithProvider = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  photo_url?: string;
  photo_urls?: string[];
  photo_captions?: string[];
  photo_alts?: string[];
  created_at?: string;
  estimated_hours?: number | null;
  profiles?: {
    full_name: string;
    avatar_url?: string;
    city?: string;
    state?: string;
    average_rating?: number;
    total_reviews?: number;
    total_services_completed?: number;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

type ServiceCardProps = {
  service: ServiceWithProvider;
  onBook: (service: ServiceWithProvider) => void;
  onRequestQuote?: (service: ServiceWithProvider) => void;
  onRequestService?: (service: ServiceWithProvider) => void;
  distanceMi?: number | null;
};

const ServiceCard = ({ service, onBook, onRequestQuote, onRequestService, distanceMi }: ServiceCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const provider = service.profiles;
  const providerLinkRef = useRef<HTMLAnchorElement | null>(null);
  const bookButtonRef = useRef<HTMLButtonElement | null>(null);
  const quoteButtonRef = useRef<HTMLButtonElement | null>(null);
  const requestButtonRef = useRef<HTMLButtonElement | null>(null);
  const rawPhotos = (service.photo_urls?.length ? service.photo_urls : service.photo_url ? [service.photo_url] : [])
    .filter((u) => typeof u === "string" && u.trim().length > 0 && u !== "/placeholder.svg");
  const mainPhoto = resolveServiceImage(service.photo_url, service.photo_urls, service.category);
  const photos = rawPhotos.length > 0 ? rawPhotos : [mainPhoto];
  const isNew = service.created_at
    ? (Date.now() - new Date(service.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 7
    : false;

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons, checkboxes, or links
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest('[role="checkbox"]')) return;
    navigate(`/provider/${service.provider_id}`);
  };

  // Build the cycle of focusable controls within the card (in DOM/Tab order):
  // provider link → Book Now → Request Quote (if present)
  const getFocusCycle = (): HTMLElement[] => {
    const els: HTMLElement[] = [];
    if (providerLinkRef.current) els.push(providerLinkRef.current);
    if (bookButtonRef.current) els.push(bookButtonRef.current);
    if (quoteButtonRef.current) els.push(quoteButtonRef.current);
    if (requestButtonRef.current) els.push(requestButtonRef.current);
    return els;
  };

  const handleControlKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const key = e.key;
    if (
      key !== "ArrowRight" &&
      key !== "ArrowLeft" &&
      key !== "ArrowDown" &&
      key !== "ArrowUp"
    ) {
      return;
    }
    const cycle = getFocusCycle();
    if (cycle.length < 2) return;
    const current = e.currentTarget as HTMLElement;
    const idx = cycle.indexOf(current);
    if (idx === -1) return;
    e.preventDefault();
    const forward = key === "ArrowRight" || key === "ArrowDown";
    const nextIdx = forward
      ? (idx + 1) % cycle.length
      : (idx - 1 + cycle.length) % cycle.length;
    cycle[nextIdx].focus();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          className="group overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/8 hover:-translate-y-0.5 cursor-pointer"
          onDoubleClick={handleDoubleClick}
        >
      {/* Service Photo */}
      <div
        className="relative aspect-[4/3] sm:aspect-[3/2] lg:aspect-[16/10] overflow-hidden bg-muted cursor-pointer"
        onClick={() => setGalleryOpen(true)}
      >
        <img
          src={mainPhoto}
          alt={service.photo_alts?.[0] || service.photo_captions?.[0] || service.title}
          onError={handleServiceImageError(service.category)}
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
        {photos.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground backdrop-blur-sm shadow-sm">
            +{photos.length - 1}
          </span>
        )}
        <Badge className="absolute left-3 top-3 bg-background/95 text-foreground backdrop-blur-sm border-0 text-xs font-medium">
          {t(`serviceCategories.${service.category}`, service.category)}
        </Badge>
        {isNew && (
          <div className="absolute -left-8 top-4 z-10 rotate-[-45deg] bg-gradient-to-r from-primary to-primary/80 px-8 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-md">
            {t("services.new", "New")}
          </div>
        )}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <div className="rounded-lg bg-primary px-2.5 py-1.5 font-display text-sm font-bold text-primary-foreground shadow-lg">
            ${Number(service.price).toFixed(2)}
          </div>
          {distanceMi != null && (
            <div className="flex items-center gap-1 rounded-md bg-background/95 px-2 py-1 text-xs font-semibold text-foreground shadow-md backdrop-blur-sm">
              <MapPin className="h-3 w-3 text-primary" />
              {distanceMi < 0.1 ? `${(distanceMi * 5280).toFixed(0)} ft` : `${distanceMi.toFixed(1)} mi`}
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="font-display text-base font-semibold leading-tight line-clamp-1">
            {t(`serviceExamples.${service.category}.title`, service.title)}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
            {t(`serviceExamples.${service.category}.description`, service.description)}
          </p>
        </div>

        {/* Provider Info */}
        <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 transition-colors group-hover:bg-muted/50">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            {provider?.avatar_url ? (
              <img src={provider.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              to={`/provider/${service.provider_id}`}
              ref={providerLinkRef}
              onKeyDown={handleControlKeyDown}
              className="block truncate text-sm font-medium hover:text-primary transition-colors"
            >
              {provider?.full_name || t("services.provider")}
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <StarRating
                rating={Number(provider?.average_rating) || 0}
                totalReviews={provider?.total_reviews || 0}
              />
              {distanceMi != null && (
                <span className="flex items-center gap-0.5 text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  <MapPin className="h-3 w-3" />
                  {distanceMi < 0.1 ? `${(distanceMi * 5280).toFixed(0)} ft` : `${distanceMi.toFixed(1)} mi`}
                </span>
              )}
              {(provider?.city || provider?.state) && !distanceMi && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {[provider?.city, provider?.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button 
            size="sm" 
            ref={bookButtonRef}
            onKeyDown={handleControlKeyDown}
            className="flex-1 font-medium transition-all hover:scale-[1.02]" 
            onClick={() => onBook(service)}
          >
            {t("services.bookNow")}
          </Button>
          {onRequestQuote && (
            <Button 
              size="sm" 
              variant="outline" 
              ref={quoteButtonRef}
              onKeyDown={handleControlKeyDown}
              className="flex-1 font-medium transition-all hover:scale-[1.02]" 
              onClick={() => navigate(`/quote/${service.id}`)}
            >
              {t("services.requestQuote")}
            </Button>
          )}
        </div>
        {onRequestService && (
          <Button
            size="sm"
            variant="secondary"
            ref={requestButtonRef}
            onKeyDown={handleControlKeyDown}
            className="w-full font-medium transition-all hover:scale-[1.01]"
            onClick={() => onRequestService(service)}
          >
            {t("services.requestService", "Request Service")}
          </Button>
        )}
      </CardContent>
      <PhotoGallery photos={photos} captions={service.photo_captions} alts={service.photo_alts} open={galleryOpen} onOpenChange={setGalleryOpen} />
      </Card>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {t("services.doubleClickHint", "Double-click to view provider profile")}
      </TooltipContent>
    </Tooltip>
  );
};

export default ServiceCard;
