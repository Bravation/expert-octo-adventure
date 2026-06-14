import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Briefcase, Users, Wrench } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useTranslation } from "react-i18next";
import ForgotPassword from "@/components/ForgotPassword";
import { lovable } from "@/integrations/lovable/index";

const AUTH_COOLDOWN_MS = 3000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;


const Auth = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<"customer" | "service_provider">("customer");
  const [attempts, setAttempts] = useState(0);
  const [lastAttempt, setLastAttempt] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setGoogleLoading(false);
    if (error) {
      toast.error(error.message || "Google sign-in failed");
    }
  };


  const canAttempt = (): boolean => {
    const now = Date.now();
    if (now < lockedUntil) {
      const secs = Math.ceil((lockedUntil - now) / 1000);
      toast.error(t("auth.lockedOut", `Too many attempts. Try again in ${secs}s.`));
      return false;
    }
    if (now - lastAttempt < AUTH_COOLDOWN_MS) {
      toast.error(t("auth.tooFast", "Please wait a moment before trying again."));
      return false;
    }
    return true;
  };

  const trackAttempt = (failed: boolean) => {
    setLastAttempt(Date.now());
    if (failed) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setAttempts(0);
      }
    } else {
      setAttempts(0);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAttempt()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoading(false);
    trackAttempt(!!error);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.welcomeBack"));
      navigate("/dashboard");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAttempt()) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: signupName, role: signupRole },
      },
    });
    setLoading(false);
    trackAttempt(!!error);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.checkEmail"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="font-display text-2xl">{t("auth.welcome")}</CardTitle>
            <CardDescription>{t("auth.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("auth.signIn")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signUp")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t("auth.email")}</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t("auth.password")}</Label>
                    <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="••••••••" />
                  </div>
                  <ForgotPassword />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t("auth.signingIn") : t("auth.signInBtn")}
                  </Button>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t("auth.or", "or")}</span></div>
                  </div>
                  <Button type="button" variant="outline" className="w-full gap-2" disabled={googleLoading} onClick={handleGoogleSignIn}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    {googleLoading ? t("auth.signingIn") : t("auth.signInWithGoogle", "Sign in with Google")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t("auth.fullName")}</Label>
                    <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t("auth.email")}</Label>
                    <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("auth.password")}</Label>
                    <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.iWantTo")}</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setSignupRole("customer")} className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${signupRole === "customer" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <Users className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">{t("auth.hireServices")}</span>
                      </button>
                      <button type="button" onClick={() => setSignupRole("service_provider")} className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${signupRole === "service_provider" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <Wrench className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">{t("auth.offerServices")}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="tos-checkbox"
                      checked={tosAccepted}
                      onCheckedChange={(checked) => setTosAccepted(checked === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="tos-checkbox" className="text-xs text-muted-foreground cursor-pointer leading-tight">
                      {t("auth.agreeToTerms", "I have read and agree to the")}{" "}
                      <a href="/terms" target="_blank" className="text-primary underline hover:text-primary/80" onClick={(e) => e.stopPropagation()}>{t("auth.termsLink", "Terms of Service")}</a>
                      {" "}{t("auth.and", "and")}{" "}
                      <a href="/privacy" target="_blank" className="text-primary underline hover:text-primary/80" onClick={(e) => e.stopPropagation()}>{t("auth.privacyLink", "Privacy Policy")}</a>
                    </label>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !tosAccepted}>
                    {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
                  </Button>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t("auth.or", "or")}</span></div>
                  </div>
                  <Button type="button" variant="outline" className="w-full gap-2" disabled={googleLoading || !tosAccepted} onClick={handleGoogleSignIn}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    {googleLoading ? t("auth.signingIn") : t("auth.signUpWithGoogle", "Sign up with Google")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
