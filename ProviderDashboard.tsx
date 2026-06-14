import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, TrendingDown, DollarSign, Package, CheckCircle, MessageSquare } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/constants/serviceCategories";
import { useTranslation } from "react-i18next";
import AvailabilityManager from "./AvailabilityManager";
import CategoryCombobox from "./CategoryCombobox";
import ProviderServiceCard from "./ProviderServiceCard";
import EditServiceDialog from "./EditServiceDialog";
import MultiPhotoUploader, { type PhotoItem } from "./MultiPhotoUploader";
import { uploadPhotos } from "./uploadPhotos";
import ChatPanel from "./ChatPanel";
import PullToRefresh from "@/components/PullToRefresh";
import PriceAdjustmentPanel from "./PriceAdjustmentPanel";
import ShareProfileLink from "./ShareProfileLink";
import ProviderAnalytics from "./ProviderAnalytics";
import ProviderCommissionDropdown from "./ProviderCommissionDropdown";
import ServiceAreasSection from "./ServiceAreasSection";
import StripeConnectCard from "./StripeConnectCard";

type Service = { id: string; title: string; description: string; price: number; category: string; status: string; photo_url?: string | null; photo_urls?: string[] | null; photo_captions?: string[] | null; photo_alts?: string[] | null };
type Booking = { id: string; status: string; total_price: number; commission_rate: number; commission_amount: number; created_at: string; services?: { title: string } | null };
type Milestone = { completed_bookings: number; current_commission_rate: number };

