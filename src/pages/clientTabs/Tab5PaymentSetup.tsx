/**
 * Tab 5 — Payment Setup (FEAT-006).
 *
 * The real, single flexible payment-setup flow (design §7). A `dealType` dial
 * only SEEDS editable form state; the one form below then lets the admin build
 * any combination — down payment(s), an installment series, a lease-to-own
 * series, a one-payment buyout, and an optional separate monthly maintenance —
 * none of which are mutually exclusive. On submit it persists ONE PaymentPlan
 * (status 'draft') + one PaymentPlanItem per concrete charge (dated down_payment
 * rows seq 1..N, a single installment series-descriptor at seq 0, an optional
 * buyout row, an optional lease series row at seq 0) and maintenance as a
 * SEPARATE MaintenancePlan (never summed into totalAmount).
 *
 * Stripe orchestration mirrors createPaymentPlanRecord (ProjectDetail.tsx:722):
 * down_payment -> /stripe/create-plan-invoice; installment series ->
 * /stripe/installment-schedule; buyout -> /stripe/create-checkout
 * (createOneOffPaymentLink, link stored on hostedInvoiceUrl); lease series ->
 * /stripe/create-subscription. Every Stripe create is idempotent — guarded on
 * the item/plan not already carrying its id. When billingConfigured() is false
 * the draft + items persist and all Stripe calls are skipped (inline note).
 *
 * The PaymentPlan requires a Project (projectId + clientId). By the time the
 * deal reaches this stage the Project was created at Agreement (Tab 4), so this
 * panel resolves it via listProjectsByClient; if none exists yet it surfaces an
 * inline note (complete the Agreement tab first) rather than provisioning one.
 *
 * Bottom action advances the client to the Project stage — it does NOT require
 * Stripe success (reconciliation is asynchronous via the out-of-repo webhook).
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS } from './stageOrder';
import {
  listProjectsByClient,
  listPaymentPlansByProject,
  listPaymentPlanItemsByPlan,
  listMaintenancePlansByProject,
  createPaymentPlan,
  createPaymentPlanItem,
  updatePaymentPlan,
  updatePaymentPlanItem,
  createMaintenancePlan,
} from '../../utils/api';
import {
  getPaymentPlanTemplate,
  materializePlan,
  buildBuyoutItem,
  buildLeaseItem,
} from '../../projects/templates/payment-plans';
import { stripe } from '../../billing/providers/stripe';
import { billingConfigured } from '../../billing/billing';
import {
  buildPlanTimeline,
  PaymentPlanTimeline,
  PaymentPlanSummary,
} from '../../projects/ui';

type DealType = 'installments' | 'lease_to_own' | 'buyout' | 'custom';

type DownPaymentDraft = { label: string; amount: string; dueDate: string };

const DEAL_TYPES: { value: DealType; label: string; hint: string }[] = [
  { value: 'installments', label: 'Installments', hint: 'Down payment(s) + an installment series' },
  { value: 'lease_to_own', label: 'Lease to own', hint: 'Monthly lease + purchase option' },
  { value: 'buyout', label: 'Buyout', hint: 'A single one-payment buyout' },
  { value: 'custom', label: 'Custom', hint: 'Start from an empty form' },
];

/** The mutable form state — every field is independently editable. */
interface FormState {
  name: string;
  currency: string;
  total: string;
  downPayments: DownPaymentDraft[];
  // Installment series.
  hasSeries: boolean;
  instAmount: string;
  instCadence: 'monthly' | 'quarterly' | 'annual';
  instInterval: string;
  instStart: string;
  instAnchor: string;
  instCount: string;
  // Minimum commitment.
  minPayments: string;
  minAmount: string;
  ownershipTransfers: boolean;
  licenseEndsOnDefault: boolean;
  // Maintenance (separate MaintenancePlan).
  hasMaintenance: boolean;
  maintAmount: string;
  maintStart: string;
  // Buyout.
  hasBuyout: boolean;
  buyoutAmount: string;
  buyoutDue: string;
  // Lease to own.
  hasLease: boolean;
  leaseMonthly: string;
  leaseTerm: string;
  leasePurchaseOption: string;
  leaseStart: string;
  leaseAnchor: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    currency: 'usd',
    total: '',
    downPayments: [],
    hasSeries: false,
    instAmount: '',
    instCadence: 'monthly',
    instInterval: '1',
    instStart: '',
    instAnchor: '1',
    instCount: '',
    minPayments: '0',
    minAmount: '0',
    ownershipTransfers: true,
    licenseEndsOnDefault: true,
    hasMaintenance: false,
    maintAmount: '',
    maintStart: '',
    hasBuyout: false,
    buyoutAmount: '',
    buyoutDue: '',
    hasLease: false,
    leaseMonthly: '',
    leaseTerm: '',
    leasePurchaseOption: '',
    leaseStart: '',
    leaseAnchor: '1',
  };
}

