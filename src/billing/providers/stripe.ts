/**
 * Stripe billing adapter (FEAT-002).
 *
 * SECRET HANDLING: the secret key is read ONLY from the backend Lambda env
 * (process.env.STRIPE_SECRET_KEY). It is NEVER hardcoded, committed, or exposed
 * to the frontend, and its value is never returned or logged. When the key is
 * absent the adapter is a clean no-op: `configured()` returns false and every
 * method returns { configured: false } WITHOUT making any network call, so the
 * UI falls back to a "billing not connected" state.
 *
 * This file is intended to run in the backend adapter/Lambda context, not the
 * browser. The live Stripe calls are a NEEDS-MANUAL-VERIFICATION seam and are
 * left as a labeled TODO behind the configured() gate below. The `stripe` node
 * SDK is deliberately NOT imported at module top-level so it never enters the
 * browser bundle; it would be loaded via a dynamic import inside the gated
 * TODO block, which only executes in a configured backend context.
 */

import type {
  StripeAdapter,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionInput,
  CancelSubscriptionResult,
  CreateOneOffPaymentLinkInput,
  CreateOneOffPaymentLinkResult,
} from './types';

/**
 * Read the backend-only secret from the process env WITHOUT depending on
 * `@types/node` (the frontend tsconfig has no node types). We reach `process`
 * through `globalThis` with a narrow local shape and guard defensively so this
 * never throws in a browser bundle and never leaks a value. The key lives only
 * in the Lambda env.
 */
function secretKey(): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.STRIPE_SECRET_KEY;
}

export const stripe: StripeAdapter = {
  configured(): boolean {
    return Boolean(secretKey());
  },

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    const key = secretKey();
    if (!key) {
      // Not configured: no network call, caller stays "billing not connected".
      return { configured: false };
    }

    // TODO(stripe-live): wire the real Stripe Subscriptions call here, behind
    // this configured() gate. In a backend Lambda context, dynamically import
    // the SDK (`const Stripe = (await import('stripe')).default; const s = new
    // Stripe(key);`) so it NEVER enters the browser bundle, then create a
    // subscription for `input.plan` with statement_descriptor
    // "ATLANTA CREATIVE EXCH"; map the response to { subscriptionId,
    // nextBillingDate }. NEEDS-MANUAL-VERIFICATION — not exercised by the build.
    void input;
    return { configured: true };
  },

  async cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<CancelSubscriptionResult> {
    const key = secretKey();
    if (!key) {
      // Not configured: no network call.
      return { configured: false };
    }

    // TODO(stripe-live): wire the real Stripe subscription cancellation here,
    // behind this configured() gate, via a backend-only dynamic import of the
    // `stripe` SDK — `s.subscriptions.cancel(input.subscriptionId)`. NEEDS-
    // MANUAL-VERIFICATION — not exercised by the build.
    void input;
    return { configured: true };
  },

  async createOneOffPaymentLink(
    input: CreateOneOffPaymentLinkInput,
  ): Promise<CreateOneOffPaymentLinkResult> {
    const key = secretKey();
    if (!key) {
      // Not configured: no network call, caller stays "billing not connected".
      return { configured: false };
    }

    // TODO(stripe-live): wire the real Stripe Payment Link call here, behind
    // this configured() gate, via a backend-only dynamic import of the `stripe`
    // SDK — create a Payment Link for `input.invoice` with statement_descriptor
    // "ATLANTA CREATIVE EXCH" and map the response to { paymentLink }. NEEDS-
    // MANUAL-VERIFICATION — not exercised by the build.
    void input;
    return { configured: true };
  },
};
