import { describe, it, expect } from "vitest";
import { formatCurrency, parseCurrencyInput, validatePrice, sanitizePrice } from "./currency";

describe("formatCurrency", () => {
  it("returns empty string for invalid input", () => {
    expect(formatCurrency("")).toBe("");
    expect(formatCurrency("abc")).toBe("");
    expect(formatCurrency("$")).toBe("");
  });

  it("formats 1 as $1.00", () => {
    expect(formatCurrency("1")).toBe("$1.00");
  });

  it("formats 12.3 as $12.30", () => {
    expect(formatCurrency("12.3")).toBe("$12.30");
  });

  it("formats 1200 as $1,200.00", () => {
    expect(formatCurrency("1200")).toBe("$1,200.00");
  });

  it("formats 0 as $0.00", () => {
    expect(formatCurrency("0")).toBe("$0.00");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency("1000000")).toBe("$1,000,000.00");
  });
});

describe("parseCurrencyInput", () => {
  it("returns empty string for null/empty/invalid", () => {
    expect(parseCurrencyInput("")).toBe("");
    expect(parseCurrencyInput("abc")).toBe("");
    expect(parseCurrencyInput("$")).toBe("");
  });

  it("parses 0 correctly", () => {
    expect(parseCurrencyInput("0")).toBe("0");
    expect(parseCurrencyInput("$ 0.00")).toBe("0.00");
  });

  it("parses 12.3 correctly", () => {
    expect(parseCurrencyInput("12.3")).toBe("12.3");
    expect(parseCurrencyInput("$12.30")).toBe("12.30");
  });

  it("parses 1200 correctly", () => {
    expect(parseCurrencyInput("1200")).toBe("1200");
    expect(parseCurrencyInput("1,200")).toBe("1200");
    expect(parseCurrencyInput("$1,200.00")).toBe("1200.00");
  });

  it("handles comma-as-decimal ambiguity (1–2 tail digits)", () => {
    expect(parseCurrencyInput("1,5")).toBe("1.5");
    expect(parseCurrencyInput("1,50")).toBe("1.50");
  });

  it("handles comma-as-thousands separator (3+ tail digits)", () => {
    expect(parseCurrencyInput("1,500")).toBe("1500");
  });

  it("handles mixed dots and commas", () => {
    expect(parseCurrencyInput("1.200,50")).toBe("1200.50");
    expect(parseCurrencyInput("1,200.50")).toBe("1200.50");
  });

  it("clamps to 2 decimals", () => {
    expect(parseCurrencyInput("12.3456")).toBe("12.34");
  });

  it("strips negatives", () => {
    expect(parseCurrencyInput("-50")).toBe("50");
    expect(parseCurrencyInput("-$100")).toBe("100");
  });

  it("collapses multiple dots and clamps to 2 decimals", () => {
    expect(parseCurrencyInput("1.2.3.4")).toBe("1.23");
  });
});

describe("validatePrice", () => {
  it("returns error for empty/invalid", () => {
    expect(validatePrice("")).toBe("Price must be a valid number");
    expect(validatePrice("abc")).toBe("Price must be a valid number");
  });

  it("returns error for '.' which parses as 0", () => {
    expect(validatePrice(".")).toBe("Price must be greater than $1.00");
  });

  it("returns error for values <= 1", () => {
    expect(validatePrice("0")).toBe("Price must be greater than $1.00");
    expect(validatePrice("1")).toBe("Price must be greater than $1.00");
    expect(validatePrice("1.00")).toBe("Price must be greater than $1.00");
  });

  it("passes for 1.01", () => {
    expect(validatePrice("1.01")).toBeUndefined();
  });

  it("returns error for > 1,000,000", () => {
    expect(validatePrice("1000001")).toBe("Price cannot exceed $1,000,000");
  });

  it("clamps > 2 decimals during parsing so validation passes", () => {
    expect(validatePrice("12.345")).toBeUndefined();
  });

  it("passes for valid values", () => {
    expect(validatePrice("12.3")).toBeUndefined();
    expect(validatePrice("1200")).toBeUndefined();
    expect(validatePrice("1000000")).toBeUndefined();
  });
});

describe("sanitizePrice", () => {
  it("returns parsed number for valid input", () => {
    expect(sanitizePrice("0")).toBe(0);
    expect(sanitizePrice("1200")).toBe(1200);
    expect(sanitizePrice("12.3")).toBe(12.3);
    expect(sanitizePrice("$1,200.50")).toBe(1200.5);
  });

  it("falls back to 1 for invalid input", () => {
    expect(sanitizePrice("")).toBe(1);
    expect(sanitizePrice("abc")).toBe(1);
  });

  it("handles edge cases", () => {
    expect(sanitizePrice(".")).toBe(1);
    expect(sanitizePrice("-$50")).toBe(50);
  });
});

describe("partial / in-progress typing inputs", () => {
  describe("formatCurrency", () => {
    it("returns empty string for empty input", () => {
      expect(formatCurrency("")).toBe("");
    });

    it("returns empty string for lone '.'", () => {
      expect(formatCurrency(".")).toBe("");
    });

    it("formats trailing-dot '1.' as $1.00", () => {
      expect(formatCurrency("1.")).toBe("$1.00");
    });

    it("formats '1.0' as $1.00", () => {
      expect(formatCurrency("1.0")).toBe("$1.00");
    });

    it("formats leading-dot '.5' as $0.50", () => {
      expect(formatCurrency(".5")).toBe("$0.50");
    });
  });

  describe("parseCurrencyInput", () => {
    it("returns empty string for empty input", () => {
      expect(parseCurrencyInput("")).toBe("");
    });

    it("preserves trailing dot while typing '1.'", () => {
      expect(parseCurrencyInput("1.")).toBe("1.");
    });

    it("preserves trailing zero '1.0'", () => {
      expect(parseCurrencyInput("1.0")).toBe("1.0");
    });

    it("normalizes leading dot '.5' to '0.5'", () => {
      expect(parseCurrencyInput(".5")).toBe("0.5");
    });

    it("preserves '0.' while typing", () => {
      expect(parseCurrencyInput("0.")).toBe("0.");
    });
  });

  describe("validatePrice", () => {
    it("rejects empty input", () => {
      expect(validatePrice("")).toBe("Price must be a valid number");
    });

    it("rejects lone '.'", () => {
      expect(validatePrice(".")).toBe("Price must be greater than $1.00");
    });

    it("treats '1.' as 1 (below minimum)", () => {
      expect(validatePrice("1.")).toBe("Price must be greater than $1.00");
    });

    it("treats '1.0' as 1 (below minimum)", () => {
      expect(validatePrice("1.0")).toBe("Price must be greater than $1.00");
    });

    it("accepts '1.01' typed in pieces", () => {
      expect(validatePrice("1.01")).toBeUndefined();
    });
  });

  describe("sanitizePrice", () => {
    it("falls back to 1 for empty input", () => {
      expect(sanitizePrice("")).toBe(1);
    });

    it("returns 1 for '1.'", () => {
      expect(sanitizePrice("1.")).toBe(1);
    });

    it("returns 1 for '1.0'", () => {
      expect(sanitizePrice("1.0")).toBe(1);
    });

    it("returns 0.5 for '.5'", () => {
      expect(sanitizePrice(".5")).toBe(0.5);
    });
  });
});
