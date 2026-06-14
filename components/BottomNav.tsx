import { useLocation, useNavigate } from "react-router-dom";
import { Home, Search, LayoutDashboard, Settings, LogIn, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const tabs = [
    { path: "/", icon: Home, label: t("nav.home", "Home") },
    { path: "/services", icon: Search, label: t("nav.browseServices", "Services") },
    ...(user
      ? [
          { path: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard", "Dashboard") },
          { path: "/my-requests", icon: ClipboardList, label: t("nav.myRequests", "My Requests") },
          { path: "/settings", icon: Settings, label: t("nav.settings", "Settings") },
        ]
      : [{ path: "/auth", icon: LogIn, label: t("nav.getStarted", "Sign In") }]),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