/**
 * Seed editable form state from the dial (design §7.1). The dial ONLY pre-fills
 * defaults — the admin edits freely afterward and may toggle any section on.
 */
function seedFromDial(dial: DealType): FormState {
  const base = emptyForm();
  if (dial === 'installments') {
    // Seed from the agency-build-50k template via the pure materializer.
    const template = getPaymentPlanTemplate('agency-build-50k');
    if (template) {
      const m = materializePlan(template, { projectId: '', clientId: '' });
      const descriptor = m.items.find((i) => i.kind === 'installment');
      return {
        ...base,
        name: template.name,
        currency: template.currency,
        total: String(template.totalAmount),
        downPayments: template.downPayments.map((dp) => ({
          label: dp.label,
          amount: String(dp.amount),
          dueDate: dp.dueDate,
        })),
        hasSeries: true,
        instAmount: String(descriptor?.amount ?? ''),
        instCadence: (descriptor?.cadence as any) ?? 'monthly',
        instInterval: String(descriptor?.intervalCount ?? 1),
        instStart: descriptor?.startDate ?? '',
        instAnchor: String(descriptor?.anchorDay ?? 1),
        instCount: String(descriptor?.count ?? ''),
        minPayments: String(template.minimumPaymentsOwed),
        minAmount: String(template.minimumAmountOwed),
        ownershipTransfers: template.ownershipTransfersAtFullPayment,
        licenseEndsOnDefault: template.licenseEndsOnDefault,
        hasMaintenance: !!template.maintenance,
        maintAmount: template.maintenance ? String(template.maintenance.amount) : '',
        maintStart: template.maintenance ? template.maintenance.startedAt : '',
      };
    }
  }
  if (dial === 'lease_to_own') {
    return {
      ...base,
      name: 'Lease to own',
      hasLease: true,
      leaseMonthly: '',
      leaseTerm: '',
      leasePurchaseOption: '',
    };
  }
  if (dial === 'buyout') {
    return {
      ...base,
      name: 'Buyout',
      hasBuyout: true,
    };
  }
  // custom — nothing pre-filled.
  return base;
}

/** anchorDay must be 1..28 to avoid 29–31 month-end drift (design §7.5). */
function validAnchor(v: string): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 28;
}

