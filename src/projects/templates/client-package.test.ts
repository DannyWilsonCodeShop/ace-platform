import { describe, it, expect } from 'vitest';
import {
  defaultChoiceBoardOptions,
  defaultContractTerms,
  defaultStarterActionItems,
} from './client-package';
import { fromTerms, nonNeg } from '../../pages/clientTabs/Tab4Agreement';

describe('defaultChoiceBoardOptions (FEAT-001 §2.2 / NIT-1)', () => {
  const options = defaultChoiceBoardOptions();

  it('returns exactly three tiered options', () => {
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.tier)).toEqual(['good', 'better', 'best']);
  });

  it('pins ALL three prices to null (NIT-1)', () => {
    for (const o of options) {
      expect(o.price).toBeNull();
    }
  });

  it('matches the authoritative {name,imageKey,tier,price} shape with imageKey null', () => {
    for (const o of options) {
      expect(Object.keys(o).sort()).toEqual(['imageKey', 'name', 'price', 'tier']);
      expect(o.imageKey).toBeNull();
      expect(typeof o.name).toBe('string');
      expect('slug' in o).toBe(false);
    }
  });
});

describe('defaultContractTerms (FEAT-001 §2.2 / HIGH-1 string scalars)', () => {
  const terms = defaultContractTerms();

  it('translates the agency-build-50k numbers as STRINGS', () => {
    expect(terms.fixedPrice).toBe('50000');
    expect(terms.monthlyAmount).toBe('1250');
    expect(terms.monthlyAnchorDay).toBe('1');
    expect(terms.monthlyCount).toBe('36');
    expect(terms.minimumAmount).toBe('20000');
    expect(terms.maintenanceAmount).toBe('500');
    expect(terms.maintenanceStart).toBe('2026-12-30');
    expect(terms.deliveryTarget).toBe('');
  });

  it('emits two down payments with string amounts', () => {
    expect(terms.downPayments).toHaveLength(2);
    for (const d of terms.downPayments) {
      expect(d.amount).toBe('2500');
      expect(typeof d.amount).toBe('string');
    }
    expect(terms.downPayments.map((d) => d.dueDate)).toEqual(['2026-10-21', '2026-11-04']);
  });

  it('keeps booleans as booleans', () => {
    expect(terms.ipTransfersAtFullPayment).toBe(true);
    expect(terms.noRefund).toBe(true);
  });

  it('every scalar numeric is a string (not a number)', () => {
    const scalars = [
      terms.fixedPrice,
      terms.monthlyAmount,
      terms.monthlyAnchorDay,
      terms.monthlyCount,
      terms.minimumAmount,
      terms.maintenanceAmount,
      ...terms.downPayments.map((d) => d.amount),
    ];
    for (const v of scalars) {
      expect(typeof v).toBe('string');
    }
  });

  // HIGH-1: driving the seeded terms through Tab 4's read + validate path
  // (which .trim()s every scalar unconditionally) must NOT throw.
  it('round-trips through fromTerms + nonNeg + .trim() without throwing (HIGH-1)', () => {
    const roundTripped = fromTerms(terms);
    const scalars = [
      roundTripped.fixedPrice,
      roundTripped.monthlyAmount,
      roundTripped.monthlyCount,
      roundTripped.minimumAmount,
      roundTripped.maintenanceAmount,
      ...roundTripped.downPayments.map((d) => d.amount),
    ];
    expect(() => {
      for (const v of scalars) {
        nonNeg(v); // calls v.trim() internally
        v.trim(); // the persistContract terms.fixedPrice.trim() path
      }
    }).not.toThrow();
    expect(scalars.every((v) => nonNeg(v))).toBe(true);
  });
});

describe('defaultStarterActionItems (FEAT-001 §2.2 / MEDIUM-3)', () => {
  const items = defaultStarterActionItems('proj-abc');

  it('returns exactly three client-owned starter items', () => {
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.title)).toEqual([
      'Choose your domain name',
      'Send branding assets (logo, colors)',
      'Review & sign the Build & Buy agreement',
    ]);
  });

  it('each item carries projectId + title, owner_role client, no owner/pageKey', () => {
    items.forEach((it, idx) => {
      expect(it.projectId).toBe('proj-abc');
      expect(typeof it.title).toBe('string');
      expect(it.owner_role).toBe('client');
      expect(it.sortOrder).toBe(idx);
      expect('owner' in it).toBe(false);
      expect('pageKey' in it).toBe(false);
    });
  });
});
