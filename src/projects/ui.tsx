/**
 * Shared project-dashboard UI primitives, ported (not copied) from the
 * Green-Casting dashboard panels: a progress bar, a track-status badge, a 0-5
 * star rating, a dev-status pill, and a voice/text ProjectNote composer.
 *
 * These are reused by the admin ProjectDetail page and the customer MyProject
 * page so the two surfaces share one look without duplicating logic. The admin
 * composer and the customer composer differ only in whether a save fires the
 * SES notification — that is passed in via the `onCreated` callback.
 */

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send } from 'lucide-react';
import { addMonths, format, parseISO } from 'date-fns';
import { createTextNote, createVoiceNote, voiceUrl } from './notes';
import { demoImageUrl } from './demos';
import { paid, owedToOwn, minimumRemaining } from './templates/payment-plans';

const DEV_STATUSES = [
  { v: 'NOT_STARTED', label: 'Not started' },
  { v: 'IN_PROGRESS', label: 'In progress' },
  { v: 'READY_FOR_REVIEW', label: 'Ready for review' },
  { v: 'AWAITING_FEEDBACK', label: 'Awaiting feedback' },
  { v: 'COMPLETE', label: 'Complete' },
] as const;

export const DEV_STATUS_OPTIONS = DEV_STATUSES;

const DEV_STATUS_TONE: Record<string, string> = {
  NOT_STARTED: 'bg-white/5 text-ace-muted',
  IN_PROGRESS: 'bg-yellow-500/15 text-yellow-400',
  READY_FOR_REVIEW: 'bg-ace-cyan/15 text-ace-cyan',
  AWAITING_FEEDBACK: 'bg-ace-purple/15 text-ace-purple',
  COMPLETE: 'bg-green-500/15 text-green-400',
};

export function devStatusLabel(v?: string | null): string {
  return DEV_STATUSES.find((s) => s.v === v)?.label || 'Not started';
}

export function DevStatusBadge({ value }: { value?: string | null }) {
  const v = value || 'NOT_STARTED';
  return (
    <span className={`badge ${DEV_STATUS_TONE[v] || DEV_STATUS_TONE.NOT_STARTED}`}>
      {devStatusLabel(v)}
    </span>
  );
}

const TRACK_TONE: Record<string, string> = {
  ontrack: 'bg-green-500/15 text-green-400',
  atrisk: 'bg-yellow-500/15 text-yellow-400',
  behind: 'bg-red-500/15 text-red-400',
};

export function TrackBadge({ tone, label }: { tone: string; label: string }) {
  return <span className={`badge ${TRACK_TONE[tone] || TRACK_TONE.ontrack}`}>{label}</span>;
}

