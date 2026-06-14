import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

const InstallBanner = () => {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) return;

    // Don't show if recently dismissed
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 86400000) return;

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show manual instructions
    if (isIOS()) {
      setTimeout(() => {
        setShowIOSBanner(true);
        setVisible(true);
      }, 2000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-16 left-3 right-3 z-[60] animate-in slide-in-from-bottom-4 fade-in duration-500 md:hidden",
        "rounded-2xl border bg-card p-4 shadow-xl"
      )}
    >
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 pr-4">
          <p className="text-sm font-semibold text-foreground">
            {t("install.title", "Install ServiHub")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {showIOSBanner
              ? t(
                  "install.iosInstructions",
                  "Tap the Share button, then \"Add to Home Screen\" to install."
                )
              : t(
                  "install.description",
                  "Add to your home screen for quick access, offline support, and a native app experience."
                )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {showIOSBanner ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={handleDismiss}
          >
            <Share className="h-3.5 w-3.5" />
            {t("install.gotIt", "Got it!")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-primary text-xs text-primary-foreground"
            onClick={handleInstall}
          >
            <Download className="h-3.5 w-3.5" />
            {t("install.installNow", "Install Now")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={handleDismiss}
        >
          {t("install.notNow", "Not now")}
        </Button>
      </div>
    </div>
  );
};

export default InstallBanner;
