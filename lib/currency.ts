export const formatCurrency = (val: string) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

// Robustly parse any user/formatted input ($1,200.00, "1.200,50", "1200")
// back into a clean numeric string like "1200.00" / "1200.5" / "1200".
export const parseCurrencyInput = (val: string): string => {
  if (val == null) return "";
  // Strip currency symbols, spaces, NBSPs, letters, and stray chars.
  let s = String(val).replace(/[^0-9.,\-]/g, "");
  // Drop leading negatives — price is always positive.
  s = s.replace(/-/g, "");
  if (!s) return "";
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  // Decide which char is the decimal separator (the last one wins),
  // and treat the other as a thousands separator.
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Comma is the decimal separator: strip all dots and all commas
      // except the last one (which becomes the decimal point).
      const head = s.slice(0, lastComma).replace(/[.,]/g, "");
      const tail = s.slice(lastComma + 1).replace(/[.,]/g, "");
      s = `${head}.${tail}`;
    } else {
      // Dot is the decimal separator: strip all commas, keep only the
      // last dot as the decimal point.
      const noCommas = s.replace(/,/g, "");
      const lastDotIdx = noCommas.lastIndexOf(".");
      const head = noCommas.slice(0, lastDotIdx).replace(/\./g, "");
      const tail = noCommas.slice(lastDotIdx + 1);
      s = `${head}.${tail}`;
    }
  } else if (lastComma !== -1) {
    // Only commas present. If the part after the last comma is exactly
    // 1–2 digits, treat comma as decimal; otherwise as thousands.
    const tail = s.slice(lastComma + 1);
    if (tail.length > 0 && tail.length <= 2 && /^\d+$/.test(tail)) {
      // Last comma becomes decimal, earlier commas are thousands separators.
      s = s.slice(0, lastComma).replace(/,/g, "") + "." + tail;
    } else {
      s = s.replace(/,/g, "");
    }
  } else {
    // Only dots (or none). Collapse to a single decimal point.
    const parts = s.split(".");
    if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  }
  // Clamp to 2 decimals without losing the trailing dot while typing.
  const [intPart, decPart] = s.split(".");
  const intClean = (intPart || "").replace(/^0+(?=\d)/, "") || (s.startsWith(".") ? "0" : "");
  if (decPart === undefined) return intClean;
  return `${intClean}.${decPart.slice(0, 2)}`;
};

export const validatePrice = (val: string): string | undefined => {
  const cleaned = parseCurrencyInput(val);
  if (!cleaned || cleaned === ".") return "Price must be a valid number";
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "Price must be a valid number";
  if (num <= 1) return "Price must be greater than $1.00";
  if (num > 1_000_000) return "Price cannot exceed $1,000,000";
  const decimals = cleaned.split(".")[1]?.length ?? 0;
  if (decimals > 2) return "Price cannot have more than 2 decimal places";
  return undefined;
};

export const sanitizePrice = (val: string): number => {
  // Reject input that contains no digits at all (e.g. "", ".", "$", "abc").
  if (val == null || !/\d/.test(String(val))) return 1;
  const num = parseFloat(parseCurrencyInput(val));
  return isNaN(num) ? 1 : num;
};
