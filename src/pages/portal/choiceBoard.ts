/**
 * Pure parse/format helpers for the customer portal choice board + contract
 * terms (design §2.4). Extracted from MyProject.tsx so they are unit-testable
 * with no React/network. The portal is the trust boundary between stored
 * `Demo.options` / `Contract.terms` JSON (untrusted) and the render: prices and
 * term scalars are coerced with Number(...) and NaN/null falls back to a
 * readable placeholder rather than a broken value.
 */

export type ChoiceBoardTier = 'good' | 'better' | 'best';

/** A single choice-board option as stored in Demo.options (json). */
export type DemoOption = {
  slug: string;
  name: string;
  imageKey?: string;
  previewUrl?: string;
  tier?: ChoiceBoardTier;
  price?: number | null;
};

/**
 * Parse Demo.options (a json column that may arrive as an array already, or as
 * a JSON string) into DemoOption objects. Tolerates the legacy plain-string
 * shape by wrapping each string into an option object. The `slug` is derived
 * from `name` when absent (seeded/Tab-3 options carry no slug), keeping the
 * selected-option match rule `option.slug === demo.selectedOption` consistent.
 * `tier`/`price` are surfaced here (the GraphQL layer already returns them);
 * legacy options without them parse to undefined/null and render as before.
 */
export function parseOptions(options: any): DemoOption[] {
  let raw: any = options;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o: any): DemoOption | null => {
      if (typeof o === 'string') return { slug: o, name: o };
      if (o && typeof o === 'object' && (o.slug || o.name)) {
        return {
          slug: String(o.slug || o.name),
          name: String(o.name || o.slug),
          imageKey: o.imageKey || undefined,
          previewUrl: o.previewUrl || undefined,
          tier: o.tier || undefined,
          price: o.price == null ? null : Number(o.price),
        };
      }
      return null;
    })
    .filter((o): o is DemoOption => o !== null);
}

/**
 * Contract.terms is a.json() — it can arrive as an already-parsed object, as a
 * JSON string, or as a plain human-readable string. Parse defensively: return
 * the object when it is one (or a JSON string that decodes to an object),
 * otherwise return the original string so callers can render it as prose.
 */
export function parseTerms(terms: any): any {
  if (terms == null) return null;
  if (typeof terms === 'object') return terms;
  if (typeof terms === 'string') {
    const trimmed = terms.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return terms;
      }
    }
    return terms;
  }
  return terms;
}

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'usd' });

/**
 * Format an option/term price. Untrusted JSON: coerce with Number(...) and
 * render 'price TBD' when the value is null/undefined/NaN rather than a broken
 * total.
 */
export function formatOptionPrice(price: number | null | undefined): string {
  if (price == null) return 'price TBD';
  const n = Number(price);
  if (Number.isNaN(n)) return 'price TBD';
  return currencyFmt.format(n);
}

/**
 * Resolve the choice-board quote-total line (the "three tier quote at the
 * bottom"). If an option matches `demo.selectedOption` (by slug) and its price
 * is a valid number, show "Your quote: $X". Otherwise fall back to a
 * "from $min" summary across the numeric-priced tiers; if none is numeric,
 * "quote TBD".
 */
export function resolveQuoteTotal(
  options: DemoOption[],
  selectedOption: string | null | undefined,
): string {
  const numeric = (p: number | null | undefined): p is number =>
    p != null && !Number.isNaN(Number(p));

  if (selectedOption) {
    const match = options.find((o) => o.slug === selectedOption);
    if (match && numeric(match.price)) {
      return `Your quote: ${currencyFmt.format(Number(match.price))}`;
    }
  }

  const prices = options
    .map((o) => o.price)
    .filter(numeric)
    .map((p) => Number(p));
  if (prices.length === 0) return 'quote TBD';
  return `from ${currencyFmt.format(Math.min(...prices))}`;
}

/**
 * Build a readable, human agreement summary from the structured Contract.terms
 * object (price, down schedule, monthly series, minimum, maintenance, IP, and
 * refund policy). Each scalar is coerced defensively; a missing/non-numeric
 * field omits its line rather than rendering `undefined`. Returns [] for a
 * non-structured (prose/empty) terms value so the caller can skip the summary.
 */
export function summarizeTerms(terms: any): string[] {
  if (!terms || typeof terms !== 'object') return [];
  const lines: string[] = [];

  const num = (v: any): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const fixedPrice = num(terms.fixedPrice);
  if (fixedPrice != null) {
    lines.push(`Fixed price: ${currencyFmt.format(fixedPrice)}`);
  }

  if (Array.isArray(terms.downPayments)) {
    for (const d of terms.downPayments) {
      const amt = num(d?.amount);
      if (amt == null) continue;
      const label = d?.label ? String(d.label) : 'Down payment';
      const due = d?.dueDate ? ` (due ${String(d.dueDate)})` : '';
      lines.push(`${label}: ${currencyFmt.format(amt)}${due}`);
    }
  }

  const monthlyAmount = num(terms.monthlyAmount);
  const monthlyCount = num(terms.monthlyCount);
  if (monthlyAmount != null && monthlyCount != null) {
    lines.push(`${monthlyCount} monthly payments of ${currencyFmt.format(monthlyAmount)}`);
  } else if (monthlyAmount != null) {
    lines.push(`Monthly payments of ${currencyFmt.format(monthlyAmount)}`);
  }

  const minimumAmount = num(terms.minimumAmount);
  if (minimumAmount != null) {
    lines.push(`Minimum owed: ${currencyFmt.format(minimumAmount)}`);
  }

  const maintenanceAmount = num(terms.maintenanceAmount);
  if (maintenanceAmount != null) {
    lines.push(`${currencyFmt.format(maintenanceAmount)}/mo maintenance`);
  }

  if (terms.ipTransfersAtFullPayment) {
    lines.push('You own the code at full payment');
  }
  if (terms.noRefund) {
    lines.push('Payments are non-refundable');
  }

  return lines;
}
