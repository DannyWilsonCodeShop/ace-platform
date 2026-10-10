/**
 * Client-package templating (design §2.2) — the per-client STARTING DEFAULTS
 * that `createProjectForClient` seeds at quote->project promotion: a three-tier
 * CHOICE_BOARD, a draft Build & Buy contract pre-filled from the Mercedes/
 * Agency deal numbers, and three starter client to-dos.
 *
 * Everything here is a PURE builder — no network, unit-testable exactly like
 * buildProjectInput/buildProjectPageInput in promoteQuote.ts.
 *
 * AUTHORITATIVE option shape (NIT-3): choice-board options persist as
 *   { name, imageKey: string|null, tier: 'good'|'better'|'best', price: number|null }
 * (NO `slug` — slug is derived from `name` at read in the portal). This matches
 * what Tab3DemoBuild writes. The stale `Demo.options` doc-comment in
 * amplify/data/resource.ts still advertises the legacy
 * [{slug,name,imageKey,previewUrl}] shape and is left untouched (editing it
 * would dirty the AC4 schema-diff); this file is the source of truth.
 *
 * TERMS SHAPE (HIGH-1): defaultContractTerms() emits the FLAT shape that
 * Tab4Agreement's `Terms` interface reads/writes, and every scalar numeric
 * (plus each downPayments[].amount) is a STRING — Tab 4's fromTerms() spreads
 * the stored JSON raw and nonNeg()/persistContract() call `.trim()` on those
 * scalars unconditionally, so a number would throw `TypeError: …trim is not a
 * function`. Booleans stay booleans.
 *
 * No builder adds an `owner` key (TD-1) — `owner` is not a defined CreateXInput
 * field; customer reads are carried by the customer group-read grant.
 */

import { agencyBuild50k } from './agency-build-50k';

export type ChoiceBoardTier = 'good' | 'better' | 'best';

export interface ChoiceBoardOption {
  name: string;
  imageKey: string | null;
  tier: ChoiceBoardTier;
  price: number | null;
}

/**
 * Three tiered placeholder options for a brand-new choice board. Prices are
 * pinned to `null` (NIT-1): the template cannot know the client's tier pricing,
 * so the board renders "price TBD" per option until an admin sets real prices
 * in Tab 3 (before sharing it with the client).
 */
export function defaultChoiceBoardOptions(): ChoiceBoardOption[] {
  return [
    { name: 'Good', imageKey: null, tier: 'good', price: null },
    { name: 'Better', imageKey: null, tier: 'better', price: null },
    { name: 'Best', imageKey: null, tier: 'best', price: null },
  ];
}

export interface ContractDownPayment {
  label: string;
  amount: string;
  dueDate: string;
}

export interface ContractTerms {
  fixedPrice: string;
  downPayments: ContractDownPayment[];
  monthlyAmount: string;
  monthlyAnchorDay: string;
  monthlyCount: string;
  minimumAmount: string;
  maintenanceAmount: string;
  maintenanceStart: string;
  deliveryTarget: string;
  ipTransfersAtFullPayment: boolean;
  noRefund: boolean;
}

/**
 * The flat Build & Buy terms stored in Contract.terms, TRANSLATED (not copied)
 * from the nested agencyBuild50k template. Scalar numerics are emitted as
 * STRINGS (HIGH-1); `deliveryTarget` is left blank for the admin to fill;
 * `noRefund` is an explicit default (not present in the payment-plan template).
 */
export function defaultContractTerms(): ContractTerms {
  const maintenance = agencyBuild50k.maintenance;
  return {
    fixedPrice: String(agencyBuild50k.totalAmount),
    downPayments: agencyBuild50k.downPayments.map((d) => ({
      label: d.label,
      amount: String(d.amount),
      dueDate: d.dueDate,
    })),
    monthlyAmount: String(agencyBuild50k.installments.amount),
    monthlyAnchorDay: String(agencyBuild50k.installments.anchorDay),
    monthlyCount: String(agencyBuild50k.installments.count),
    minimumAmount: String(agencyBuild50k.minimumAmountOwed),
    maintenanceAmount: maintenance ? String(maintenance.amount) : '',
    maintenanceStart: maintenance ? maintenance.startedAt : '',
    deliveryTarget: '',
    ipTransfersAtFullPayment: agencyBuild50k.ownershipTransfersAtFullPayment,
    noRefund: true,
  };
}

export interface StarterActionItem {
  projectId: string;
  title: string;
  owner_role: 'client' | 'together' | 'dev';
  sortOrder: number;
}

/**
 * The fixed, client-owned launch to-dos Dan mirrors from Green Casting. Each
 * carries the required projectId + title and an `owner_role` in the schema
 * enum; `owner_role: 'client'` because the portal only lets the customer tick
 * items they own. No `pageKey` (portal to-dos render per project), no `owner`
 * key (TD-1).
 */
export function defaultStarterActionItems(projectId: string): StarterActionItem[] {
  return [
    { projectId, title: 'Choose your domain name', owner_role: 'client', sortOrder: 0 },
    { projectId, title: 'Send branding assets (logo, colors)', owner_role: 'client', sortOrder: 1 },
    { projectId, title: 'Review & sign the Build & Buy agreement', owner_role: 'client', sortOrder: 2 },
  ];
}
