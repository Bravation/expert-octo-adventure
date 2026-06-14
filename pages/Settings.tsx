import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Save, User, Camera, Globe, Sun, Moon, Monitor, Trash2, MessageSquarePlus, Shield, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";

const MAX_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 500;
const MAX_FIELD_LENGTH = 100;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as const })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const currentLang = i18n.language?.startsWith("es") ? "es" : "en";

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setBio(profile.bio || "");
      setCity(profile.city || "");
      setState(profile.state || "");
      setZipCode(profile.zip_code || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("settings.invalidFileType", "Please upload a JPG, PNG, or WebP image"));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("settings.fileTooLarge", "Image must be less than 2MB"));
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user.id);

    setUploading(false);

    if (updateError) {
      toast.error(updateError.message);
    } else {
      setAvatarUrl(publicUrl);
      toast.success(t("settings.avatarUpdated", "Profile photo updated"));
      refreshProfile();
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error(t("settings.nameRequired", "Name is required"));
      return;
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      toast.error(t("settings.nameTooLong", "Name must be less than 100 characters"));
      return;
    }

    if (!user || !profile) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: trimmedName,
        bio: bio.trim().slice(0, MAX_BIO_LENGTH),
        city: city.trim().slice(0, MAX_FIELD_LENGTH),
        state: state.trim().slice(0, MAX_FIELD_LENGTH),
        zip_code: zipCode.trim().slice(0, MAX_FIELD_LENGTH),
      })
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("settings.saved", "Profile updated successfully"));
      refreshProfile();
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);

    // Deactivate the profile instead of hard-deleting
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("user_id", user.id);

    if (error) {
      toast.error(t("settings.deleteError", "Failed to delete account. Please try again."));
      setDeleting(false);
      return;
    }

    toast.success(t("settings.deleteSuccess", "Account deactivated successfully"));
    await signOut();
    navigate("/");
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    toast.success(
      lang === "es"
        ? "Idioma cambiado a Español"
        : "Language changed to English"
    );
  };

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const themeOptions = [
    { value: "light", label: t("settings.themeLight", "Light"), icon: Sun },
    { value: "dark", label: t("settings.themeDark", "Dark"), icon: Moon },
    { value: "system", label: t("settings.themeSystem", "System"), icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl py-8 space-y-6">
        <BackButton fallback="/dashboard" />

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t("settings.title", "Profile Settings")}</CardTitle>
                <CardDescription>{t("settings.subtitle", "Update your personal information")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Avatar Upload */}
            <div className="mb-6 flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-border">
                  <AvatarImage src={avatarUrl} alt={profile?.full_name} />
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {uploading
                  ? t("settings.uploading", "Uploading...")
                  : t("settings.avatarHint", "Click the camera icon to upload a photo (max 2MB)")}
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("settings.fullName", "Full Name")}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("settings.email", "Email")}</Label>
                <Input
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.emailHint", "Email cannot be changed here")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{t("settings.bio", "Bio")}</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={MAX_BIO_LENGTH}
                  rows={4}
                  placeholder={t("settings.bioPlaceholder", "Tell us about yourself...")}
                />
                <p className="text-xs text-muted-foreground">
                  {bio.length}/{MAX_BIO_LENGTH}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">{t("settings.city", "City")}</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={MAX_FIELD_LENGTH}
                    placeholder="Miami"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{t("settings.state", "State")}</Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    maxLength={MAX_FIELD_LENGTH}
                    placeholder="FL"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">{t("settings.zipCode", "Zip Code")}</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    maxLength={10}
                    placeholder="33101"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? t("settings.saving", "Saving...") : t("settings.save", "Save Changes")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Language Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("settings.languageTitle", "Language")}</CardTitle>
                <CardDescription>{t("settings.languageSubtitle", "Choose your preferred language")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant={currentLang === "en" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => handleLanguageChange("en")}
              >
                <span className="text-base">🇺🇸</span>
                English
              </Button>
              <Button
                variant={currentLang === "es" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => handleLanguageChange("es")}
              >
                <span className="text-base">🇪🇸</span>
                Español
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Sun className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("settings.themeTitle", "Appearance")}</CardTitle>
                <CardDescription>{t("settings.themeSubtitle", "Customize how ServiHub looks")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.value}
                    variant={theme === opt.value ? "default" : "outline"}
                    className="flex-1 gap-2"
                    onClick={() => setTheme(opt.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Feedback History */}
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => navigate("/suggestions")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <MessageSquarePlus className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{t("suggestionsHistory.title", "My Feedback")}</CardTitle>
                <CardDescription>{t("settings.feedbackSubtitle", "View your past suggestions and AI responses")}</CardDescription>
              </div>
              <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        {/* Admin Panel Link */}
        {isAdmin && (
          <Card className="cursor-pointer transition-colors hover:bg-muted/50 border-primary/30" onClick={() => navigate("/admin/suggestions")}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{t("admin.manageFeedback", "Manage Feedback")}</CardTitle>
                  <CardDescription>{t("admin.suggestionsSubtitle", "View and manage all user submissions")}</CardDescription>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg text-destructive">
                  {t("settings.dangerZone", "Danger Zone")}
                </CardTitle>
                <CardDescription>
                  {t("settings.dangerSubtitle", "Irreversible actions on your account")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {t("settings.deleteAccount", "Delete Account")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.deleteAccountDesc", "Permanently deactivate your account and all associated data")}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-2 shrink-0">
                      <Trash2 className="h-4 w-4" />
                      {t("settings.deleteAccount", "Delete Account")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("settings.deleteConfirmTitle", "Are you absolutely sure?")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t(
                          "settings.deleteConfirmDesc",
                          "This will deactivate your account. Your profile will no longer be visible and you won't be able to access your bookings or services. This action cannot be easily undone."
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("settings.cancel", "Cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting
                          ? t("settings.deleting", "Deleting...")
                          : t("settings.confirmDelete", "Yes, delete my account")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;