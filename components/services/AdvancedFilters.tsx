import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, SlidersHorizontal, Star, RotateCcw, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "react-i18next";

export interface AdvancedFiltersState {
  priceRange: [number, number];
  minRating: number | null;
  availabilityFilter: string | null;
  sortBy: string;
}

interface AdvancedFiltersProps {
  filters: AdvancedFiltersState;
  onFiltersChange: (filters: AdvancedFiltersState) => void;
  maxPrice?: number;
  className?: string;
}

const RATING_OPTIONS = [4, 3, 2, 1];

export default function AdvancedFilters({ 
  filters, 
  onFiltersChange, 
  maxPrice = 1000,
  className = ""
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [announcementSeq, setAnnouncementSeq] = useState(0);
  const { t } = useTranslation();

  const priceRef = useRef<HTMLSpanElement>(null);
  const availabilityRef = useRef<HTMLButtonElement>(null);
  const sortRef = useRef<HTMLButtonElement>(null);

  const filterLabels: Record<"price" | "availability" | "sort", string> = {
    price: t("services.priceRange", "Price Range"),
    availability: t("services.availability", "Availability"),
    sort: t("services.sortBy", "Sort by"),
  };

  const announceFocus = (target: "price" | "availability" | "sort") => {
    setAnnouncement(
      t("services.focusedFilter", "{{filter}} filter focused").replace("{{filter}}", filterLabels[target])
    );
    // Force a DOM mutation so screen readers re-announce even when the
    // message text is identical to the previous announcement.
    setAnnouncementSeq((n) => n + 1);
  };

  const focusFilter = (target: "price" | "availability" | "sort") => {
    setIsOpen(true);
    setAnnouncement(
      t("services.editingFilter", "Editing {{filter}} filter").replace("{{filter}}", filterLabels[target])
    );
    setAnnouncementSeq((n) => n + 1);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const refMap = {
          price: priceRef,
          availability: availabilityRef,
          sort: sortRef,
        };
        const el = refMap[target].current;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 150);
    });
  };

  const AVAILABILITY_OPTIONS = [
    { value: "today", label: t("services.availToday", "Available Today") },
    { value: "this_week", label: t("services.availThisWeek", "This Week") },
    { value: "weekends", label: t("services.availWeekends", "Weekends Only") },
    { value: "weekdays", label: t("services.availWeekdays", "Weekdays Only") },
  ];

  const SORT_OPTIONS = [
    { value: "relevance", label: t("services.sortMostRelevant", "Most Relevant") },
    { value: "nearest", label: t("services.sortNearest", "Nearest") },
    { value: "price_low", label: t("services.priceLowToHigh", "Low to High") },
    { value: "price_high", label: t("services.priceHighToLow", "High to Low") },
    { value: "rating", label: t("services.sortHighestRated", "Highest Rated") },
    { value: "reviews", label: t("services.sortMostReviewed", "Most Reviewed") },
    { value: "newest", label: t("services.sortNewest", "Newest") },
  ];

  const updateFilters = (updates: Partial<AdvancedFiltersState>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      priceRange: [0, maxPrice],
      minRating: null,
      availabilityFilter: null,
      sortBy: "relevance",
    });
  };

  const hasActiveFilters = 
    filters.priceRange[0] > 0 || 
    filters.priceRange[1] < maxPrice ||
    filters.minRating !== null ||
    filters.availabilityFilter !== null ||
    filters.sortBy !== "relevance";

  return (
    <div className={className}>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
        <span data-announcement-seq={announcementSeq} className="sr-only">
          {announcementSeq > 0 ? "\u200B".repeat((announcementSeq % 5) + 1) : ""}
        </span>
      </div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 mb-3">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t("services.advancedFilters", "Advanced Filters")}
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {[
                    filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? "Price" : "",
                    filters.minRating ? "Rating" : "",
                    filters.availabilityFilter ? "Availability" : "",
                    filters.sortBy !== "relevance" ? "Sort" : "",
                  ].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1">
              <X className="h-3 w-3" />
              {t("services.clear", "Clear")}
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("services.filterOptions", "Filter Options")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Price Range */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    ref={priceRef}
                    tabIndex={0}
                    onFocus={() => announceFocus("price")}
                    className="text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    aria-label={t("services.priceRange", "Price Range")}
                  >
                    {t("services.priceRange", "Price Range")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ${filters.priceRange[0]} - ${filters.priceRange[1]}
                  </span>
                </div>
                <Slider
                  value={filters.priceRange}
                  onValueChange={(value) => updateFilters({ priceRange: value as [number, number] })}
                  min={0}
                  max={maxPrice}
                  step={25}
                  className="w-full"
                />
              </div>




              {/* Availability Filter */}
              <div className="space-y-3">
                <label className="text-sm font-medium">{t("services.availability", "Availability")}</label>
                <Select
                  value={filters.availabilityFilter || "any"}
                  onValueChange={(value) => 
                    updateFilters({ availabilityFilter: value === "any" ? null : value })
                  }
                >
                  <SelectTrigger ref={availabilityRef} onFocus={() => announceFocus("availability")}>
                    <SelectValue placeholder={t("services.anyTime", "Any time")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("services.anyTime", "Any time")}</SelectItem>
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{t("services.sortBy", "Sort by")}</label>
                  {filters.sortBy !== "relevance" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {t("services.resetSort", "Reset")}
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateFilters({ sortBy: "relevance" })}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {t("services.resetSortOnly", "Reset sort only")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={clearAllFilters}>
                          <X className="h-4 w-4 mr-2" />
                          {t("services.clearAllFilters", "Clear all filters")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => updateFilters({ sortBy: value })}
                  onOpenChange={(open) => {
                    if (!open) {
                      requestAnimationFrame(() => {
                        sortRef.current?.focus();
                        announceFocus("sort");
                      });
                    } else {
                      announceFocus("sort");
                    }
                  }}
                >
                  <SelectTrigger
                    ref={sortRef}
                    onFocus={() => announceFocus("sort")}
                    aria-label={t("services.sortBy", "Sort by")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t("services.activeFilters", "Active filters")}
          </div>
          <div className="flex flex-wrap gap-2">
            {(filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) && (
            <Badge variant="secondary" className="gap-1 pl-0">
              <button
                onClick={() => focusFilter("price")}
                className="hover:text-primary transition-colors pl-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l"
                title={t("services.editFilter", "Edit this filter")}
                aria-label={`${t("services.editFilter", "Edit this filter")}: ${t("services.priceRange", "Price Range")} $${filters.priceRange[0]} - $${filters.priceRange[1]}`}
              >
                ${filters.priceRange[0]} - ${filters.priceRange[1]}
              </button>
              <button 
                onClick={() => updateFilters({ priceRange: [0, maxPrice] })}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={t("services.removeFilter", "Remove filter")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.minRating && (
            <Badge variant="secondary" className="gap-1 pl-0">
              <button
                onClick={() => focusFilter("price")}
                className="hover:text-primary transition-colors pl-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l"
                title={t("services.editFilter", "Edit this filter")}
                aria-label={`${t("services.editFilter", "Edit this filter")}: ${t("services.minRating", "Min Rating")} ${filters.minRating}+ ${t("services.starsLabel", "stars")}`}
              >
                {filters.minRating}+ {t("services.starsLabel", "stars")}
              </button>
              <button 
                onClick={() => updateFilters({ minRating: null })}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={t("services.removeFilter", "Remove filter")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.availabilityFilter && (
            <Badge variant="secondary" className="gap-1 pl-0">
              <button
                onClick={() => focusFilter("availability")}
                className="hover:text-primary transition-colors pl-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l"
                title={t("services.editFilter", "Edit this filter")}
                aria-label={`${t("services.editFilter", "Edit this filter")}: ${t("services.availability", "Availability")} ${AVAILABILITY_OPTIONS.find(opt => opt.value === filters.availabilityFilter)?.label}`}
              >
                {AVAILABILITY_OPTIONS.find(opt => opt.value === filters.availabilityFilter)?.label}
              </button>
              <button 
                onClick={() => updateFilters({ availabilityFilter: null })}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={t("services.removeFilter", "Remove filter")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.sortBy !== "relevance" && (
            <Badge variant="secondary" className="gap-1 pl-0">
              <button
                onClick={() => focusFilter("sort")}
                className="hover:text-primary transition-colors pl-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l"
                title={t("services.editFilter", "Edit this filter")}
                aria-label={`${t("services.editFilter", "Edit this filter")}: ${t("services.sortBy", "Sort by")} ${SORT_OPTIONS.find(opt => opt.value === filters.sortBy)?.label}`}
              >
                {SORT_OPTIONS.find(opt => opt.value === filters.sortBy)?.label}
              </button>
              <button 
                onClick={() => updateFilters({ sortBy: "relevance" })}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={t("services.removeFilter", "Remove filter")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          </div>
        </div>
      )}
    </div>
  );
}