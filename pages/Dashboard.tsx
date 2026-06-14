import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";
import ProviderDashboard from "@/components/dashboard/ProviderDashboard";

const Dashboard = () => {
  const { profile, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isProvider = profile?.role === "service_provider";
  const dashboardTitle = isProvider
    ? t("dashboard.providerTitle", "Provider Dashboard")
    : t("dashboard.customerTitle", "Customer Dashboard");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 sm:px-8 py-6 sm:py-10">
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1">{dashboardTitle}</h1>
        <p className="text-muted-foreground mb-6">
          {isProvider
            ? t("dashboard.providerSubtitle", "Manage your services and bookings")
            : t("dashboard.customerSubtitle", "Track your service bookings")}
        </p>
        {isProvider ? <ProviderDashboard /> : <CustomerDashboard />}
      </div>
    </div>
  );
};

export default Dashboard;