/** A positive, finite amount via Number() (rejects NaN/negative). */
function posAmount(v: string): number | null {
  const n = Number(v);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export default function Tab5PaymentSetup({ client, advanceStage }: PanelProps) {
  const connected = billingConfigured();

  // --- Resolve the client's Project (payment plans hang off a Project) ---
  const projectQuery = useQuery({
    queryKey: ['tab5-project', client?.id],
    queryFn: () => listProjectsByClient(client.id),
    enabled: !!client?.id,
  });
  const project = (projectQuery.data || [])[0] || null;

  // --- Existing payment plans + items + maintenance for tracking ---
  const plansQuery = useQuery({
    queryKey: ['tab5-plans', project?.id],
    queryFn: async () => {
      const plans = await listPaymentPlansByProject(project.id);
      const withItems = await Promise.all(
        (plans || []).map(async (p: any) => ({
          plan: p,
          items: await listPaymentPlanItemsByPlan(p.id),
        })),
      );
      const maintenance = await listMaintenancePlansByProject(project.id);
      return { withItems, maintenance: maintenance || [] };
    },
    enabled: !!project?.id,
  });

  const [dial, setDial] = useState<DealType>('installments');
  const [form, setForm] = useState<FormState>(() => seedFromDial('installments'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Picking a dial reseeds the form (defaults only — all still editable).
  function pickDial(next: DealType) {
    setDial(next);
    setForm(seedFromDial(next));
    setError(null);
  }

  const maintenancePlans = plansQuery.data?.maintenance || [];
  const firstMaintenance = maintenancePlans[0] || null;

  /**
   * Validate (design §7.5) and assemble the plan + items + maintenance, then
   * persist and run the Stripe orchestration. No mutation happens on a
   * validation failure.
   */
  async function submit() {
    setError(null);
    if (!project?.id) {
      setError('No project yet — complete the Agreement tab first to create the deal’s project.');
      return;
    }

    // totalAmount > 0.
    const totalNum = Number(form.total);
    if (!form.name.trim()) {
      setError('Enter a plan name.');
      return;
    }
    if (!form.total.trim() || Number.isNaN(totalNum) || totalNum <= 0) {
      setError('Enter a valid total amount greater than 0.');
      return;
    }

    // Down payments: positive amount + a due date each.
    const dpRows = form.downPayments.filter((d) => d.amount.trim() || d.dueDate.trim());
    for (const d of dpRows) {
      if (posAmount(d.amount) === null || !d.dueDate.trim()) {
        setError('Each down payment needs a positive amount and a due date.');
        return;
      }
    }

    // Installment series: count >= 1 and installmentCount stamped (NIT-4).
    let installmentCount = 0;
    let seriesItem: Record<string, any> | null = null;
    if (form.hasSeries) {
      const amt = posAmount(form.instAmount);
      const cnt = Number(form.instCount);
      if (amt === null) {
        setError('Enter a valid installment amount.');
        return;
      }
      if (Number.isNaN(cnt) || cnt < 1) {
        setError('An installment series must have a count of at least 1.');
        return;
      }
      if (!form.instStart.trim()) {
        setError('Enter the installment series start date.');
        return;
      }
      if (!validAnchor(form.instAnchor)) {
        setError('Installment anchor day must be between 1 and 28.');
        return;
      }
      const interval = Number(form.instInterval);
      installmentCount = cnt;
      seriesItem = {
        kind: 'installment',
        sequence: 0,
        amount: amt,
        cadence: form.instCadence,
        intervalCount: Number.isNaN(interval) || interval < 1 ? 1 : interval,
        startDate: form.instStart,
        anchorDay: Number(form.instAnchor),
        count: cnt,
      };
    }

    // Buyout: a positive amount (due date optional).
    let buyoutItem: Record<string, any> | null = null;
    let buyoutAmountNum: number | null = null;
    if (form.hasBuyout) {
      const amt = posAmount(form.buyoutAmount);
      if (amt === null) {
        setError('Enter a valid buyout amount.');
        return;
      }
      buyoutAmountNum = amt;
      buyoutItem = buildBuyoutItem(
        { amount: amt, dueDate: form.buyoutDue.trim() || undefined },
        // Slot the buyout after the dated down payments.
        dpRows.length + 1,
      );
    }

    // Lease to own: positive monthly + a term >= 1.
    let leaseItem: Record<string, any> | null = null;
    let leaseMonthlyNum: number | null = null;
    let leaseTermNum: number | null = null;
    let leasePurchaseNum: number | null = null;
    if (form.hasLease) {
      const monthly = posAmount(form.leaseMonthly);
      const term = Number(form.leaseTerm);
      if (monthly === null) {
        setError('Enter a valid monthly lease amount.');
        return;
      }
      if (Number.isNaN(term) || term < 1) {
        setError('Lease term (months) must be at least 1.');
        return;
      }
      if (form.leaseStart.trim() && !validAnchor(form.leaseAnchor)) {
        setError('Lease anchor day must be between 1 and 28.');
        return;
      }
      if (form.leasePurchaseOption.trim()) {
        const po = Number(form.leasePurchaseOption);
        if (Number.isNaN(po) || po < 0) {
          setError('Purchase-option amount must be zero or more.');
          return;
        }
        leasePurchaseNum = po;
      }
      leaseMonthlyNum = monthly;
      leaseTermNum = term;
      leaseItem = buildLeaseItem({
        monthlyAmount: monthly,
        termMonths: term,
        purchaseOptionAmount: leasePurchaseNum ?? undefined,
        startDate: form.leaseStart.trim() || undefined,
        anchorDay: form.leaseStart.trim() ? Number(form.leaseAnchor) : undefined,
      });
    }

    // Maintenance: separate MaintenancePlan (never summed into total).
    let maintenance: Record<string, any> | undefined;
    if (form.hasMaintenance) {
      const amt = posAmount(form.maintAmount);
      if (amt === null || !form.maintStart.trim()) {
        setError('Maintenance needs a positive amount and a start date.');
        return;
      }
      maintenance = { cadence: 'monthly', amount: amt, startedAt: form.maintStart };
    }

    // Assemble item rows: dated down payments (seq 1..N), the installment
    // series descriptor (seq 0), the optional buyout, the optional lease series.
    const items: Array<Record<string, any>> = [];
    dpRows.forEach((d, i) => {
      items.push({
        kind: 'down_payment',
        sequence: i + 1,
        label: d.label || `Down payment ${i + 1}`,
        amount: Number(d.amount),
        dueDate: d.dueDate,
      });
    });
    if (seriesItem) items.push(seriesItem);
    if (buyoutItem) items.push(buyoutItem);
    if (leaseItem) items.push(leaseItem);

    if (items.length === 0 && !maintenance) {
      setError('Add at least one charge (down payment, installments, buyout, or lease).');
      return;
    }

    const plan: Record<string, any> = {
      name: form.name.trim(),
      totalAmount: totalNum,
      currency: form.currency.trim() || 'usd',
      dealType: dial,
      ownershipTransfersAtFullPayment: form.ownershipTransfers,
      minimumPaymentsOwed: Number(form.minPayments) || 0,
      minimumAmountOwed: Number(form.minAmount) || 0,
      licenseEndsOnDefault: form.licenseEndsOnDefault,
      // STAMP installmentCount from the series count (NIT-4).
      installmentCount,
      ...(buyoutAmountNum != null ? { buyoutAmount: buyoutAmountNum } : {}),
      ...(leaseMonthlyNum != null ? { leaseMonthlyAmount: leaseMonthlyNum } : {}),
      ...(leaseTermNum != null ? { leaseTermMonths: leaseTermNum } : {}),
      ...(leasePurchaseNum != null ? { purchaseOptionAmount: leasePurchaseNum } : {}),
    };

    setBusy(true);
    try {
      await persistAndProvision({ plan, items, maintenance });
      // Reseed a fresh form for the current dial.
      setForm(seedFromDial(dial));
      await plansQuery.refetch();
    } catch (err: any) {
      console.error('Tab5 payment-setup submit failed:', err);
      setError('Could not create the payment plan: ' + (err?.message || 'Unknown error'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Persist the plan + items + maintenance, then (when billing is connected)
   * provision Stripe idempotently. Mirrors createPaymentPlanRecord
   * (ProjectDetail.tsx:722) and ADDS the buyout + lease branches.
   */
  async function persistAndProvision(input: {
    plan: Record<string, any>;
    items: Array<Record<string, any>>;
    maintenance?: Record<string, any>;
  }) {
    if (!project?.id) return;

    // (1) Persist the plan (draft) then each item row.
    const created = await createPaymentPlan({
      ...input.plan,
      projectId: project.id,
      clientId: client.id,
      status: 'draft',
    });
    const planId = created?.id;
    if (!planId) throw new Error('The payment plan did not persist.');

    const createdItems: any[] = [];
    for (const it of input.items) {
      const row = await createPaymentPlanItem({ ...it, planId, status: 'scheduled' });
      if (row) createdItems.push(row);
    }

    // (optional) separate maintenance sub (NOT in totalAmount).
    if (input.maintenance) {
      await createMaintenancePlan({
        projectId: project.id,
        clientId: client.id,
        status: 'paused',
        cadence: input.maintenance.cadence || 'monthly',
        amount: Number(input.maintenance.amount),
        startedAt: input.maintenance.startedAt,
      });
    }

    if (!connected) {
      // Billing not connected: keep the draft + items, skip Stripe entirely.
      return;
    }

    // (2) Down payments -> hosted invoice (idempotent on stripeInvoiceId).
    for (const it of createdItems) {
      if (it.kind !== 'down_payment') continue;
      if (it.stripeInvoiceId) continue; // already provisioned — do not duplicate
      const res = await stripe.createPlanInvoice({
        planId,
        planItemId: it.id,
        amount: Number(it.amount),
        currency: created.currency,
        dueDate: it.dueDate,
        clientEmail: client?.email || '',
        description: `${created.name} — ${it.label || 'down payment'}`,
      });
      if (res.configured && res.invoiceId) {
        await updatePaymentPlanItem({
          id: it.id,
          stripeInvoiceId: res.invoiceId,
          hostedInvoiceUrl: res.hostedInvoiceUrl,
          status: 'invoiced',
        });
      }
    }

    // (3) Installment series descriptor -> subscription schedule (idempotent
    // on the plan's stripeScheduleId).
    const descriptor = createdItems.find(
      (it) => it.kind === 'installment' && (it.sequence || 0) === 0,
    );
    let scheduleId: string | undefined;
    if (descriptor && !created.stripeScheduleId) {
      const res = await stripe.createSubscriptionSchedule({
        planId,
        amount: Number(descriptor.amount),
        currency: created.currency,
        count: Number(descriptor.count || created.installmentCount || 0),
        startDate: descriptor.startDate,
        clientEmail: client?.email || '',
      });
      if (res.configured && res.scheduleId) scheduleId = res.scheduleId;
    }

    // (4) Buyout -> one-off payment link (idempotent on hostedInvoiceUrl being
    // absent). Store the returned payment-link URL in the item's
    // hostedInvoiceUrl so the tracking timeline can surface it.
    for (const it of createdItems) {
      if (it.kind !== 'buyout') continue;
      if (it.hostedInvoiceUrl) continue; // already provisioned — do not duplicate
      const res = await stripe.createOneOffPaymentLink({
        invoice: it.id,
        amount: Number(it.amount),
        clientEmail: client?.email || '',
        description: `${created.name} — ${it.label || 'buyout'}`,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
      });
      if (res.configured && res.paymentLink) {
        await updatePaymentPlanItem({ id: it.id, hostedInvoiceUrl: res.paymentLink });
      }
    }

    // (5) Lease series -> subscription (idempotent on stripeSubscriptionId
    // being absent). TODO(stripe-lease-term): the lease term-cap and the
    // end-of-term purchase-option charge are NOT backend-automated (no route) —
    // the admin manages term-end via the Stripe dashboard; here we only wire
    // the recurring subscription in test mode.
    let leaseSubscriptionId: string | undefined;
    const leaseRow = createdItems.find((it) => it.kind === 'lease');
    if (leaseRow && !created.stripeSubscriptionId) {
      const res = await stripe.createSubscription({
        plan: planId,
        amount: Number(leaseRow.amount),
        cadence: 'monthly',
        clientEmail: client?.email,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
      });
      if (res.configured) {
        if (res.subscriptionId) leaseSubscriptionId = res.subscriptionId;
        if (res.checkoutUrl) {
          // Surface the hosted Checkout so the owner can confirm the method.
          window.open(res.checkoutUrl, '_blank', 'noopener');
        }
      }
    }

    // Flip the plan to active and stamp any returned Stripe ids.
    await updatePaymentPlan({
      id: planId,
      status: 'active',
      ...(scheduleId ? { stripeScheduleId: scheduleId } : {}),
      ...(leaseSubscriptionId ? { stripeSubscriptionId: leaseSubscriptionId } : {}),
    });
  }

  async function handleAdvance() {
    setAdvancing(true);
    try {
      // Advancing does NOT require Stripe success — the deal proceeds.
      await advanceStage('project');
    } finally {
      setAdvancing(false);
    }
  }

  const existingPlans = plansQuery.data?.withItems || [];

  const dialHint = useMemo(
    () => DEAL_TYPES.find((d) => d.value === dial)?.hint || '',
    [dial],
  );

  return (
    <div className="space-y-6">
      {/* Project resolution state */}
      {projectQuery.isLoading ? (
        <div className="card">
          <p className="text-sm text-ace-muted">Loading the deal’s project…</p>
        </div>
      ) : !project ? (
        <div className="card">
          <h2 className="text-lg font-semibold mb-1">Payment Setup</h2>
          <p className="text-sm text-ace-muted">
            No project exists for this client yet. Complete the Agreement tab to
            create the deal’s project, then set up payment here.
          </p>
        </div>
      ) : (
        <>
          {/* Existing payment tracking */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Payment Tracking</h2>
            {plansQuery.isLoading ? (
              <p className="text-sm text-ace-muted">Loading payment plans…</p>
            ) : existingPlans.length === 0 ? (
              <p className="text-sm text-ace-muted">
                No payment plan yet. Create one below.
              </p>
            ) : (
              <div className="space-y-4">
                {existingPlans.map(({ plan, items }) => {
                  const rows = buildPlanTimeline(
                    items,
                    firstMaintenance
                      ? {
                          amount: firstMaintenance.amount,
                          startedAt: firstMaintenance.startedAt,
                          status: firstMaintenance.status,
                        }
                      : null,
                  );
                  return (
                    <div
                      key={plan.id}
                      className="bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{plan.name}</div>
                          <div className="text-xs text-ace-muted">
                            {plan.dealType || 'custom'} · {plan.status}
                          </div>
                        </div>
                        <span className="badge bg-white/5 text-ace-muted">{plan.status}</span>
                      </div>
                      {plan.status === 'draft' && !plan.stripeScheduleId && (
                        <div className="text-xs text-yellow-400">
                          Draft — Stripe not provisioned (billing not connected).
                        </div>
                      )}
                      <PaymentPlanSummary plan={plan} rows={rows} />
                      <PaymentPlanTimeline rows={rows} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* The single flexible setup form */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-1">New Payment Plan</h2>
            <p className="text-xs text-ace-muted mb-3">
              Pick a starting point — every field below stays editable, and
              nothing is mutually exclusive. {dialHint}
            </p>

            {!connected && (
              <div className="text-xs text-yellow-400 mb-3">
                Billing not connected — the plan + items save as a draft and
                Stripe calls are skipped.
              </div>
            )}

            {/* The dial */}
            <div className="flex flex-wrap gap-2 mb-4">
              {DEAL_TYPES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => pickDial(d.value)}
                  disabled={busy}
                  className={`text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
                    dial === d.value
                      ? 'bg-ace-purple/20 text-ace-purple border-ace-purple/30'
                      : 'bg-white/5 text-white border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Plan basics */}
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                className="input text-xs py-1"
                placeholder="Plan name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <input
                className="input text-xs py-1"
                placeholder="Total to own (e.g. 50000)"
                value={form.total}
                onChange={(e) => set('total', e.target.value)}
              />
              <input
                className="input text-xs py-1"
                placeholder="Currency (usd)"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
              />
            </div>

            {/* Down payments */}
            <div className="space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3 mt-3">
              <div className="text-xs text-ace-muted">Down payments</div>
              {form.downPayments.map((d, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <input
                    className="input text-xs py-1 flex-1 min-w-[120px]"
                    placeholder="Label"
                    value={d.label}
                    onChange={(e) =>
                      set(
                        'downPayments',
                        form.downPayments.map((r, j) =>
                          j === i ? { ...r, label: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <input
                    className="input text-xs py-1 w-24"
                    placeholder="Amount"
                    value={d.amount}
                    onChange={(e) =>
                      set(
                        'downPayments',
                        form.downPayments.map((r, j) =>
                          j === i ? { ...r, amount: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <input
                    type="date"
                    className="input text-xs py-1 w-36"
                    value={d.dueDate}
                    onChange={(e) =>
                      set(
                        'downPayments',
                        form.downPayments.map((r, j) =>
                          j === i ? { ...r, dueDate: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set('downPayments', form.downPayments.filter((_, j) => j !== i))
                    }
                    className="text-ace-muted hover:text-red-400"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  set('downPayments', [
                    ...form.downPayments,
                    { label: `Down payment ${form.downPayments.length + 1}`, amount: '', dueDate: '' },
                  ])
                }
                className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] flex items-center gap-1"
              >
                <Plus size={12} /> Add down payment
              </button>
            </div>

            {/* Installment series */}
            <div className="space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3 mt-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasSeries}
                  onChange={(e) => set('hasSeries', e.target.checked)}
                />
                Installment series
              </label>
              {form.hasSeries && (
                <div className="grid sm:grid-cols-3 gap-2">
                  <input
                    className="input text-xs py-1"
                    placeholder="Amount (e.g. 1250)"
                    value={form.instAmount}
                    onChange={(e) => set('instAmount', e.target.value)}
                  />
                  <select
                    className="input text-xs py-1"
                    value={form.instCadence}
                    onChange={(e) =>
                      set('instCadence', e.target.value as 'monthly' | 'quarterly' | 'annual')
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                  <input
                    className="input text-xs py-1"
                    placeholder="Interval (1)"
                    value={form.instInterval}
                    onChange={(e) => set('instInterval', e.target.value)}
                  />
                  <input
                    type="date"
                    className="input text-xs py-1"
                    value={form.instStart}
                    onChange={(e) => set('instStart', e.target.value)}
                  />
                  <input
                    className="input text-xs py-1"
                    placeholder="Anchor day (1-28)"
                    value={form.instAnchor}
                    onChange={(e) => set('instAnchor', e.target.value)}
                  />
                  <input
                    className="input text-xs py-1"
                    placeholder="Count (e.g. 36)"
                    value={form.instCount}
                    onChange={(e) => set('instCount', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Buyout */}
            <div className="space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3 mt-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasBuyout}
                  onChange={(e) => set('hasBuyout', e.target.checked)}
                />
                One-payment buyout
              </label>
              {form.hasBuyout && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className="input text-xs py-1"
                    placeholder="Buyout amount"
                    value={form.buyoutAmount}
                    onChange={(e) => set('buyoutAmount', e.target.value)}
                  />
                  <input
                    type="date"
                    className="input text-xs py-1"
                    value={form.buyoutDue}
                    onChange={(e) => set('buyoutDue', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Lease to own */}
            <div className="space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3 mt-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasLease}
                  onChange={(e) => set('hasLease', e.target.checked)}
                />
                Lease to own
              </label>
              {form.hasLease && (
                <>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <input
                      className="input text-xs py-1"
                      placeholder="Monthly lease amount"
                      value={form.leaseMonthly}
                      onChange={(e) => set('leaseMonthly', e.target.value)}
                    />
                    <input
                      className="input text-xs py-1"
                      placeholder="Term (months)"
                      value={form.leaseTerm}
                      onChange={(e) => set('leaseTerm', e.target.value)}
                    />
                    <input
                      className="input text-xs py-1"
                      placeholder="Purchase option amount"
                      value={form.leasePurchaseOption}
                      onChange={(e) => set('leasePurchaseOption', e.target.value)}
                    />
                    <input
                      type="date"
                      className="input text-xs py-1"
                      value={form.leaseStart}
                      onChange={(e) => set('leaseStart', e.target.value)}
                    />
                    <input
                      className="input text-xs py-1"
                      placeholder="Anchor day (1-28)"
                      value={form.leaseAnchor}
                      onChange={(e) => set('leaseAnchor', e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-ace-muted italic">
                    The recurring lease is wired as a Stripe subscription in test
                    mode. Term-end stop and the purchase-option charge are managed
                    manually via the Stripe dashboard (TODO(stripe-lease-term)).
                  </p>
                </>
              )}
            </div>

            {/* Maintenance (separate) */}
            <div className="space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3 mt-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasMaintenance}
                  onChange={(e) => set('hasMaintenance', e.target.checked)}
                />
                Monthly maintenance (separate — not in the total)
              </label>
              {form.hasMaintenance && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className="input text-xs py-1"
                    placeholder="Maintenance amount"
                    value={form.maintAmount}
                    onChange={(e) => set('maintAmount', e.target.value)}
                  />
                  <input
                    type="date"
                    className="input text-xs py-1"
                    value={form.maintStart}
                    onChange={(e) => set('maintStart', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Minimum commitment */}
            <div className="grid sm:grid-cols-2 gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3 mt-3">
              <input
                className="input text-xs py-1"
                placeholder="Minimum payments owed"
                value={form.minPayments}
                onChange={(e) => set('minPayments', e.target.value)}
              />
              <input
                className="input text-xs py-1"
                placeholder="Minimum amount owed"
                value={form.minAmount}
                onChange={(e) => set('minAmount', e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ownershipTransfers}
                  onChange={(e) => set('ownershipTransfers', e.target.checked)}
                />
                Ownership transfers at full payment
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.licenseEndsOnDefault}
                  onChange={(e) => set('licenseEndsOnDefault', e.target.checked)}
                />
                License ends on default
              </label>
            </div>

            {error && <p className="text-xs text-red-300 mt-3">{error}</p>}

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={14} />
                {busy ? 'Saving…' : 'Create payment plan'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom action — advance does NOT require Stripe success */}
      <div className="flex justify-end">
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {advancing ? 'Advancing…' : `Advance to ${STAGE_LABELS.project}`}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
