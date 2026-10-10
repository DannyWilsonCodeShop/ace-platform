/**
 * Fixed monthly-service checklist template (FEAT-007, Tab 8).
 *
 * A code-defined, non-configurable checklist that gives the owner a systematic
 * monthly flow for every client. Each item declares the variant(s) it applies
 * to; the two variants are:
 *   - with_maintenance    — clients on a monthly maintenance plan (hasMonthlyMaintenance)
 *   - without_maintenance — clients without one
 *
 * The template is intentionally fixed for now (the user asked for a fixed
 * checklist with standard options for maintenance vs non-maintenance clients).
 * Tab 8 persists completion per client per month in MonthlyChecklistState keyed
 * by the item `key`, so the stored keys survive a variant switch — only which
 * items are SHOWN changes with the variant, never what was recorded.
 */

export type ChecklistVariant = 'with_maintenance' | 'without_maintenance';

export interface ChecklistItem {
  /** Stable key persisted in MonthlyChecklistState.completedItemKeys. */
  key: string;
  /** Human-readable label shown in the Tab 8 checklist. */
  label: string;
  /** The variant(s) this item applies to. */
  variant: ChecklistVariant[];
}

const BOTH: ChecklistVariant[] = ['with_maintenance', 'without_maintenance'];
const MAINTENANCE_ONLY: ChecklistVariant[] = ['with_maintenance'];
const NON_MAINTENANCE_ONLY: ChecklistVariant[] = ['without_maintenance'];

/**
 * The fixed monthly checklist. Order here is the display order. Items common to
 * both variants come first, then the maintenance-only and the
 * non-maintenance-only follow-ups.
 */
export const MONTHLY_CHECKLIST: ChecklistItem[] = [
  { key: 'uptime_check', label: 'Verify app is live and uptime is healthy', variant: BOTH },
  { key: 'error_review', label: 'Review error/crash logs for the month', variant: BOTH },
  { key: 'check_in_message', label: 'Send client a monthly check-in message', variant: BOTH },
  { key: 'payment_status', label: 'Confirm payment/subscription status is current', variant: BOTH },
  { key: 'backup_verify', label: 'Confirm backups ran and are restorable', variant: BOTH },

  // Maintenance-plan clients get the active service work.
  { key: 'dependency_updates', label: 'Apply dependency and security updates', variant: MAINTENANCE_ONLY },
  { key: 'maintenance_hours', label: 'Log included maintenance hours used this month', variant: MAINTENANCE_ONLY },
  { key: 'feature_requests', label: 'Triage client feature requests / small changes', variant: MAINTENANCE_ONLY },
  { key: 'performance_tuning', label: 'Review performance metrics and tune as needed', variant: MAINTENANCE_ONLY },

  // Non-maintenance clients get the lighter upsell/retention touch instead.
  { key: 'maintenance_offer', label: 'Offer a maintenance plan / paid support option', variant: NON_MAINTENANCE_ONLY },
  { key: 'retention_touch', label: 'Log a retention touchpoint and next follow-up date', variant: NON_MAINTENANCE_ONLY },
];

/**
 * Return the checklist items that apply to a given variant, in display order.
 * Pure: never mutates MONTHLY_CHECKLIST.
 */
export function checklistForVariant(variant: ChecklistVariant): ChecklistItem[] {
  return MONTHLY_CHECKLIST.filter((item) => item.variant.includes(variant));
}

/** The ordered item keys for a variant (what MonthlyChecklistState persists against). */
export function checklistKeysForVariant(variant: ChecklistVariant): string[] {
  return checklistForVariant(variant).map((item) => item.key);
}

/** Map a client's hasMonthlyMaintenance flag to the checklist variant. */
export function variantForClient(hasMonthlyMaintenance: boolean | null | undefined): ChecklistVariant {
  return hasMonthlyMaintenance ? 'with_maintenance' : 'without_maintenance';
}
