import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

type Suggestion = {
  label: string;
  type: "service" | "category";
};

type SearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  services: { title: string; category?: string | null }[];
  categories: string[];
  placeholder?: string;
};

const norm = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SearchAutocomplete = ({
  value,
  onChange,
  services,
  categories,
  placeholder,
}: SearchAutocompleteProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!value.trim()) return [];
    const q = norm(value);

    const catMatches = categories
      .filter((c) => norm(t(`serviceCategories.${c}`, c)).includes(q))
      .slice(0, 3)
      .map((c) => ({ label: t(`serviceCategories.${c}`, c), type: "category" as const }));

    const seen = new Set(catMatches.map((c) => norm(c.label)));
    const svcMatches = services
      .filter((s) => norm(s.title).includes(q) || norm(s.category || "").includes(q))
      .reduce<Suggestion[]>((acc, s) => {
        const key = norm(s.title);
        if (!seen.has(key)) {
          seen.add(key);
          acc.push({ label: s.title, type: "service" });
        }
        return acc;
      }, [])
      .slice(0, 5);

    return [...catMatches, ...svcMatches];
  }, [value, services, categories, t]);

  useEffect(() => {
    setActiveIdx(-1);
    setOpen(suggestions.length > 0 && value.trim().length > 0);
  }, [suggestions, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const select = (label: string) => {
    onChange(label);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx].label);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-10"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={`${s.type}-${s.label}-${i}`}
              onMouseDown={() => select(s.label)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              <span className="flex-1 truncate">{s.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.type === "category" ? t("services.category", "Category") : t("services.service", "Service")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;
