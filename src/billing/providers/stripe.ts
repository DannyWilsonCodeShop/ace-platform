/**
 * Stripe billing adapter (FEAT-002) — TEST MODE, backend-gateway wired.
 *
 * SECRET HANDLING: the Stripe SECRET key is NEVER present in the frontend. It
 * lives only in the backend Lambda env (process.env.STRIPE_SECRET_KEY). This
 * adapter calls the backend API Gateway (which holds the secret) and only ever
 * sees the hosted Checkout URL it returns. The `stripe` node SDK is NOT
 * imported here, so it never enters the browser bundle.
 *
 * configured() keys off the frontend's view of billing (presence of a
 * publishable key / endpoint) via billingConfigured(); the authoritative
 * secret gate remains server-side. When a backend call fails, methods return
 * { configured: false } so the UI falls back cleanly.
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
import { billingConfigured, billingEndpoint } from '../billing';

/** POST JSON to a backend billing route; returns parsed JSON or null on failure. */
async function postJson(path: string, payload: Record<string, unknown>): Promise<any | null> {
  try {
    const res = await fetch(`${billingEndpoint()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const stripe: StripeAdapter = {
  configured(): boolean {
    // Frontend-side view: a publishable key / endpoint is wired. The secret
    // gate is enforced by the backend gateway.
    return billingConfigured();
  },

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    if (!this.configured()) {
      // Not configured: no network call, caller stays "billing not connected".
      return { configured: false };
    }

    const result = await postJson('/stripe/create-subscription', {
      planId: input.plan,
      amount: input.amount,
      cadence: input.cadence,
      clientEmail: input.clientEmail,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    if (!result || typeof result.url !== 'string') {
      return { configured: false };
    }
    // The subscriptionId is stamped later by the Lambda webhook on
    // customer.subscription.* events; return only the Checkout URL here.
    return { configured: true, checkoutUrl: result.url };
  },

  async cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<CancelSubscriptionResult> {
    // TEST-MODE: there is no /stripe/cancel-subscription route (not one of the
    // three required endpoints). Live subscription cancellation is owner-driven
    // via the Stripe dashboard; the DB status is still set to 'cancelled' by
    // cancelPlan() in ProjectDetail. TODO(stripe-cancel-route): add a backend
    // cancel route when app-initiated live cancellation is required.
    void input;
    return { configured: true };
  },

  async createOneOffPaymentLink(
    input: CreateOneOffPaymentLinkInput,
  ): Promise<CreateOneOffPaymentLinkResult> {
    if (!this.configured()) {
      // Not configured: no network call, caller stays "billing not connected".
      return { configured: false };
    }

    const result = await postJson('/stripe/create-checkout', {
      invoiceId: input.invoice,
      amount: input.amount,
      clientEmail: input.clientEmail,
      description: input.description,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    if (!result || typeof result.url !== 'string') {
      return { configured: false };
    }
    return { configured: true, paymentLink: result.url };
  },
};
