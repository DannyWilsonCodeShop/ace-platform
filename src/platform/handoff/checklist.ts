/**
 * Launch-handoff checklist content (design §5). Pure data — the MANUAL steps
 * for each of the two hand-off moments. ACE executes NONE of these; they are
 * inert reminders Dan performs by hand.
 */

import type { HandoffMoment } from './handoffState';

export interface ChecklistStep {
  id: string;
  label: string;
  /**
   * True for the steps the design is explicit ACE must NEVER automate
   * (RemoveAccountFromOrganization, DNS, Stripe, SES cutover). Rendered with a
   * "manual only — never automated by ACE" marker.
   */
  neverAutomated?: boolean;
}

export interface ChecklistMoment {
  moment: HandoffMoment;
  title: string;
  /** When this moment unlocks (shown so Dan knows the trigger). */
  trigger: string;
  steps: ChecklistStep[];
}

/**
 * The two moments and their manual steps (design §5). Billing/hosting at launch;
 * code/ownership + account at full payment.
 */
export const HANDOFF_CHECKLIST: ChecklistMoment[] = [
  {
    moment: 'billing_hosting',
    title: 'Billing & hosting — at launch',
    trigger: 'Unlocks when the project launches.',
    steps: [
      { id: 'confirm-account-active', label: "Confirm the client's member account is active." },
      { id: 'confirm-app-runs', label: 'Confirm the client app runs in that account.' },
      { id: 'move-hosting-billing', label: "Move hosting billing to the client's payment method." },
      { id: 'record-launch-date', label: 'Record the launch date.' },
    ],
  },
  {
    moment: 'code_ownership_account',
    title: 'Code, ownership & account — at full payment',
    trigger: 'Unlocks when the payment plan is fully paid (PaymentPlan completed).',
    steps: [
      { id: 'transfer-code', label: 'Transfer repo / code ownership to the client.' },
      { id: 'dns-cutover', label: "DNS cutover to the client's domain.", neverAutomated: true },
      { id: 'stripe-cutover', label: 'Stripe account / keys cutover.', neverAutomated: true },
      { id: 'ses-cutover', label: 'SES identity cutover.', neverAutomated: true },
      {
        id: 'remove-account-from-org',
        label: 'organizations:RemoveAccountFromOrganization — release the account to the client.',
        neverAutomated: true,
      },
    ],
  },
];

/**
 * The explicit safety note required by the design (§5; AC9/FR4): ACE never
 * executes RemoveAccountFromOrganization, DNS, Stripe, or SES cutover.
 */
export const ACE_EXECUTES_NONE_NOTE =
  'ACE executes none of these steps. Every item is a manual action Dan performs by hand — ' +
  'ACE never runs organizations:RemoveAccountFromOrganization, DNS, Stripe, or SES cutover.';

/**
 * The per-account billing note for Dan (answers original message #11): AWS bills
 * per account, not per organization, so a member account is the unit that gives
 * a clean billing hand-off at launch.
 */
export const PER_ACCOUNT_BILLING_NOTE =
  'AWS bills per account, not per organization. The per-client member account is the unit that ' +
  'produces a separable bill, which is exactly what makes the billing hand-off clean at launch.';
