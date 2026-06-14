import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Shield, TrendingDown, Users, Briefcase, Star, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import FeaturedServices from "@/components/FeaturedServices";
import Testimonials from "@/components/Testimonials";
import { useTranslation } from "react-i18next";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [heroSearch, setHeroSearch] = useState("");

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/services${heroSearch.trim() ? `?q=${encodeURIComponent(heroSearch.trim())}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-sm">
              <TrendingDown className="h-4 w-4 text-accent" />
              {t("hero.badge")}
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-6xl lg:text-7xl">
              {t("hero.title1")}{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {t("hero.title2")}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              {t("hero.subtitle")}
            </p>
            <form onSubmit={handleHeroSearch} className="mx-auto mt-8 flex w-full max-w-lg items-center gap-2 rounded-full border bg-card p-1.5 shadow-lg transition-shadow focus-within:shadow-xl focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("hero.searchPlaceholder")}
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
              />
              <Button type="submit" size="sm" className="rounded-full px-5 gap-1.5">
                {t("hero.searchCta")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{t("hero.popularSearches")}</span>
              {["chip_plumbing", "chip_cleaning", "chip_tutoring", "chip_landscaping", "chip_painting"].map((key) => (
                <button
                  key={key}
                  onClick={() => navigate(`/services?q=${encodeURIComponent(t(`hero.${key}`))}`)}
                  className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
                >
                  {t(`hero.${key}`)}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="gap-2 text-base bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(user ? "/dashboard" : "/auth")}>
                {user ? t("hero.ctaLoggedIn") : t("hero.ctaLoggedOut")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base" onClick={() => navigate("/services")}>
                {t("hero.browseCta")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-card py-20">
        <div className="container">
          <h2 className="text-center font-display text-3xl font-bold">{t("features.heading")}</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
            {t("features.subtitle")}
          </p>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { icon: TrendingDown, title: t("features.commission"), desc: t("features.commissionDesc") },
              { icon: Shield, title: t("features.secure"), desc: t("features.secureDesc") },
              { icon: Star, title: t("features.reputation"), desc: t("features.reputationDesc") },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-xl border bg-background p-6 shadow-sm transition-all hover:shadow-md">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <FeaturedServices />

      {/* Testimonials & Social Proof */}
      <Testimonials />

      {/* How it works */}
      <section className="py-20">
        <div className="container">
          <h2 className="text-center font-display text-3xl font-bold">{t("howItWorks.heading")}</h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc") },
              { step: "02", title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc") },
              { step: "03", title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc") },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
                  {step}
                </div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-90" />
        <div className="container relative text-center">
          <h2 className="font-display text-3xl font-bold text-primary-foreground sm:text-4xl">
            {t("cta.heading")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            {t("cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="gap-2 text-base bg-background text-foreground hover:bg-background/90"
              onClick={() => navigate(user ? "/dashboard" : "/auth")}
            >
              {user ? t("hero.ctaLoggedIn") : t("cta.signUp")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate("/services")}
            >
              {t("hero.browseCta")}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 font-display font-bold text-primary">
            <Briefcase className="h-5 w-5" />
            ServiHub
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={() => navigate("/terms")} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
              {t("footer.terms", "Terms of Service")}
            </button>
            <button onClick={() => navigate("/privacy")} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
              {t("footer.privacy", "Privacy Policy")}
            </button>
            <button onClick={() => navigate("/community-guidelines")} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
              {t("footer.community", "Community Guidelines")}
            </button>
            <p className="text-sm text-muted-foreground">{t("footer.rights")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
