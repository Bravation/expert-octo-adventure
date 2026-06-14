import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Quote, Users, CheckCircle, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

interface TestimonialReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: {
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
    state: string | null;
  };
  service: {
    title: string;
    category: string | null;
  };
}

interface PlatformStats {
  totalProviders: number;
  totalServices: number;
  totalReviews: number;
  avgRating: number;
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<TestimonialReview[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchData() {
      const [reviewsRes, servicesRes, profilesRes] = await Promise.all([
        supabase
          .from("reviews")
          .select(`
            id, rating, comment, created_at,
            reviewer:public_provider_profiles!reviews_reviewer_id_fkey ( full_name, avatar_url, city, state ),
            service:services!reviews_service_id_fkey ( title, category )
          `)
          .gte("rating", 4)
          .not("comment", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("status", "available"),
        supabase
          .from("public_provider_profiles")
          .select("id, average_rating, total_reviews", { count: "exact" })
          .eq("role", "service_provider"),
      ]);

      if (reviewsRes.data) {
        // Pick top reviews with substantial comments
        const good = (reviewsRes.data as any[])
          .filter((r) => r.comment && r.comment.length > 20 && r.reviewer?.full_name)
          .slice(0, 6);
        setReviews(good);
      }

      // Compute stats
      const totalProviders = profilesRes.count || 0;
      const totalServices = servicesRes.count || 0;
      let totalReviews = 0;
      let sumRating = 0;
      if (profilesRes.data) {
        for (const p of profilesRes.data as any[]) {
          totalReviews += p.total_reviews || 0;
          sumRating += (p.average_rating || 0) * (p.total_reviews || 0);
        }
      }
      const avgRating = totalReviews > 0 ? sumRating / totalReviews : 0;

      setStats({ totalProviders, totalServices, totalReviews, avgRating });
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <section className="border-t bg-card py-20">
        <div className="container">
          <Skeleton className="mx-auto h-8 w-72 mb-4" />
          <Skeleton className="mx-auto h-5 w-96 mb-12" />
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t bg-card py-20">
      <div className="container">
        {/* Stats bar */}
        {stats && (
          <div className="mx-auto mb-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: Users, value: stats.totalProviders, label: t("testimonials.statProviders") },
              { icon: CheckCircle, value: stats.totalServices, label: t("testimonials.statServices") },
              { icon: Star, value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—", label: t("testimonials.statRating") },
              { icon: TrendingUp, value: stats.totalReviews, label: t("testimonials.statReviews") },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center">
                <Icon className="mx-auto mb-2 h-6 w-6 text-accent" />
                <p className="font-display text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Section heading */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Quote className="h-6 w-6 text-accent" />
          <h2 className="text-center font-display text-3xl font-bold">
            {t("testimonials.heading")}
          </h2>
        </div>
        <p className="mx-auto mt-1 max-w-lg text-center text-muted-foreground mb-12">
          {t("testimonials.subtitle")}
        </p>

        {/* Review cards */}
        {reviews.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="relative rounded-xl border bg-background p-6 shadow-sm transition-all hover:shadow-md"
              >
                <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" />
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-4 mb-4 italic">
                  "{review.comment}"
                </p>
                <div className="flex items-center gap-3 mt-auto">
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarImage src={review.reviewer?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {review.reviewer?.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {review.reviewer?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t(`serviceExamples.${review.service?.category}.title`, review.service?.title || "")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
