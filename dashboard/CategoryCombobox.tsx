import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SERVICE_CATEGORIES } from "@/constants/serviceCategories";
import { useTranslation } from "react-i18next";

interface CategoryComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

const CategoryCombobox = ({ value, onValueChange, placeholder }: CategoryComboboxProps) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const displayLabel = value
    ? t(`serviceCategories.${value}`, value)
    : (placeholder || t("providerDashboard.selectCategory"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(value, search, keywords) => {
          const searchLower = search.toLowerCase();
          const target = [value, ...(keywords || [])].join(" ").toLowerCase();
          return target.includes(searchLower) ? 1 : 0;
        }}>
          <CommandInput placeholder={t("providerDashboard.searchCategory", "Search category...")} />
          <CommandList>
            <CommandEmpty>{t("providerDashboard.noCategoryFound", "No category found.")}</CommandEmpty>
            {[...SERVICE_CATEGORIES]
              .map((cat) => ({
                ...cat,
                subgroups: [...cat.subgroups].sort((a, b) =>
                  t(`serviceCategories.${a}`, a).localeCompare(t(`serviceCategories.${b}`, b))
                ),
              }))
              .sort((a, b) =>
                t(`serviceCategories.${a.group}`, a.group).localeCompare(t(`serviceCategories.${b.group}`, b.group))
              )
              .map((cat) => (
              <CommandGroup key={cat.group} heading={t(`serviceCategories.${cat.group}`, cat.group)}>
                {cat.subgroups.map((sub) => {
                  const translatedSub = t(`serviceCategories.${sub}`, sub);
                  return (
                    <CommandItem
                      key={sub}
                      value={translatedSub}
                      keywords={[sub, t(`serviceCategories.${cat.group}`, cat.group)]}
                      onSelect={() => {
                        onValueChange(sub);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === sub ? "opacity-100" : "opacity-0")} />
                      {translatedSub}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CategoryCombobox;
