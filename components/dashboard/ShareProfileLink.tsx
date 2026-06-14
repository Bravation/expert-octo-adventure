import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Check, Share2, Facebook, Linkedin, MessageCircle, QrCode, Download, Mail, Send, MessageSquare, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareProfileLinkProps {
  profileId: string;
  providerName?: string;
  compact?: boolean;
  smsRecipient?: string;
}

const ShareProfileLink = ({ profileId, providerName, compact = false, smsRecipient }: ShareProfileLinkProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [smsRecipientInput, setSmsRecipientInput] = useState(smsRecipient ?? "");
  const profileUrl = `${window.location.origin}/provider/${profileId}`;
  // Sanitize recipient: keep leading + and digits only (E.164-friendly).
  const sanitizedSmsRecipient = (() => {
    const source = smsRecipientInput || smsRecipient || "";
    const trimmed = source.trim();
    if (!trimmed) return "";
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return "";
    return hasPlus ? `+${digits}` : digits;
  })();
  const shareText = providerName
    ? t("share.text", "Check out {{name}}'s services on ServiHub!", { name: providerName })
    : t("share.textGeneric", "Check out this service provider on ServiHub!");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success(t("share.copied", "Link copied to clipboard!"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("share.copyError", "Failed to copy link"));
    }
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById("qr-code-svg") || document.getElementById("qr-code-svg-compact");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.download = `servihub-qr-${profileId}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const socialLinks = [
    {
      name: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`,
      color: "hover:bg-[#1877F2] hover:text-white",
    },
    {
      name: "X",
      icon: XIcon,
      url: `https://x.com/intent/tweet?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(shareText)}`,
      color: "hover:bg-foreground hover:text-background",
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${profileUrl}`)}`,
      color: "hover:bg-[#25D366] hover:text-white",
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`,
      color: "hover:bg-[#0A66C2] hover:text-white",
    },
    {
      name: "Telegram",
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(shareText)}`,
      color: "hover:bg-[#229ED9] hover:text-white",
    },
    {
      name: "Reddit",
      icon: MessageSquare,
      url: `https://www.reddit.com/submit?url=${encodeURIComponent(profileUrl)}&title=${encodeURIComponent(shareText)}`,
      color: "hover:bg-[#FF4500] hover:text-white",
    },
    {
      name: "Email",
      icon: Mail,
      url: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n\n${profileUrl}`)}`,
      color: "hover:bg-foreground hover:text-background",
    },
    {
      name: "SMS",
      icon: Smartphone,
      url: sanitizedSmsRecipient
        ? `sms:${sanitizedSmsRecipient}?body=${encodeURIComponent(`${shareText} ${profileUrl}`)}`
        : `sms:?body=${encodeURIComponent(`${shareText} ${profileUrl}`)}`,
      color: "hover:bg-[#34B7F1] hover:text-white",
    },
  ];

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyAsFallback = async (platform: string) => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.info(
        t(
          "share.fallbackCopied",
          "Couldn't open {{platform}} — link copied to clipboard instead.",
          { platform }
        )
      );
    } catch {
      toast.error(
        t("share.fallbackFailed", "Couldn't open {{platform}}. Please copy the link manually.", {
          platform,
        })
      );
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      await copyAsFallback(t("share.nativeShare", "Share…"));
      return;
    }
    try {
      await navigator.share({ title: shareText, text: shareText, url: profileUrl });
    } catch (err: any) {
      // AbortError = user cancelled; anything else is a real failure
      if (err?.name === "AbortError") return;
      await copyAsFallback(t("share.nativeShare", "Share…"));
    }
  };

  const handleSocialClick = (url: string, platform: string) => {
    try {
      if (url.startsWith("mailto:") || url.startsWith("sms:")) {
        // Use a temporary anchor so blocked mailto handlers don't navigate the page away
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener noreferrer";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const win = window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
      if (!win || win.closed || typeof win.closed === "undefined") {
        // Popup blocked or open failed
        void copyAsFallback(platform);
      }
    } catch {
      void copyAsFallback(platform);
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
            <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="max-w-[160px] truncate text-xs text-muted-foreground">{profileUrl}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy} data-testid="share-copy-compact">
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {canNativeShare && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleNativeShare}
              title={t("share.nativeShare", "Share…")}
              data-testid="share-native-compact"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
          {socialLinks.map((social) => {
            const Icon = social.icon;
            return (
              <Button
                key={social.name}
                variant="outline"
                size="icon"
                className={`h-8 w-8 shrink-0 transition-colors ${social.color}`}
                onClick={() => handleSocialClick(social.url, social.name)}
                title={t("share.shareOn", "Share on {{platform}}", { platform: social.name })}
                data-testid={`share-social-compact-${social.name.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setShowQr(!showQr)}
            title={t("share.showQr", "Show QR Code")}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
        {showQr && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-xl border border-border bg-white p-4">
              <QRCodeSVG id="qr-code-svg-compact" value={profileUrl} size={150} level="M" />
            </div>
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleDownloadQr}>
              <Download className="h-4 w-4" />
              {t("share.downloadQr", "Download QR Code")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{t("share.title", "Share Your Profile")}</CardTitle>
            <CardDescription>{t("share.subtitle", "Promote your services on social media")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Copy link row */}
        <div className="flex gap-2">
          <Input
            readOnly
            value={profileUrl}
            className="bg-muted/50 text-sm"
            onFocus={(e) => e.target.select()}
          />
          <Button variant="outline" className="shrink-0 gap-2" onClick={handleCopy} data-testid="share-copy">
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? t("share.copied", "Copied!") : t("share.copy", "Copy")}
          </Button>
        </div>

        {/* Optional SMS recipient */}
        <div className="space-y-1.5">
          <Label htmlFor="sms-recipient" className="text-xs text-muted-foreground">
            {t("share.smsRecipientLabel", "SMS recipient (optional)")}
          </Label>
          <Input
            id="sms-recipient"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("share.smsRecipientPlaceholder", "+1 555 123 4567")}
            value={smsRecipientInput}
            onChange={(e) => setSmsRecipientInput(e.target.value)}
            className="bg-muted/50 text-sm"
            data-testid="share-sms-recipient"
          />
          <p className="text-xs text-muted-foreground">
            {sanitizedSmsRecipient
              ? t("share.smsRecipientPreview", "SMS will be sent to {{number}}.", {
                  number: sanitizedSmsRecipient,
                })
              : t(
                  "share.smsRecipientHint",
                  "Add a phone number to pre-fill the SMS recipient. Leave empty to let the user pick."
                )}
          </p>
        </div>

        {/* Social buttons */}
        <div className="flex flex-wrap gap-2">
          {canNativeShare && (
            <Button
              variant="outline"
              className="flex-1 min-w-[110px] gap-2"
              onClick={handleNativeShare}
              data-testid="share-native"
            >
              <Share2 className="h-4 w-4" />
              {t("share.nativeShare", "Share…")}
            </Button>
          )}
          {socialLinks.map((social) => {
            const Icon = social.icon;
            return (
              <Button
                key={social.name}
                variant="outline"
                className={`flex-1 min-w-[110px] gap-2 transition-colors ${social.color}`}
                onClick={() => handleSocialClick(social.url, social.name)}
                data-testid={`share-social-${social.name.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
                {social.name}
              </Button>
            );
          })}
        </div>

        {/* QR Code toggle */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={() => setShowQr(!showQr)}
          >
            <QrCode className="h-4 w-4" />
            {showQr ? t("share.hideQr", "Hide QR Code") : t("share.showQr", "Show QR Code")}
          </Button>
          {showQr && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border border-border bg-white p-4">
                <QRCodeSVG id="qr-code-svg" value={profileUrl} size={180} level="M" />
              </div>
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleDownloadQr}>
                <Download className="h-4 w-4" />
                {t("share.downloadQr", "Download QR Code")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShareProfileLink;
