import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BackButtonProps {
  fallback?: string;
  label?: string;
  variant?: "ghost" | "outline";
  className?: string;
  showLabel?: boolean;
}

const BackButton = ({
  fallback = "/dashboard",
  label,
  variant = "ghost",
  className = "",
  showLabel = true,
}: BackButtonProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  const backLabel = label || t("common.back", "Back");

  return (
    <Button
      variant={variant}
      size={showLabel ? "sm" : "icon"}
      className={`gap-1.5 text-muted-foreground hover:text-foreground ${className}`}
      onClick={handleBack}
    >
      <ArrowLeft className="h-4 w-4" />
      {showLabel && backLabel}
    </Button>
  );
};

export default BackButton;
