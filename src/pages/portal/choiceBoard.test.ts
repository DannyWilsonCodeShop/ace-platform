import { describe, it, expect } from 'vitest';
import {
  parseOptions,
  resolveQuoteTotal,
  summarizeTerms,
  formatOptionPrice,
} from './choiceBoard';

describe('parseOptions (FEAT-001 §2.4 / AC3)', () => {
  it('carries tier and price from the seeded/Tab-3 option shape', () => {
    const opts = parseOptions([
      { name: 'Good', imageKey: 'k1', tier: 'good', price: 1000 },
      { name: 'Best', imageKey: null, tier: 'best', price: null },
    ]);
    expect(opts).toHaveLength(2);
    expect(opts[0]).toMatchObject({ slug: 'Good', name: 'Good', tier: 'good', price: 1000 });
    expect(opts[1]).toMatchObject({ slug: 'Best', name: 'Best', tier: 'best', price: null });
  });

  it('still handles legacy {slug,name,imageKey,previewUrl} options (tier/price absent)', () => {
    const opts = parseOptions([
      { slug: 'legacy', name: 'Legacy', imageKey: 'k', previewUrl: 'u' },
    ]);
    expect(opts[0].slug).toBe('legacy');
    expect(opts[0].tier).toBeUndefined();
    expect(opts[0].price).toBeNull();
  });

  it('tolerates a JSON string and the plain-string legacy shape', () => {
    expect(parseOptions('[{"name":"A","tier":"good","price":"500"}]')[0]).toMatchObject({
      slug: 'A',
      tier: 'good',
      price: 500,
    });
    expect(parseOptions(['x'])[0]).toMatchObject({ slug: 'x', name: 'x' });
    expect(parseOptions('not json')).toEqual([]);
  });
});

describe('resolveQuoteTotal (FEAT-001 §2.4 MEDIUM-1 / AC3)', () => {
  const options = [
    { slug: 'Good', name: 'Good', tier: 'good' as const, price: 1000 },
    { slug: 'Better', name: 'Better', tier: 'better' as const, price: 2000 },
    { slug: 'Best', name: 'Best', tier: 'best' as const, price: 3000 },
  ];

  it('shows "Your quote: $X" for a selected option matched by slug', () => {
    expect(resolveQuoteTotal(options, 'Better')).toBe('Your quote: $2,000.00');
  });

  it('shows "from $min" when nothing is selected', () => {
    expect(resolveQuoteTotal(options, null)).toBe('from $1,000.00');
  });

  it('shows "from $min" when the selected option has no numeric price', () => {
    const mixed = [
      { slug: 'Good', name: 'Good', price: null },
      { slug: 'Best', name: 'Best', price: 3000 },
    ];
    expect(resolveQuoteTotal(mixed, 'Good')).toBe('from $3,000.00');
  });

  it('shows "quote TBD" when no option has a numeric price', () => {
    const tbd = [
      { slug: 'Good', name: 'Good', price: null },
      { slug: 'Best', name: 'Best', price: null },
    ];
    expect(resolveQuoteTotal(tbd, null)).toBe('quote TBD');
    expect(resolveQuoteTotal(tbd, 'Good')).toBe('quote TBD');
  });
});

describe('formatOptionPrice (FEAT-001 §2.4)', () => {
  it('formats a number as USD currency', () => {
    expect(formatOptionPrice(1250)).toBe('$1,250.00');
  });
  it('renders "price TBD" for null/undefined/NaN', () => {
    expect(formatOptionPrice(null)).toBe('price TBD');
    expect(formatOptionPrice(undefined)).toBe('price TBD');
    expect(formatOptionPrice(Number('x'))).toBe('price TBD');
  });
});

describe('summarizeTerms (FEAT-001 §2.4 / AC3)', () => {
  it('formats the string-scalar seeded terms and omits missing lines', () => {
    const lines = summarizeTerms({
      fixedPrice: '50000',
      downPayments: [{ label: 'Down payment 1 of 2', amount: '2500', dueDate: '2026-10-21' }],
      monthlyAmount: '1250',
      monthlyCount: '36',
      minimumAmount: '20000',
      maintenanceAmount: '500',
      deliveryTarget: '',
      ipTransfersAtFullPayment: true,
      noRefund: true,
    });
    expect(lines).toContain('Fixed price: $50,000.00');
    expect(lines).toContain('Down payment 1 of 2: $2,500.00 (due 2026-10-21)');
    expect(lines).toContain('36 monthly payments of $1,250.00');
    expect(lines).toContain('Minimum owed: $20,000.00');
    expect(lines).toContain('$500.00/mo maintenance');
    expect(lines).toContain('You own the code at full payment');
    expect(lines).toContain('Payments are non-refundable');
  });

  it('omits lines for missing/blank fields rather than rendering undefined', () => {
    const lines = summarizeTerms({ fixedPrice: '1000' });
    expect(lines).toEqual(['Fixed price: $1,000.00']);
  });

  it('returns [] for prose or empty terms', () => {
    expect(summarizeTerms('just some text')).toEqual([]);
    expect(summarizeTerms(null)).toEqual([]);
  });
});
