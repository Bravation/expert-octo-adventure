import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatCurrency, parseCurrencyInput, validatePrice, sanitizePrice } from "./currency";

// Arbitrary: random strings made of characters a user might plausibly type
// into a currency input (digits, separators, currency symbols, whitespace,
// stray letters, signs). Includes empty strings.
const currencyLikeString = fc.string({
  unit: fc.constantFrom(
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ".", ",", "$", "-", " ", "\u00a0", "a", "b", "e", "E", "+",
  ),
  maxLength: 24,
});

// Arbitrary: well-formed numeric strings (what the input state actually holds
// after parseCurrencyInput normalizes typing).
const numericString = fc
  .tuple(
    fc.integer({ min: 0, max: 1_000_000 }),
    fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }),
  )
  .map(([whole, frac]) => (frac === undefined ? `${whole}` : `${whole}.${frac.toString().padStart(2, "0")}`));

describe("property: parseCurrencyInput never throws", () => {
  it("returns a string for any input", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const out = parseCurrencyInput(s);
        expect(typeof out).toBe("string");
      }),
      { numRuns: 500 },
    );
  });

  it("output contains only digits and at most one dot", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const out = parseCurrencyInput(s);
        if (out === "") return;
        expect(out).toMatch(/^\d*\.?\d*$/);
      }),
      { numRuns: 500 },
    );
  });

  it("never produces a negative sign", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        expect(parseCurrencyInput(s)).not.toMatch(/-/);
      }),
      { numRuns: 500 },
    );
  });

  it("decimal portion is clamped to at most 2 digits", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const out = parseCurrencyInput(s);
        const dec = out.split(".")[1];
        if (dec !== undefined) expect(dec.length).toBeLessThanOrEqual(2);
      }),
      { numRuns: 500 },
    );
  });
});

describe("property: formatCurrency never throws", () => {
  it("returns a string for any currency-like input", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const out = formatCurrency(s);
        expect(typeof out).toBe("string");
      }),
      { numRuns: 500 },
    );
  });

  it("returns either '' or a $-prefixed value with 2 decimals for numeric strings", () => {
    fc.assert(
      fc.property(numericString, (s) => {
        const out = formatCurrency(s);
        expect(out).toMatch(/^\$[\d,]+\.\d{2}$/);
      }),
      { numRuns: 500 },
    );
  });
});

describe("property: parse/format consistency", () => {
  // Round-trip: format -> strip $ and commas -> parseFloat equals original number
  it("formatCurrency(numericString) round-trips back to the same numeric value", () => {
    fc.assert(
      fc.property(numericString, (s) => {
        const formatted = formatCurrency(s);
        const stripped = formatted.replace(/[$,]/g, "");
        expect(parseFloat(stripped)).toBeCloseTo(parseFloat(s), 2);
      }),
      { numRuns: 500 },
    );
  });

  // parseCurrencyInput is idempotent on its own output.
  it("parseCurrencyInput is idempotent", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const once = parseCurrencyInput(s);
        const twice = parseCurrencyInput(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 500 },
    );
  });

  // formatCurrency(parseCurrencyInput(x)) is stable: re-parsing & re-formatting
  // does not change the displayed value.
  it("format(parse(x)) is stable under re-application", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const first = formatCurrency(parseCurrencyInput(s));
        const second = formatCurrency(parseCurrencyInput(first));
        expect(second).toBe(first);
      }),
      { numRuns: 500 },
    );
  });
});

describe("property: validatePrice + sanitizePrice never throw", () => {
  it("validatePrice returns string or undefined for any input", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const out = validatePrice(s);
        expect(out === undefined || typeof out === "string").toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("sanitizePrice always returns a finite, non-negative number", () => {
    fc.assert(
      fc.property(currencyLikeString, (s) => {
        const n = sanitizePrice(s);
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });
});