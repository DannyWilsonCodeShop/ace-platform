import { describe, it, expect } from 'vitest';
import {
  MONTHLY_CHECKLIST,
  checklistForVariant,
  checklistKeysForVariant,
  variantForClient,
} from './monthly-checklist';

describe('monthly-checklist variant selection (FEAT-007)', () => {
  it('with_maintenance returns the shared + maintenance-only items', () => {
    const keys = checklistKeysForVariant('with_maintenance');
    expect(keys).toEqual([
      'uptime_check',
      'error_review',
      'check_in_message',
      'payment_status',
      'backup_verify',
      'dependency_updates',
      'maintenance_hours',
      'feature_requests',
      'performance_tuning',
    ]);
    // The non-maintenance-only follow-ups are NOT shown.
    expect(keys).not.toContain('maintenance_offer');
    expect(keys).not.toContain('retention_touch');
  });

  it('without_maintenance returns the shared + non-maintenance items', () => {
    const keys = checklistKeysForVariant('without_maintenance');
    expect(keys).toEqual([
      'uptime_check',
      'error_review',
      'check_in_message',
      'payment_status',
      'backup_verify',
      'maintenance_offer',
      'retention_touch',
    ]);
    // The maintenance-only service items are NOT shown.
    expect(keys).not.toContain('dependency_updates');
    expect(keys).not.toContain('maintenance_hours');
  });

  it('both variants share the common five items', () => {
    const withKeys = checklistKeysForVariant('with_maintenance');
    const withoutKeys = checklistKeysForVariant('without_maintenance');
    const shared = ['uptime_check', 'error_review', 'check_in_message', 'payment_status', 'backup_verify'];
    for (const k of shared) {
      expect(withKeys).toContain(k);
      expect(withoutKeys).toContain(k);
    }
  });

  it('every item key is unique', () => {
    const keys = MONTHLY_CHECKLIST.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('checklistForVariant returns items each tagged for the requested variant', () => {
    for (const item of checklistForVariant('with_maintenance')) {
      expect(item.variant).toContain('with_maintenance');
    }
    for (const item of checklistForVariant('without_maintenance')) {
      expect(item.variant).toContain('without_maintenance');
    }
  });

  it('variantForClient maps the maintenance flag to the right variant', () => {
    expect(variantForClient(true)).toBe('with_maintenance');
    expect(variantForClient(false)).toBe('without_maintenance');
    expect(variantForClient(null)).toBe('without_maintenance');
    expect(variantForClient(undefined)).toBe('without_maintenance');
  });
});
