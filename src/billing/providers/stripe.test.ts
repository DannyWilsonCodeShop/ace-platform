import { describe, it, expect, vi, afterEach } from 'vitest';
import { stripe } from './stripe';

/**
 * NO-NETWORK-WHEN-UNCONFIGURED contract: the two new adapter methods MUST make
 * zero network calls and return { configured: false } when configured() is
 * false. We stub configured() false and assert global fetch is never called.
 */
describe('stripe adapter — no network when unconfigured', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createPlanInvoice returns {configured:false} and never fetches', async () => {
    vi.spyOn(stripe, 'configured').mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await stripe.createPlanInvoice({
      planId: 'plan-1',
      planItemId: 'item-1',
      amount: 2500,
      dueDate: '2026-10-21',
      clientEmail: 'client@example.com',
    });

    expect(result).toEqual({ configured: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('createSubscriptionSchedule returns {configured:false} and never fetches', async () => {
    vi.spyOn(stripe, 'configured').mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await stripe.createSubscriptionSchedule({
      planId: 'plan-1',
      amount: 1250,
      count: 36,
      startDate: '2026-12-01',
      clientEmail: 'client@example.com',
    });

    expect(result).toEqual({ configured: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('createSubscription (trialEnd) returns {configured:false} and never fetches', async () => {
    vi.spyOn(stripe, 'configured').mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await stripe.createSubscription({
      plan: 'maint-1',
      amount: 500,
      cadence: 'monthly',
      trialEnd: '2026-12-30',
      clientEmail: 'client@example.com',
    });

    expect(result).toEqual({ configured: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