/** A labeled progress bar (0-100). */
export function ProgressBar({
  label,
  value,
  accent = 'bg-ace-purple',
}: {
  label?: string;
  value: number;
  accent?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-ace-muted">{label}</span>
          <span className="font-semibold">{pct}%</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${accent} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * 0-5 star rating. When `editable` and `onChange` are provided the stars are
 * clickable (clicking the current value clears it back to 0). Used by the
 * customer dashboard to set ProjectPage.clientApproval.
 */
export function StarRating({
  value,
  editable = false,
  onChange,
}: {
  value: number;
  editable?: boolean;
  onChange?: (next: number) => void;
}) {
  const v = value || 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!editable}
          onClick={() => editable && onChange?.(v === n ? 0 : n)}
          className={`text-lg leading-none ${n <= v ? 'text-yellow-400' : 'text-white/20'} ${
            editable ? 'cursor-pointer hover:text-yellow-300' : 'cursor-default'
          }`}
          aria-label={v === n ? 'Clear rating' : `${n} of 5`}
          title={editable ? `${n} of 5` : undefined}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Render a stored demo / choice-board image via a short-lived signed S3 GET
 * URL (resolved from the imageKey — the image is NEVER inlined/base64'd).
 * Used by both the admin demos panel and the customer review UI.
 */
export function DemoImage({
  imageKey,
  alt,
  className,
}: {
  imageKey: string;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    demoImageUrl(imageKey).then((u) => {
      if (!active) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [imageKey]);
  if (failed) {
    return (
      <div className={`flex items-center justify-center text-xs text-ace-muted bg-white/5 ${className || ''}`}>
        Image unavailable
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`flex items-center justify-center text-xs text-ace-muted bg-white/5 ${className || ''}`}>
        Loading…
      </div>
    );
  }
  return <img src={url} alt={alt || 'Demo option'} className={className} onError={() => setFailed(true)} />;
}

/** Playback element for a stored voice note (resolves a signed URL). */
export function VoiceNotePlayer({ audioKey }: { audioKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    voiceUrl(audioKey).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [audioKey]);
  if (!url) return <div className="text-xs text-ace-muted">Loading audio…</div>;
  return <audio className="w-full mt-1" controls src={url} />;
}

type Flash = { msg: string; tone: 'ok' | 'err' } | null;

/**
 * Text + voice ProjectNote composer. On a successful save it calls `onCreated`
 * with the note kind and a short reference string. The caller decides what to
 * do next: the customer dashboard fires the SES notification; the admin view
 * just refreshes. Voice recording uses the browser MediaRecorder API and the
 * notes.ts helpers (which upload to project/{projectId}/notes/* then persist).
 */
export function NoteComposer({
  projectId,
  pageKey,
  onCreated,
}: {
  projectId: string;
  pageKey?: string;
  onCreated: (info: { kind: 'TEXT' | 'VOICE'; noteRef: string }) => void | Promise<void>;
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function showFlash(msg: string, tone: 'ok' | 'err') {
    setFlash({ msg, tone });
    window.setTimeout(() => setFlash(null), 3500);
  }

  async function postText() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { note } = await createTextNote(projectId, pageKey, text.trim());
      setText('');
      showFlash('Note sent ✓', 'ok');
      await onCreated({ kind: 'TEXT', noteRef: note?.id || 'note' });
    } catch (err) {
      console.error(err);
      showFlash('Could not send the note. Please try again.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size === 0) {
          showFlash('Nothing recorded — try again.', 'err');
          return;
        }
        setBusy(true);
        setFlash({ msg: 'Uploading voice note…', tone: 'ok' });
        try {
          const { note, audioKey } = await createVoiceNote(projectId, pageKey, blob);
          showFlash('Voice note sent ✓', 'ok');
          await onCreated({ kind: 'VOICE', noteRef: audioKey || note?.id || 'voice-note' });
        } catch (err) {
          console.error(err);
          showFlash('Voice note failed to send. Please try again.', 'err');
        } finally {
          setBusy(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      showFlash('Microphone access is needed to record.', 'err');
    }
  }

  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="space-y-2">
      {flash && (
        <div
          className={`text-xs px-3 py-2 rounded-lg ${
            flash.tone === 'ok'
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {flash.msg}
        </div>
      )}
      {recording && (
        <div className="text-xs text-red-400">● Recording… tap Stop &amp; send when done.</div>
      )}
      <textarea
        className="input min-h-[70px] resize-y"
        placeholder="Type a note…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={postText}
          disabled={busy || !text.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20 text-sm disabled:opacity-50"
        >
          <Send size={14} /> Send note
        </button>
        {!recording ? (
          <button
            onClick={startRec}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] text-sm disabled:opacity-50"
          >
            <Mic size={14} /> Record voice
          </button>
        ) : (
          <button
            onClick={stopRec}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 text-sm"
          >
            <Square size={14} /> Stop &amp; send
          </button>
        )}
      </div>
    </div>
  );
}

/* ===================================================================== *
 * Payment-plan shared render primitives (FEAT-005, design §C2/§C3).
 *
 * These are reused by the admin ProjectDetail panel and the read-only
 * customer MyProject "Your plan" section so both surfaces share one look.
 * The timeline expands the installment SERIES-DESCRIPTOR row (sequence 0,
 * kind 'installment') into dated per-installment rows for display; it does
 * NOT mutate any DB state. Dates render with date-fns.
 * ===================================================================== */

/** A PaymentPlanItem as it comes back from the API (loose). */
export type PlanItem = {
  id?: string;
  kind?: string | null;
  sequence?: number | null;
  label?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  cadence?: string | null;
  intervalCount?: number | null;
  startDate?: string | null;
  anchorDay?: number | null;
  count?: number | null;
  status?: string | null;
  stripeInvoiceId?: string | null;
  hostedInvoiceUrl?: string | null;
};

/** A single row in the rendered schedule timeline. */
export type PlanTimelineRow = {
  key: string;
  kind: 'down_payment' | 'installment' | 'maintenance';
  label: string;
  amount: number;
  date?: string | null;
  status: string;
  /** The source item, when a row maps 1:1 to a persisted PaymentPlanItem. */
  item?: PlanItem;
};

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Format a major-unit amount as currency (USD display). */
export function fmtAmount(amount?: number | null): string {
  return USD.format(Number(amount || 0));
}

/** Format an ISO/date string with date-fns; falls back to the raw string. */
export function fmtPlanDate(iso?: string | null): string {
  if (!iso) return 'Date TBD';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

const ITEM_STATUS_TONE: Record<string, string> = {
  scheduled: 'bg-white/5 text-ace-muted',
  invoiced: 'bg-ace-cyan/15 text-ace-cyan',
  paid: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  skipped: 'bg-yellow-500/15 text-yellow-400',
  cancelled: 'bg-white/5 text-ace-muted',
};

/** A status pill for a single schedule row. */
export function PlanStatusPill({ status }: { status?: string | null }) {
  const s = status || 'scheduled';
  return <span className={`badge ${ITEM_STATUS_TONE[s] || ITEM_STATUS_TONE.scheduled}`}>{s}</span>;
}

/** Advance an ISO date (YYYY-MM-DD) by n months for installment display. */
function addMonthsIso(iso: string, n: number): string {
  try {
    return format(addMonths(parseISO(iso), n), 'yyyy-MM-dd');
  } catch {
    return iso;
  }
}

/**
 * Pure: build the display timeline from the plan's items. The two dated
 * down-payment rows map 1:1; the installment SERIES-DESCRIPTOR row (sequence 0,
 * kind 'installment') is EXPANDED into `count` dated rows from `startDate`,
 * stepping by the cadence (monthly/quarterly/annual × intervalCount). Any
 * reconciled per-installment rows (sequence > 0) replace the materialized row
 * at that index so paid state shows. A maintenance line is appended when a
 * maintenance plan is present. No DB mutation.
 */
export function buildPlanTimeline(
  items: PlanItem[],
  maintenance?: { amount?: number | null; startedAt?: string | null; status?: string | null } | null,
): PlanTimelineRow[] {
  const rows: PlanTimelineRow[] = [];

  const downPayments = (items || [])
    .filter((it) => it.kind === 'down_payment')
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  for (const dp of downPayments) {
    rows.push({
      key: dp.id || `dp-${dp.sequence}`,
      kind: 'down_payment',
      label: dp.label || `Down payment ${dp.sequence}`,
      amount: Number(dp.amount || 0),
      date: dp.dueDate,
      status: dp.status || 'scheduled',
      item: dp,
    });
  }

  const descriptor = (items || []).find(
    (it) => it.kind === 'installment' && (it.sequence || 0) === 0,
  );
  // Reconciled per-installment rows (sequence >= 1), keyed by sequence.
  const reconciled = new Map<number, PlanItem>();
  (items || [])
    .filter((it) => it.kind === 'installment' && (it.sequence || 0) >= 1)
    .forEach((it) => reconciled.set(it.sequence || 0, it));

  if (descriptor) {
    const count = Number(descriptor.count || 0);
    const start = descriptor.startDate || '';
    const step =
      descriptor.cadence === 'annual'
        ? 12
        : descriptor.cadence === 'quarterly'
          ? 3
          : 1;
    const interval = Number(descriptor.intervalCount || 1) * step;
    for (let i = 0; i < count; i++) {
      const seq = i + 1;
      const recon = reconciled.get(seq);
      const date = start ? addMonthsIso(start, i * interval) : null;
      rows.push({
        key: recon?.id || `inst-${seq}`,
        kind: 'installment',
        label: `Installment ${seq} of ${count}`,
        amount: Number(recon?.amount ?? descriptor.amount ?? 0),
        date: recon?.dueDate || date,
        status: recon?.status || 'scheduled',
        item: recon || descriptor,
      });
    }
  }

  if (maintenance) {
    rows.push({
      key: 'maintenance',
      kind: 'maintenance',
      label: 'Maintenance (separate)',
      amount: Number(maintenance.amount || 0),
      date: maintenance.startedAt,
      status: maintenance.status || 'active',
    });
  }

  return rows;
}

/**
 * The schedule timeline table — down payments, each installment, and the
 * maintenance line, each with a date, amount, kind and a status pill. When
 * `onPayNow` is provided (customer surface), an unpaid down-payment row with a
 * stored hosted invoice URL renders a "Pay now" link.
 */
export function PaymentPlanTimeline({
  rows,
  onPayNow,
}: {
  rows: PlanTimelineRow[];
  onPayNow?: (row: PlanTimelineRow) => void | Promise<void>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ace-muted">No schedule rows yet.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const payable =
          onPayNow &&
          r.kind === 'down_payment' &&
          r.status !== 'paid' &&
          r.status !== 'cancelled' &&
          !!r.item?.hostedInvoiceUrl;
        return (
          <div
            key={r.key}
            className="bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.label}</div>
                <div className="text-xs text-ace-muted">
                  {fmtPlanDate(r.date)} · {r.kind.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-semibold">{fmtAmount(r.amount)}</span>
                <PlanStatusPill status={r.status} />
              </div>
            </div>
            {payable && (
              <div className="mt-2">
                <a
                  href={r.item!.hostedInvoiceUrl!}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onPayNow?.(r)}
                  className="inline-block text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20"
                >
                  Pay now
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Paid-vs-owed totals + the minimum-met and default badges for a payment plan.
 * Maintenance is excluded from these totals (it is shown on its own timeline
 * line). The paid amount is derived from the paid rows via the FEAT-004 math
 * helpers; `installmentsPaidCount`/`minimumPaymentsOwed`/`defaulted` come off
 * the plan row (the webhook is the source of truth for paid state).
 */
export function PaymentPlanSummary({ plan, rows }: { plan: any; rows: PlanTimelineRow[] }) {
  // Only down_payment + installment rows count toward the "to own" totals;
  // maintenance is excluded.
  const owedRows = rows.filter((r) => r.kind !== 'maintenance');
  const paidAmount = paid(owedRows.map((r) => ({ amount: r.amount, status: r.status })));
  const total = Number(plan?.totalAmount || 0);
  const owed = owedToOwn(total, paidAmount);
  const minOwed = Number(plan?.minimumAmountOwed || 0);
  const minRemaining = minimumRemaining(minOwed, paidAmount);

  const paidCount = Number(plan?.installmentsPaidCount || 0);
  const minPayments = Number(plan?.minimumPaymentsOwed || 0);
  const minMet = Boolean(plan?.minimumMet);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]">
          <div className="text-xs text-ace-muted">Paid</div>
          <div className="text-sm font-semibold text-green-400">{fmtAmount(paidAmount)}</div>
        </div>
        <div className="bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]">
          <div className="text-xs text-ace-muted">Owed to own</div>
          <div className="text-sm font-semibold">{fmtAmount(owed)}</div>
        </div>
        <div className="bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]">
          <div className="text-xs text-ace-muted">Total to own</div>
          <div className="text-sm font-semibold">{fmtAmount(total)}</div>
        </div>
      </div>

      <ProgressBar label="Toward full ownership" value={total > 0 ? (paidAmount / total) * 100 : 0} />

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`badge ${
            minMet ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
          }`}
        >
          {paidCount} / {minPayments} —{' '}
          {minMet ? 'minimum met' : 'minimum not yet met'}
        </span>
        {minRemaining > 0 && (
          <span className="text-xs text-ace-muted">
            {fmtAmount(minRemaining)} remaining of the minimum commitment
          </span>
        )}
        {plan?.defaulted && (
          <span className="badge bg-red-500/15 text-red-400">Defaulted</span>
        )}
      </div>
    </div>
  );
}
