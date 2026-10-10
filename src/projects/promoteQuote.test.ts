import { describe, it, expect } from 'vitest';
import { buildProjectInput, buildProjectPageInput } from './promoteQuote';
import { getTemplate } from './templates';
import type { TrackedItem } from './templates/types';

/**
 * Regression test for FEAT-001: the quote->project promotion path must never
 * stamp an `owner` key on any createX input. Passing `owner` is what broke
 * quote Accept with "field not defined for input object type
 * CreateProjectInput". These assertions exercise the pure input builders used
 * by promoteQuote (no network).
 */
describe('promoteQuote pure input builders (FEAT-001: no owner on create)', () => {
  const template = getTemplate('app-build');

  it('buildProjectInput does not include an `owner` key', () => {
    const input = buildProjectInput({
      quoteId: 'quote-1',
      clientId: 'client-1',
      name: 'Acme app',
      template,
      quotedAmount: 50000,
    });
    expect('owner' in input).toBe(false);
    expect(input.quoteId).toBe('quote-1');
    expect(input.clientId).toBe('client-1');
    expect(input.name).toBe('Acme app');
    expect(input.status).toBe('contract_pending');
    expect(input.templateKey).toBe(template.key);
    expect(input.quotedAmount).toBe(50000);
  });

  it('buildProjectInput normalizes a null quotedAmount without an owner key', () => {
    const input = buildProjectInput({
      quoteId: 'quote-2',
      clientId: 'client-2',
      name: 'No-price app',
      template,
      quotedAmount: null,
    });
    expect('owner' in input).toBe(false);
    expect(input.quotedAmount).toBeNull();
  });

  it('buildProjectPageInput does not include an `owner` key for any template item', () => {
    const items: TrackedItem[] = [
      ...template.frontend,
      ...template.backend,
      ...template.middleware,
    ];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const input = buildProjectPageInput('proj-1', item);
      expect('owner' in input).toBe(false);
      expect(input.projectId).toBe('proj-1');
      expect(input.pageKey).toBe(item.key);
      expect(input.category).toBe(item.category);
    }
  });
});