const ProviderDashboard = () => {
  const { profile, user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newService, setNewService] = useState({ title: "", description: "", price: "", category: "" });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { t } = useTranslation();

  useEffect(() => { if (profile) fetchAll(); }, [profile]);

  const fetchAll = async () => {
    const [servicesRes, bookingsRes, milestoneRes] = await Promise.all([
      supabase.from("services").select("*").eq("provider_id", profile!.id).order("created_at", { ascending: false }),
      supabase.from("bookings").select("*, services!bookings_service_id_fkey(title)").eq("provider_id", profile!.id).order("created_at", { ascending: false }),
      supabase.from("provider_milestones").select("*").eq("provider_id", profile!.id).single(),
    ]);
    setServices((servicesRes.data as any) || []);
    setBookings((bookingsRes.data as any) || []);
    setMilestone(milestoneRes.data as any);
    setLoading(false);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUploading(true);

    try {
      const photoUrls = await uploadPhotos(user.id, photos);

      const { error } = await supabase.from("services").insert({
        provider_id: profile!.id,
        title: newService.title,
        description: newService.description,
        price: parseFloat(newService.price),
        category: newService.category,
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls,
      } as any);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("providerDashboard.serviceAdded"));
        setNewService({ title: "", description: "", price: "", category: "" });
        setPhotos([]);
        setDialogOpen(false);
        fetchAll();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploading(false);
  };

  const updateBookingStatus = async (bookingId: string, status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled") => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);
    if (error) { toast.error(error.message); } else { toast.success(`Booking ${status}!`); fetchAll(); }
  };

  const completedBookings = bookings.filter((b) => b.status === "completed");
  const totalEarnings = completedBookings.reduce((sum, b) => sum + Number(b.total_price) - Number(b.commission_amount), 0);

  const handleRefresh = useCallback(async () => {
    await fetchAll();
  }, [profile]);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> {t("providerDashboard.addService")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{t("providerDashboard.addNewService")}</DialogTitle></DialogHeader>
            <form onSubmit={handleAddService} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("providerDashboard.title")}</Label>
                <Input value={newService.title} onChange={(e) => setNewService({ ...newService, title: e.target.value })} required placeholder={t("providerDashboard.titlePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("providerDashboard.description")}</Label>
                <Textarea value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} placeholder={t("providerDashboard.descPlaceholder")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("providerDashboard.price")}</Label>
                  <Input type="number" step="0.01" min="0" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} required placeholder="99.00" />
                </div>
                <div className="space-y-2">
                  <Label>{t("providerDashboard.category")}</Label>
                  <CategoryCombobox value={newService.category} onValueChange={(val) => setNewService({ ...newService, category: val })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("providerDashboard.photos", "Photos")}</Label>
                <MultiPhotoUploader photos={photos} onChange={setPhotos} />
              </div>
              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? t("providerDashboard.uploading", "Uploading...") : t("providerDashboard.createService")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Commission Incentive Dropdown */}
      <div className="mt-6">
        <ProviderCommissionDropdown />
      </div>

      {/* Stripe Connect Payouts */}
      <div className="mt-4">
        <StripeConnectCard />
      </div>

      <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-4 sm:p-5"><div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10"><TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div><div className="min-w-0"><p className="text-xs sm:text-sm text-muted-foreground truncate">{t("providerDashboard.commissionRate")}</p><p className="font-display text-xl sm:text-2xl font-bold">{milestone?.current_commission_rate ?? 15}%</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4 sm:p-5"><div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10"><CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-accent" /></div><div className="min-w-0"><p className="text-xs sm:text-sm text-muted-foreground truncate">{t("providerDashboard.completedJobs")}</p><p className="font-display text-xl sm:text-2xl font-bold">{milestone?.completed_bookings ?? 0}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4 sm:p-5"><div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-success/10"><DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-success" /></div><div className="min-w-0"><p className="text-xs sm:text-sm text-muted-foreground truncate">{t("providerDashboard.netEarnings")}</p><p className="font-display text-xl sm:text-2xl font-bold">${totalEarnings.toFixed(2)}</p></div></CardContent></Card>
      </div>

      {/* Analytics Charts */}
      <h2 className="mb-4 mt-10 font-display text-xl font-semibold">{t("providerDashboard.analytics", "Analytics")}</h2>
      <ProviderAnalytics bookings={bookings as any} />

      <h2 className="mb-4 mt-10 font-display text-xl font-semibold">{t("providerDashboard.myServices")}</h2>
      {services.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">{t("providerDashboard.noServices")}</p>
          <p className="text-sm text-muted-foreground">{t("providerDashboard.noServicesHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ProviderServiceCard
              key={service.id}
              service={service}
              providerId={profile?.id}
              onEdit={setEditingService}
              onDeleted={fetchAll}
            />
          ))}
        </div>
      )}

      <EditServiceDialog
        service={editingService}
        open={!!editingService}
        onOpenChange={(open) => !open && setEditingService(null)}
        onSaved={fetchAll}
      />

      {/* Messages Section */}
      <div className="mt-10">
        <ChatPanel />
      </div>

      <div className="mt-10">
        <AvailabilityManager />
      </div>

      <div className="mt-10">
        <ServiceAreasSection />
      </div>

      <h2 className="mb-4 mt-10 font-display text-xl font-semibold">{t("providerDashboard.incomingBookings")}</h2>
      {bookings.length === 0 ? (
        <p className="text-muted-foreground">{t("providerDashboard.noBookings")}</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display font-semibold">{(booking as any).services?.title || "Service"}</p>
                  <p className="text-sm text-muted-foreground">{new Date(booking.created_at).toLocaleDateString()}</p>
                  <p className="text-sm text-muted-foreground">${Number(booking.total_price).toFixed(2)} · {Number(booking.commission_rate)}% {t("providerDashboard.commission")}</p>
                </div>
                  <div className="flex flex-wrap items-center gap-2">
                   <Badge variant="outline">{booking.status.replace("_", " ")}</Badge>
                   {booking.status === "pending" && (<><Button size="sm" onClick={() => updateBookingStatus(booking.id, "confirmed")}>{t("providerDashboard.confirm")}</Button><Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, "cancelled")}>{t("providerDashboard.decline")}</Button></>)}
                   {booking.status === "confirmed" && <Button size="sm" onClick={() => updateBookingStatus(booking.id, "in_progress")}>{t("providerDashboard.start")}</Button>}
                   {booking.status === "in_progress" && <Button size="sm" onClick={() => updateBookingStatus(booking.id, "completed")}>{t("providerDashboard.complete")}</Button>}
                 </div>
                </div>
                {/* Payment Status */}
                <div className="flex flex-wrap gap-2 text-xs border-t pt-2">
                  <Badge variant={(booking as any).booking_fee_status === 'paid' ? 'default' : 'secondary'}>
                    {t("booking.bookingFee")}: {(booking as any).booking_fee_status === 'paid' ? '✓' : '○'} ${Number((booking as any).booking_fee || 0).toFixed(2)}
                  </Badge>
                  <Badge variant={(booking as any).service_payment_status === 'paid' ? 'default' : 'secondary'}>
                    {t("booking.servicePrice")}: {(booking as any).service_payment_status === 'paid' ? '✓' : '○'} ${Number((booking as any).service_price || 0).toFixed(2)}
                  </Badge>
                </div>
                {/* Price Adjustments */}
                <PriceAdjustmentPanel
                  bookingId={booking.id}
                  currentPrice={Number((booking as any).service_price || 0)}
                  bookingStatus={booking.status}
                  onPriceUpdated={fetchAll}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Share Profile Link */}
      {profile && (
        <ShareProfileLink profileId={profile.id} providerName={profile.full_name} />
      )}
    </div>
    </PullToRefresh>
  );
};

export default ProviderDashboard;
