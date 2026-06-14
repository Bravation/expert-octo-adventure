import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import ProviderHeader from "@/components/provider-profile/ProviderHeader";
import ProfileServiceCard from "@/components/provider-profile/ProfileServiceCard";
import AddServiceDialog from "@/components/provider-profile/AddServiceDialog";
import AvailabilitySection from "@/components/provider-profile/AvailabilitySection";
import ReviewsSection from "@/components/provider-profile/ReviewsSection";
import { useTranslation } from "react-i18next";

const ProviderProfile = () => {
  const { providerId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile: currentUserProfile, user } = useAuth();
  const [provider, setProvider] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = currentUserProfile?.id === providerId;

  useEffect(() => {
    if (providerId) fetchProvider();
  }, [providerId]);

  const fetchProvider = async () => {
    const [profileRes, servicesRes, reviewsRes, availRes] = await Promise.all([
      supabase.from("public_provider_profiles" as any).select("id, user_id, full_name, avatar_url, bio, city, state, zip_code, average_rating, total_reviews, total_services_completed, is_active, role").eq("id", providerId).single(),
      supabase.from("services").select("*").eq("provider_id", providerId!).eq("status", "available"),
      supabase.from("reviews").select("*, profiles!reviews_reviewer_id_fkey(full_name)").eq("provider_id", providerId!).order("created_at", { ascending: false }).limit(20),
      supabase.from("provider_availability").select("*").eq("provider_id", providerId!).order("day_of_week", { ascending: true }),
    ]);
    setProvider(profileRes.data);
    setServices(servicesRes.data || []);
    setReviews(reviewsRes.data || []);
    setAvailability(availRes.data || []);
    setLoading(false);
  };

  const handleServiceUpdate = (id: string, updates: Record<string, any>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </div>
  );

  if (!provider) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 text-center">
        <p className="text-lg text-muted-foreground">{t("provider.notFound")}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl mx-auto py-10 px-4">
        {isOwner && (
          <div className="mb-4">
            <BackButton fallback="/dashboard" />
          </div>
        )}
        <ProviderHeader
          provider={provider}
          isOwner={isOwner}
          userId={user?.id}
          onProviderUpdate={(updates) => setProvider((prev: any) => ({ ...prev, ...updates }))}
        />

        {/* Services */}
        <div className="mb-4 mt-8 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{t("provider.services")}</h2>
          {isOwner && user && currentUserProfile && (
            <AddServiceDialog userId={user.id} profileId={currentUserProfile.id} onServiceAdded={fetchProvider} />
          )}
        </div>
        {services.length === 0 ? (
          <p className="text-muted-foreground">{t("provider.noServices")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ProfileServiceCard
                key={s.id}
                service={s}
                isOwner={isOwner}
                userId={user?.id}
                providerId={providerId}
                onServiceUpdate={handleServiceUpdate}
              />
            ))}
          </div>
        )}

        <AvailabilitySection
          availability={availability}
          isOwner={isOwner}
          profileId={currentUserProfile?.id || ""}
          onAvailabilityUpdate={setAvailability}
        />

        <ReviewsSection reviews={reviews} />
      </div>
    </div>
  );
};

export default ProviderProfile;
