/**
 * Launch-handoff two-moment rule — pure state derivation (design §5; FR4.2).
 *
 * The hand-off to a client happens at TWO moments, never automated:
 *   1. Billing / hosting moment — unlocked at project LAUNCH.
 *   2. Code / ownership + account moment (incl.
 *      organizations:RemoveAccountFromOrganization) — unlocked at FULL PAYMENT
 *      (PaymentPlan completion).
 *
 * This helper only READS two triggers and reports which moment(s) are unlocked.
 * It executes nothing — the checklist steps are inert, manual, and performed by
 * Dan. No AWS/DNS/Stripe/SES call is reachable from here.
 */

/**
 * Whether the project has launched (the billing/hosting trigger). A string is
 * accepted so a caller can pass a Project.status directly; any of the launched
 * statuses count as launched.
 */
export type LaunchStatus = 'not_launched' | 'launched' | (string & {});

/**
 * Payment-plan completion trigger. Mirrors the PaymentPlan.status enum
 * (`draft | active | completed | defaulted | cancelled`); only `completed`
 * unlocks the ownership moment. A caller may also pass a plain boolean-ish
 * `paid`/`unpaid`.
 */
export type PaymentPlanStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'defaulted'
  | 'cancelled'
  | 'paid'
  | 'unpaid'
  | (string & {});

/** The two hand-off moments. */
export type HandoffMoment = 'billing_hosting' | 'code_ownership_account';

export interface HandoffState {
  /** True once the project has launched — the billing/hosting moment is unlocked. */
  billingHostingUnlocked: boolean;
  /** True once the payment plan is complete — the code/ownership + account moment is unlocked. */
  codeOwnershipUnlocked: boolean;
  /** The unlocked moments, in order. Empty when neither trigger has fired. */
  unlockedMoments: HandoffMoment[];
}

/**
 * Project statuses that mean the app is live for the client — the billing /
 * hosting hand-off moment is reachable from any of these.
 */
const LAUNCHED_STATUSES = new Set<string>([
  'launched',
  'active',
  'in_review',
  'maintenance',
  'completed',
  'closed',
]);

/** Payment-plan statuses that mean the balance is fully paid. */
const PAID_STATUSES = new Set<string>(['completed', 'paid']);

export function isLaunched(launchStatus: LaunchStatus | null | undefined): boolean {
  if (typeof launchStatus !== 'string') return false;
  return LAUNCHED_STATUSES.has(launchStatus);
}

export function isFullyPaid(paymentPlanStatus: PaymentPlanStatus | null | undefined): boolean {
  if (typeof paymentPlanStatus !== 'string') return false;
  return PAID_STATUSES.has(paymentPlanStatus);
}

/**
 * Derive which hand-off moment(s) are unlocked (design §5). Pure: reads the two
 * triggers only. The ownership moment can only be reached once the balance is
 * fully paid, independent of launch — but in practice launch precedes full
 * payment, so the common ordering is billing/hosting first.
 */
export function handoffState(
  launchStatus: LaunchStatus | null | undefined,
  paymentPlanStatus: PaymentPlanStatus | null | undefined,
): HandoffState {
  const billingHostingUnlocked = isLaunched(launchStatus);
  const codeOwnershipUnlocked = isFullyPaid(paymentPlanStatus);

  const unlockedMoments: HandoffMoment[] = [];
  if (billingHostingUnlocked) unlockedMoments.push('billing_hosting');
  if (codeOwnershipUnlocked) unlockedMoments.push('code_ownership_account');

  return {
    billingHostingUnlocked,
    codeOwnershipUnlocked,
    unlockedMoments,
  };
}
