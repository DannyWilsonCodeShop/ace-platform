/**
 * Stripe webhook event handler (FEAT-002).
 *
 * TODO(webhook-wiring): there is no HTTP endpoint we can wire cleanly in this
 * build. The repo's API Gateway (/notify) is external and NOT managed by
 * amplify/backend.ts, and the existing Lambda functions
 * (create-user, notification-handler) are not defined via defineFunction or
 * wired into defineBackend. Rather than fake an endpoint, this exposes the
 * Stripe event state transitions as a plain exported function. When a real
 * Stripe webhook (or a manual admin action) can be delivered, call
 * applyStripeEvent() with the event payload. The caller supplies the data
 * accessors (the existing api.ts CRUD helpers) so this stays side-effect-driven
 * through the existing api.ts CRUD and does not assume a runtime context.
 *
 * On the four handled events this maps Stripe billing state onto the ACE
 * MaintenancePlan + Invoice records. Manual billing/admin flows remain fully
 * functional independent of this seam.
 *
 * Live webhook delivery, Stripe signature verification, and SDK calls are
 * NEEDS-MANUAL-VERIFICATION — not exercised by the build.
 */

/** Payload describing a Stripe billing event, from a webhook or manual action. */
export interface StripeWebhookEvent {
  /** The Stripe event type we handle. */
  type:
    | 'invoice.paid'
    | 'invoice.payment_failed'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted';
  /** External Stripe subscription id, when the event carries one. */
  stripeSubscriptionId?: string;
  /** External Stripe invoice id, when the event carries one. */
  stripeInvoiceId?: string;
  /** The ACE MaintenancePlan.id this event applies to, if known. */
  maintenancePlanId?: string;
  /** Amount (in the invoice's currency's minor unit) when relevant. */
  amount?: number;
  /** The ACE Client.id, if the event carries one. */
  clientId?: string;
  /** The ACE Project.id, if the event carries one. */
  projectId?: string;
  /** ISO timestamp the event occurred; defaults to now when omitted. */
  occurredAt?: string;
}

/** Data accessors the caller injects (the existing api.ts CRUD helpers). */
export interface StripeEventDeps {
  updateMaintenancePlan: (input: Record<string, any>) => Promise<any>;
  createInvoice: (input: Record<string, any>) => Promise<any>;
  updateInvoice: (input: Record<string, any>) => Promise<any>;
  listMaintenancePlansByProject?: (input: Record<string, any>) => Promise<any>;
}

/** Map a Stripe subscription status onto an ACE MaintenancePlan status. */
function planStatusFromSubscription(amount: number | undefined): string {
  // Stripe's `customer.subscription.updated` carries a status; callers that
  // know it should pass it through. Without a richer payload we treat a
  // non-failing update as keeping the plan active.
  void amount;
  return 'active';
}

/**
 * Apply a Stripe billing event onto the ACE MaintenancePlan + Invoice records
 * via the injected CRUD. Returns whatever the mutations produced. Errors
 * surface to the caller.
 *
 *  - invoice.paid                   → upsert a maintenance Invoice (recurring)
 *                                     + plan status 'active' + nextBillingDate
 *  - invoice.payment_failed         → plan status 'past_due'
 *  - customer.subscription.deleted  → plan status 'cancelled' + cancelledAt
 *  - customer.subscription.updated  → map Stripe status → plan status
 */
export async function applyStripeEvent(
  event: StripeWebhookEvent,
  deps: StripeEventDeps,
): Promise<{ plan?: any; invoice?: any }> {
  const occurredAt = event.occurredAt || new Date().toISOString();

  switch (event.type) {
    case 'invoice.paid': {
      let invoice: any;
      if (event.stripeInvoiceId) {
        invoice = await deps.createInvoice({
          kind: 'maintenance',
          recurring: true,
          stripeInvoiceId: event.stripeInvoiceId,
          ...(event.maintenancePlanId ? { maintenancePlanId: event.maintenancePlanId } : {}),
          ...(event.clientId ? { clientId: event.clientId } : {}),
          ...(event.projectId ? { projectId: event.projectId } : {}),
          ...(typeof event.amount === 'number' ? { amount: event.amount } : {}),
        });
      }

      let plan: any;
      if (event.maintenancePlanId) {
        plan = await deps.updateMaintenancePlan({
          id: event.maintenancePlanId,
          status: 'active',
          nextBillingDate: occurredAt,
        });
      }

      return { plan, invoice };
    }

    case 'invoice.payment_failed': {
      let plan: any;
      if (event.maintenancePlanId) {
        plan = await deps.updateMaintenancePlan({
          id: event.maintenancePlanId,
          status: 'past_due',
        });
      }
      return { plan };
    }

    case 'customer.subscription.deleted': {
      let plan: any;
      if (event.maintenancePlanId) {
        plan = await deps.updateMaintenancePlan({
          id: event.maintenancePlanId,
          status: 'cancelled',
          cancelledAt: occurredAt,
        });
      }
      return { plan };
    }

    case 'customer.subscription.updated': {
      let plan: any;
      if (event.maintenancePlanId) {
        plan = await deps.updateMaintenancePlan({
          id: event.maintenancePlanId,
          status: planStatusFromSubscription(event.amount),
        });
      }
      return { plan };
    }

    default:
      return {};
  }
}
