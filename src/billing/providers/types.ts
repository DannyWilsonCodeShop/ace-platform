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
  /** ISO timestamp the trial ends (sub billing starts); forwarded as `trialEnd`. */
  trialEnd?: string;
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

/** Input for creating a hosted invoice for a single payment-plan item (e.g. a down payment). */
export interface CreatePlanInvoiceInput {
  /** The ACE PaymentPlan.id this invoice belongs to. */
  planId: string;
  /** The ACE PaymentPlanItem.id being invoiced. */
  planItemId: string;
  /** Amount in major units (dollars); the backend converts to minor units. */
  amount: number;
  /** ISO 4217 currency; defaults server-side when omitted. */
  currency?: string;
  /** ISO date string the invoice is due. */
  dueDate: string;
  /** Customer email to send the hosted invoice to. */
  clientEmail: string;
  /** Human-readable description shown on the invoice line item. */
  description?: string;
}

/** Result of a createPlanInvoice call. */
export interface CreatePlanInvoiceResult {
  /** False when the adapter is not configured (no secret) — no network call was made. */
  configured: boolean;
  /** External Stripe invoice reference, if created. */
  invoiceId?: string;
  /** Hosted Stripe invoice URL, if created. */
  hostedInvoiceUrl?: string;
}

/** Input for creating the installment subscription schedule (the series). */
export interface CreateSubscriptionScheduleInput {
  /** The ACE PaymentPlan.id this schedule belongs to. */
  planId: string;
  /** Per-installment amount in major units (dollars); the backend converts to minor units. */
  amount: number;
  /** ISO 4217 currency; defaults server-side when omitted. */
  currency?: string;
  /** Number of installments (schedule iterations). */
  count: number;
  /** ISO date string the schedule starts. */
  startDate: string;
  /** Customer email to attach to the Stripe customer / schedule. */
  clientEmail: string;
}

/** Result of a createSubscriptionSchedule call. */
export interface CreateSubscriptionScheduleResult {
  /** False when the adapter is not configured (no secret) — no network call was made. */
  configured: boolean;
  /** External Stripe subscription_schedule reference, if created. */
  scheduleId?: string;
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
  /**
   * Create a hosted invoice for a single payment-plan item. MUST make NO network
   * call and return { configured: false } when the adapter is not configured.
   */
  createPlanInvoice(
    input: CreatePlanInvoiceInput,
  ): Promise<CreatePlanInvoiceResult>;
  /**
   * Create the installment subscription schedule. MUST make NO network call and
   * return { configured: false } when the adapter is not configured.
   */
  createSubscriptionSchedule(
    input: CreateSubscriptionScheduleInput,
  ): Promise<CreateSubscriptionScheduleResult>;
}
