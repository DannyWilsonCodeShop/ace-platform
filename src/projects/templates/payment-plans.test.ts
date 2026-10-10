import { describe, it, expect } from 'vitest';
import { agencyBuild50k } from './agency-build-50k';
import {
  materializePlan,
  paid,
  owedToOwn,
  minimumRemaining,
  minimumMet,
  getPaymentPlanTemplate,
  listPaymentPlanTemplates,
  type PaidItemLike,
} from './payment-plans';

describe('materializePlan (design §Acceptance #1)', () => {
  const ids = { projectId: 'proj-1', clientId: 'client-1' };
  const { plan, items, maintenance } = materializePlan(agencyBuild50k, ids);

  it('stamps the PaymentPlan input with literal (non-derived) minimums', () => {
    expect(plan.totalAmount).toBe(50000);
    expect(plan.installmentCount).toBe(36);
    expect(plan.minimumPaymentsOwed).toBe(12);
    // Literal 20000 — explicitly NOT the offer's monthly-only 15000 (NIT-3).
    expect(plan.minimumAmountOwed).toBe(20000);
    expect(plan.minimumAmountOwed).not.toBe(15000);
    expect(plan.ownershipTransfersAtFullPayment).toBe(true);
    expect(plan.licenseEndsOnDefault).toBe(true);
    expect(plan.currency).toBe('usd');
    expect(plan.status).toBe('draft');
    expect(plan.projectId).toBe('proj-1');
    expect(plan.clientId).toBe('client-1');
  });

  it('yields exactly two dated down_payment rows', () => {
    const downs = items.filter((i) => i.kind === 'down_payment');
    expect(downs).toHaveLength(2);
    expect(downs[0]).toMatchObject({ amount: 2500, dueDate: '2026-10-21', sequence: 1 });
    expect(downs[1]).toMatchObject({ amount: 2500, dueDate: '2026-11-04', sequence: 2 });
  });

  it('yields one installment series descriptor at sequence 0', () => {
    const installments = items.filter((i) => i.kind === 'installment');
    expect(installments).toHaveLength(1);
    expect(installments[0]).toMatchObject({
      sequence: 0,
      amount: 1250,
      cadence: 'monthly',
      intervalCount: 1,
      startDate: '2026-12-01',
      anchorDay: 1,
      count: 36,
    });
  });

  it('emits a MaintenancePlan input NOT summed into totalAmount', () => {
    expect(maintenance).toBeDefined();
    expect(maintenance).toMatchObject({
      amount: 500,
      cadence: 'monthly',
      startedAt: '2026-12-30',
    });
    // Maintenance is separate — the total stays the fixed price.
    expect(plan.totalAmount).toBe(50000);
  });

  it('is pure — repeated calls produce equal results', () => {
    const again = materializePlan(agencyBuild50k, ids);
    expect(again).toEqual({ plan, items, maintenance });
  });
});

describe('template registry', () => {
  it('resolves the agency template by key', () => {
    expect(getPaymentPlanTemplate('agency-build-50k')).toBe(agencyBuild50k);
  });

  it('returns undefined for an unknown key', () => {
    expect(getPaymentPlanTemplate('nope')).toBeUndefined();
  });

  it('lists the registered templates', () => {
    expect(listPaymentPlanTemplates()).toContain(agencyBuild50k);
  });
});

describe('paid-vs-owed math', () => {
  const items: PaidItemLike[] = [
    { amount: 2500, status: 'paid' },
    { amount: 2500, status: 'paid' },
    { amount: 1250, status: 'paid' },
    { amount: 1250, status: 'scheduled' },
    { amount: 1250, status: 'invoiced' },
  ];

  it('paid sums only paid items', () => {
    expect(paid(items)).toBe(6250);
  });

  it('owedToOwn = totalAmount − paid', () => {
    expect(owedToOwn(50000, paid(items))).toBe(43750);
  });

  it('minimumRemaining clamps at zero', () => {
    expect(minimumRemaining(20000, 6250)).toBe(13750);
    expect(minimumRemaining(20000, 25000)).toBe(0);
  });

  it('minimumMet compares installmentsPaidCount vs minimumPaymentsOwed', () => {
    expect(minimumMet(11, 12)).toBe(false);
    expect(minimumMet(12, 12)).toBe(true);
    expect(minimumMet(13, 12)).toBe(true);
  });
});
