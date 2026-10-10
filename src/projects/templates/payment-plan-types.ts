/**
 * Payment-plan template types (design §C1).
 *
 * A `PaymentPlanTemplate` is the code-defined seed for a build-and-buy deal:
 * the fixed price, the dated down payments, the installment series, the
 * minimum-owed commitment, and an optional separate maintenance sub. New deal =
 * add a template file, not a code branch. These are pure config shapes — no
 * network/DB — consumed by the pure `materializePlan` helper.
 */

/** A single dated, one-off charge (e.g. a down payment). */
export interface DatedCharge {
  label: string;
  amount: number;
  /** ISO date string (YYYY-MM-DD). */
  dueDate: string;
}

/** The recurring installment series that pays down the remaining balance. */
export interface InstallmentSeries {
  amount: number;
  cadence: 'monthly' | 'quarterly' | 'annual';
  intervalCount: number;
  /** ISO date string (YYYY-MM-DD) of the first installment. */
  startDate: string;
  /** Day of the month installments land on. */
  anchorDay: number;
  /** Total number of installments to complete and own. */
  count: number;
}

/** A separate maintenance subscription — NEVER folded into the total price. */
export interface MaintenanceSpec {
  amount: number;
  cadence: 'monthly';
  /** ISO date string (YYYY-MM-DD) maintenance begins. */
  startedAt: string;
}

/** A code-defined payment-plan preset. */
export interface PaymentPlanTemplate {
  /** Stable template id — the registry key. */
  key: string;
  /** Human-friendly name. */
  name: string;
  /** ISO 4217 lowercase currency (e.g. 'usd'). */
  currency: string;
  /** Fixed total to own, in major units. Maintenance is NOT summed in. */
  totalAmount: number;
  /** Ownership of the app/code transfers only when the total is paid in full. */
  ownershipTransfersAtFullPayment: boolean;
  /** Minimum number of installments owed once monthly payments begin. */
  minimumPaymentsOwed: number;
  /** Minimum amount owed (down + minimum installments), in major units. */
  minimumAmountOwed: number;
  /** When defaulted, the license to run the app ends. */
  licenseEndsOnDefault: boolean;
  /** The dated down payments. */
  downPayments: DatedCharge[];
  /** The installment series. */
  installments: InstallmentSeries;
  /** Optional separate maintenance sub. */
  maintenance?: MaintenanceSpec;
}
