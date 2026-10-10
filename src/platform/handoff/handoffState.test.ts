import { describe, it, expect } from 'vitest';
import { handoffState, isLaunched, isFullyPaid } from './handoffState';
import {
  HANDOFF_CHECKLIST,
  ACE_EXECUTES_NONE_NOTE,
  PER_ACCOUNT_BILLING_NOTE,
} from './checklist';

/**
 * FEAT-003 Capability 4 (design §5; AC9/FR4). Pure derivation only — nothing
 * here executes a hand-off step.
 */

describe('handoffState — the two-moment rule', () => {
  it('unlocks neither moment when not launched and unpaid', () => {
    const s = handoffState('not_launched', 'active');
    expect(s.billingHostingUnlocked).toBe(false);
    expect(s.codeOwnershipUnlocked).toBe(false);
    expect(s.unlockedMoments).toEqual([]);
  });

  it('unlocks ONLY billing/hosting at launch while the plan is still active (unpaid)', () => {
    const s = handoffState('launched', 'active');
    expect(s.billingHostingUnlocked).toBe(true);
    expect(s.codeOwnershipUnlocked).toBe(false);
    expect(s.unlockedMoments).toEqual(['billing_hosting']);
  });

  it('unlocks BOTH moments once launched and fully paid', () => {
    const s = handoffState('launched', 'completed');
    expect(s.billingHostingUnlocked).toBe(true);
    expect(s.codeOwnershipUnlocked).toBe(true);
    expect(s.unlockedMoments).toEqual(['billing_hosting', 'code_ownership_account']);
  });

  it('derives each combination of launched/not-launched x paid/unpaid', () => {
    expect(handoffState('not_launched', 'draft').unlockedMoments).toEqual([]);
    expect(handoffState('not_launched', 'completed').unlockedMoments).toEqual([
      'code_ownership_account',
    ]);
    expect(handoffState('launched', 'draft').unlockedMoments).toEqual(['billing_hosting']);
    expect(handoffState('launched', 'completed').unlockedMoments).toEqual([
      'billing_hosting',
      'code_ownership_account',
    ]);
  });

  it('treats real Project statuses as launched (active/maintenance/completed/closed)', () => {
    expect(isLaunched('active')).toBe(true);
    expect(isLaunched('maintenance')).toBe(true);
    expect(isLaunched('completed')).toBe(true);
    expect(isLaunched('closed')).toBe(true);
    expect(isLaunched('planning')).toBe(false);
    expect(isLaunched('contract_pending')).toBe(false);
    expect(isLaunched(null)).toBe(false);
    expect(isLaunched(undefined)).toBe(false);
  });

  it('treats only completed/paid plans as fully paid', () => {
    expect(isFullyPaid('completed')).toBe(true);
    expect(isFullyPaid('paid')).toBe(true);
    expect(isFullyPaid('active')).toBe(false);
    expect(isFullyPaid('defaulted')).toBe(false);
    expect(isFullyPaid('cancelled')).toBe(false);
    expect(isFullyPaid(null)).toBe(false);
    expect(isFullyPaid(undefined)).toBe(false);
  });
});

describe('handoff checklist content (AC9/FR4)', () => {
  it('documents both moments with manual steps', () => {
    expect(HANDOFF_CHECKLIST.map((m) => m.moment)).toEqual([
      'billing_hosting',
      'code_ownership_account',
    ]);
    const ownership = HANDOFF_CHECKLIST.find((m) => m.moment === 'code_ownership_account')!;
    const stepIds = ownership.steps.map((s) => s.id);
    expect(stepIds).toContain('remove-account-from-org');
    expect(stepIds).toContain('dns-cutover');
    expect(stepIds).toContain('stripe-cutover');
    expect(stepIds).toContain('ses-cutover');
    expect(stepIds).toContain('transfer-code');
  });

  it('marks DNS/Stripe/SES/RemoveAccount as never-automated', () => {
    const ownership = HANDOFF_CHECKLIST.find((m) => m.moment === 'code_ownership_account')!;
    const neverAutomated = ownership.steps.filter((s) => s.neverAutomated).map((s) => s.id);
    expect(neverAutomated).toEqual([
      'dns-cutover',
      'stripe-cutover',
      'ses-cutover',
      'remove-account-from-org',
    ]);
  });

  it('states ACE executes none of the steps and the per-account billing note', () => {
    expect(ACE_EXECUTES_NONE_NOTE).toMatch(/ACE executes none/i);
    expect(ACE_EXECUTES_NONE_NOTE).toMatch(/RemoveAccountFromOrganization/);
    expect(PER_ACCOUNT_BILLING_NOTE).toMatch(/per account, not per organization/i);
  });
});
