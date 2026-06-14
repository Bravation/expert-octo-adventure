import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith("es") ? "es" : "en";

  const toggle = () => {
    i18n.changeLanguage(currentLang === "en" ? "es" : "en");
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-1.5 text-sm font-medium">
      <Globe className="h-4 w-4" />
      {currentLang === "en" ? "ES" : "EN"}
    </Button>
  );
};

export default LanguageToggle;
