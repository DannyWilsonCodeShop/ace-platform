/**
 * The Agency build-and-buy plan — the FIRST payment-plan template instance.
 *
 * Values are VERBATIM from the authoritative offer
 * (Green-Casting/src/app/offer/page.tsx): $50,000 fixed price; $5,000 down in
 * two $2,500 parts (Oct 21, 2026 and Nov 4, 2026); the remaining $45,000 at
 * $1,250 on the 1st of each month from Dec 1, 2026 (36 payments to own, 12
 * minimum); IP transfers only at full payment; $500/month maintenance from
 * Dec 30, 2026, kept separate from the price.
 */

import type { PaymentPlanTemplate } from './payment-plan-types';

export const agencyBuild50k: PaymentPlanTemplate = {
  key: 'agency-build-50k',
  name: 'The Agency — Build & Buy ($50k)',
  currency: 'usd',
  totalAmount: 50000,
  ownershipTransfersAtFullPayment: true,
  // minimumAmountOwed = 20000 = 5000 down + 12 × 1250.
  // The offer's $15,000 figure is monthly-only (12 × 1250); do NOT "fix" this to 15000.
  minimumPaymentsOwed: 12,
  minimumAmountOwed: 20000,
  licenseEndsOnDefault: true,
  downPayments: [
    { label: 'Down payment 1 of 2', amount: 2500, dueDate: '2026-10-21' },
    { label: 'Down payment 2 of 2', amount: 2500, dueDate: '2026-11-04' },
  ],
  installments: {
    amount: 1250,
    cadence: 'monthly',
    intervalCount: 1,
    startDate: '2026-12-01',
    anchorDay: 1,
    count: 36,
  },
  maintenance: {
    amount: 500,
    cadence: 'monthly',
    startedAt: '2026-12-30',
  },
};
