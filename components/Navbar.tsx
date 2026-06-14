import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, Briefcase, Settings, Sun, Moon, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import LanguageToggle from "@/components/LanguageToggle";
import NotificationBell from "@/components/NotificationBell";

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-primary">
          <Briefcase className="h-6 w-6" />
          ServiHub
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <Link to="/services" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.browseServices")}
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {t("nav.dashboard")}
              </Link>
              {profile?.role === "service_provider" ? (
                <Link to="/service-requests" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
                  {t("nav.serviceRequests", "Requests")}
                </Link>
              ) : (
                <Link to="/my-requests" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
                  {t("nav.myRequests", "My Requests")}
                </Link>
              )}
              <div className="flex items-center gap-2">
                <Link to="/settings" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {profile?.full_name || profile?.email}
                  {profile?.role && (
                    <span className="ml-1.5 text-xs text-primary/70">
                      ({profile.role === "service_provider" ? t("nav.provider", "Provider") : t("nav.customer", "Customer")})
                    </span>
                  )}
                </Link>
                <NotificationBell />
                <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} title={t("nav.settings", "Settings")}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => navigate("/auth")}>{t("nav.getStarted")}</Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={t("settings.themeTitle", "Appearance")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <LanguageToggle />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {user && <NotificationBell />}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <LanguageToggle />
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t bg-background p-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link to="/services" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>{t("nav.browseServices")}</Link>
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>{t("nav.dashboard")}</Link>
                {profile?.role === "service_provider" ? (
                  <Link to="/service-requests" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                    {t("nav.serviceRequests", "Requests")}
                  </Link>
                ) : (
                  <Link to="/my-requests" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                    {t("nav.myRequests", "My Requests")}
                  </Link>
                )}
                <Link to="/settings" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>{t("nav.settings", "Settings")}</Link>
                <Button variant="outline" onClick={handleSignOut}>{t("nav.signOut")}</Button>
              </>
            ) : (
              <Button onClick={() => { navigate("/auth"); setMobileOpen(false); }}>{t("nav.getStarted")}</Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
