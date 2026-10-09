/**
 * Stripe billing provider seam (FEAT-002).
 *
 * TEST-MODE-FIRST: billing is an optional adapter behind this interface, gated
 * on its own backend-only secret (STRIPE_SECRET_KEY) so it cleanly no-ops
 * (reports configured:false) when the key is absent. No live network call is
 * ever made in this build; the live Subscriptions / Payment Link calls are a
 * NEEDS-MANUAL-VERIFICATION seam left as a labeled TODO behind configured().
 *
 * NO-NETWORK-WHEN-UNCONFIGURED CONTRACT: every method below MUST make ZERO
 * network calls and return { configured: false } when the adapter is not
 * configured. The browser build never requires the secret.
 */

/** Input for creating a recurring subscription (e.g. a maintenance plan). */
export interface CreateSubscriptionInput {
  /** The ACE MaintenancePlan.id (or plan descriptor) to subscribe. */
  plan: string;
  /** Plan amount in major units (dollars); the backend converts to minor units. */
  amount?: number;
  /** Billing cadence; maps to a Stripe recurring interval on the backend. */
  cadence?: 'monthly' | 'quarterly' | 'annual';
  /** Customer email to prefill on the hosted Checkout. */
  clientEmail?: string;
  /** URL to return to after a successful checkout. */
  successUrl?: string;
  /** URL to return to if the customer cancels. */
  cancelUrl?: string;
}

/** Result of a createSubscription call. */
export interface CreateSubscriptionResult {
  /** False when the adapter is not configured (no secret) — caller stays in "billing not connected" state. */
  configured: boolean;
  /** External Stripe subscription reference, if created (set later by the webhook). */
  subscriptionId?: string;
  /** ISO timestamp of the next billing date, if returned. */
  nextBillingDate?: string;
  /** Hosted Stripe Checkout URL to redirect the customer to, when created. */
  checkoutUrl?: string;
}

/** Input for cancelling an existing subscription. */
export interface CancelSubscriptionInput {
  /** The external Stripe subscription id to cancel. */
  subscriptionId: string;
}

/** Result of a cancelSubscription call. */
export interface CancelSubscriptionResult {
  /** False when the adapter is not configured (no secret) — no network call was made. */
  configured: boolean;
}

/** Input for creating a one-off payment link (e.g. a single invoice). */
export interface CreateOneOffPaymentLinkInput {
  /** The ACE Invoice.id (or invoice descriptor) to collect payment for. */
  invoice: string;
  /** Amount in major units (dollars); the backend converts to minor units. */
  amount?: number;
  /** Customer email to prefill on the hosted Checkout. */
  clientEmail?: string;
  /** Human-readable description shown on the Checkout line item. */
  description?: string;
  /** URL to return to after a successful checkout. */
  successUrl?: string;
  /** URL to return to if the customer cancels. */
  cancelUrl?: string;
}

/** Result of a createOneOffPaymentLink call. */
export interface CreateOneOffPaymentLinkResult {
  /** False when the adapter is not configured (no secret) — caller stays in "billing not connected" state. */
  configured: boolean;
  /** Hosted Stripe payment link URL, if created. */
  paymentLink?: string;
}

/**
 * Common interface every billing adapter implements. `configured()` lets
 * callers decide whether to offer the live-ish billing flow or stay in the
 * "billing not connected" state.
 */
export interface StripeAdapter {
  /** True only when the adapter's secret is present in the (backend) env. */
  configured(): boolean;
  /**
   * Create a recurring subscription. MUST make NO network call and return
   * { configured: false } when the adapter is not configured.
   */
  createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult>;
  /**
   * Cancel a subscription. MUST make NO network call and return
   * { configured: false } when the adapter is not configured.
   */
  cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<CancelSubscriptionResult>;
  /**
   * Create a one-off hosted payment link. MUST make NO network call and return
   * { configured: false } when the adapter is not configured.
   */
  createOneOffPaymentLink(
    input: CreateOneOffPaymentLinkInput,
  ): Promise<CreateOneOffPaymentLinkResult>;
}
