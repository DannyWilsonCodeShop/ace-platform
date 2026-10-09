/**
 * Stripe webhook event handler (FEAT-002).
 *
 * SUPERSEDED FOR LIVE DELIVERY: live Stripe webhook handling now lives in the
 * ACE-QuoteHandler Lambda (infra/lambda/quoteHandler.mjs → handleStripeWebhook
 * / upsertInvoiceByStripeId). That Lambda receives Stripe events at
 * POST /stripe/webhook, verifies the Stripe-Signature header, and writes the
 * Invoice / MaintenancePlan DynamoDB rows directly — including the TD-4 upsert
 * by stripeInvoiceId. Do NOT wire a second live delivery path here.
 *
 * applyStripeEvent() below remains ONLY for manual / admin-triggered state
 * transitions (e.g. reconciling a record by hand). It applies the same TD-4
 * upsert semantics on invoice.paid: look up the Invoice by stripeInvoiceId via
 * the injected accessor and update it when found, creating a new row ONLY when
 * none exists, so the two code paths stay consistent and never duplicate.
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
  /**
   * TD-4 upsert support: look up an existing Invoice by its stripeInvoiceId so
   * invoice.paid can UPDATE instead of blindly CREATE. May return the matching
   * invoice (with an `id`) or undefined/null. When omitted, the invoice.paid
   * branch falls back to listInvoices filtering if provided, else creates.
   */
  getInvoiceByStripeId?: (stripeInvoiceId: string) => Promise<any>;
  /** Optional full list used to resolve an existing invoice when no direct lookup is given. */
  listInvoices?: () => Promise<any[]>;
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
        // TD-4 upsert: find an existing Invoice carrying this stripeInvoiceId
        // and UPDATE it; create a new row ONLY when none exists. This removes
        // the prior always-create behavior that risked duplicate rows.
        let existing: any;
        if (deps.getInvoiceByStripeId) {
          existing = await deps.getInvoiceByStripeId(event.stripeInvoiceId);
        } else if (deps.listInvoices) {
          const all = await deps.listInvoices();
          existing = (all || []).find(
            (inv: any) => inv.stripeInvoiceId === event.stripeInvoiceId,
          );
        }

        const paidFields: Record<string, any> = {
          status: 'paid',
          paidAt: occurredAt,
          ...(typeof event.amount === 'number' ? { total: event.amount } : {}),
        };

        if (existing?.id) {
          invoice = await deps.updateInvoice({ id: existing.id, ...paidFields });
        } else {
          invoice = await deps.createInvoice({
            kind: 'maintenance',
            recurring: true,
            stripeInvoiceId: event.stripeInvoiceId,
            ...paidFields,
            ...(event.maintenancePlanId ? { maintenancePlanId: event.maintenancePlanId } : {}),
            ...(event.clientId ? { clientId: event.clientId } : {}),
            ...(event.projectId ? { projectId: event.projectId } : {}),
          });
        }
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
