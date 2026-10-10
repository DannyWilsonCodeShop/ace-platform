/**
 * Payment-plan template registry + the pure `materializePlan` helper and the
 * paid-vs-owed math (design §C1, §C4 testability).
 *
 * The registry offers code-defined presets to the admin create UI (new deal =
 * add a file, not a code branch). `materializePlan` is PURE — no network/DB — and
 * turns a template into the `PaymentPlan` input, the `PaymentPlanItem[]` inputs
 * (two dated `down_payment` rows + one `installment` series-descriptor row with
 * `sequence 0`), and the separate `MaintenancePlan` input (NOT summed into the
 * total). It STAMPS `PaymentPlan.installmentCount` from the installment series
 * `count` so the webhook has its single, explicit completion source (NIT-4).
 */

import type { PaymentPlanTemplate } from './payment-plan-types';
import { agencyBuild50k } from './agency-build-50k';

/** The code-defined payment-plan presets, keyed by template key. */
export const PAYMENT_PLAN_TEMPLATES: Record<string, PaymentPlanTemplate> = {
  'agency-build-50k': agencyBuild50k,
};

/** List every registered payment-plan template. */
export function listPaymentPlanTemplates(): PaymentPlanTemplate[] {
  return Object.values(PAYMENT_PLAN_TEMPLATES);
}

/** Resolve a payment-plan template by key (undefined when unknown). */
export function getPaymentPlanTemplate(
  key: string,
): PaymentPlanTemplate | undefined {
  return PAYMENT_PLAN_TEMPLATES[key];
}

/** The ids a materialized plan is scoped to. */
export interface MaterializeIds {
  projectId: string;
  clientId: string;
}

/** A `PaymentPlanItem` create input emitted by `materializePlan`. */
export interface PaymentPlanItemInput {
  kind: 'down_payment' | 'installment' | 'maintenance';
  sequence: number;
  label?: string;
  amount: number;
  dueDate?: string;
  cadence?: 'monthly' | 'quarterly' | 'annual';
  intervalCount?: number;
  startDate?: string;
  anchorDay?: number;
  count?: number;
  status: 'scheduled';
}

/** A `PaymentPlan` create input emitted by `materializePlan`. */
export interface PaymentPlanInput {
  projectId: string;
  clientId: string;
  name: string;
  totalAmount: number;
  currency: string;
  status: 'draft';
  ownershipTransfersAtFullPayment: boolean;
  minimumPaymentsOwed: number;
  minimumAmountOwed: number;
  licenseEndsOnDefault: boolean;
  /** Stamped from the installment series `count` — the webhook's completion source (NIT-4). */
  installmentCount: number;
}

/** A `MaintenancePlan` create input emitted by `materializePlan` (NOT in totalAmount). */
export interface MaintenancePlanInput {
  projectId: string;
  clientId: string;
  cadence: 'monthly';
  amount: number;
  startedAt: string;
}

/** The pure result of materializing a template. */
export interface MaterializedPlan {
  plan: PaymentPlanInput;
  items: PaymentPlanItemInput[];
  maintenance?: MaintenancePlanInput;
}

/**
 * Pure: turn a template into the DB-create inputs. No network/DB. The two down
 * payments become dated `down_payment` rows; the installment series becomes a
 * single `installment` series-descriptor row at `sequence 0`; `installmentCount`
 * is stamped from the series `count`; maintenance (if present) is a separate
 * `MaintenancePlan` input and is NOT summed into `totalAmount`.
 */
export function materializePlan(
  template: PaymentPlanTemplate,
  { projectId, clientId }: MaterializeIds,
): MaterializedPlan {
  const plan: PaymentPlanInput = {
    projectId,
    clientId,
    name: template.name,
    totalAmount: template.totalAmount,
    currency: template.currency,
    status: 'draft',
    ownershipTransfersAtFullPayment: template.ownershipTransfersAtFullPayment,
    minimumPaymentsOwed: template.minimumPaymentsOwed,
    minimumAmountOwed: template.minimumAmountOwed,
    licenseEndsOnDefault: template.licenseEndsOnDefault,
    // STAMP installmentCount from the series count (NIT-4) — the webhook reads
    // only this plan-level field for completion.
    installmentCount: template.installments.count,
  };

  const items: PaymentPlanItemInput[] = [];

  // Dated down-payment rows, in order (sequence 1..N).
  template.downPayments.forEach((dp, i) => {
    items.push({
      kind: 'down_payment',
      sequence: i + 1,
      label: dp.label,
      amount: dp.amount,
      dueDate: dp.dueDate,
      status: 'scheduled',
    });
  });

  // One installment SERIES-DESCRIPTOR row at sequence 0 carrying the cadence
  // descriptor (not one row per installment).
  const s = template.installments;
  items.push({
    kind: 'installment',
    sequence: 0,
    amount: s.amount,
    cadence: s.cadence,
    intervalCount: s.intervalCount,
    startDate: s.startDate,
    anchorDay: s.anchorDay,
    count: s.count,
    status: 'scheduled',
  });

  const result: MaterializedPlan = { plan, items };

  if (template.maintenance) {
    // Separate maintenance sub — NOT summed into totalAmount.
    result.maintenance = {
      projectId,
      clientId,
      cadence: template.maintenance.cadence,
      amount: template.maintenance.amount,
      startedAt: template.maintenance.startedAt,
    };
  }

  return result;
}

// === Paid-vs-owed math (pure; used by the admin + portal UI in FEAT-005) ===

/** A minimal paid-state view of a plan item, for the math helpers. */
export interface PaidItemLike {
  amount: number;
  status?: string | null;
}

/** Σ of amounts of items whose status is 'paid'. */
export function paid(items: PaidItemLike[]): number {
  return items.reduce(
    (sum, it) => (it.status === 'paid' ? sum + it.amount : sum),
    0,
  );
}

/** Remaining to own the app: totalAmount − paid. */
export function owedToOwn(totalAmount: number, paidAmount: number): number {
  return totalAmount - paidAmount;
}

/** Remaining of the minimum commitment: max(0, minimumAmountOwed − paid). */
export function minimumRemaining(
  minimumAmountOwed: number,
  paidAmount: number,
): number {
  return Math.max(0, minimumAmountOwed - paidAmount);
}

/** Whether the installment minimum is met: installmentsPaidCount >= minimumPaymentsOwed. */
export function minimumMet(
  installmentsPaidCount: number,
  minimumPaymentsOwed: number,
): boolean {
  return installmentsPaidCount >= minimumPaymentsOwed;
}
