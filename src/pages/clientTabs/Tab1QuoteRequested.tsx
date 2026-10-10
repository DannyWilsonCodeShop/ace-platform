/**
 * Tab 1 — Quote Requested (FEAT-005).
 *
 * The real panel for the first pipeline stage. It surfaces the incoming
 * request straight off the linked Quote (digital fields + AI recommendation),
 * lets the admin record the target platform when the quote didn't carry one,
 * and keeps a contact-attempt log (list newest-first + inline create with
 * validation). Everything degrades gracefully before the schema deploy: the
 * ContactAttempt query failing/returning empty renders an empty list and an
 * "available after deploy" note instead of crashing, and the create form is
 * disabled with the same note.
 *
 * Bottom action advances the client forward to the Demo Details stage.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ArrowRight, Brain, Phone, Plus } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS } from './stageOrder';
import {
  listContactAttemptsByClient,
  createContactAttempt,
  updateQuote,
} from '../../utils/api';

const METHODS = ['phone', 'email', 'sms', 'voicemail', 'meeting', 'other'] as const;
const OUTCOMES = [
  'no_answer',
  'left_message',
  'connected',
  'scheduled',
  'declined',
  'other',
] as const;

const METHOD_LABELS: Record<string, string> = {
  phone: 'Phone',
  email: 'Email',
  sms: 'SMS',
  voicemail: 'Voicemail',
  meeting: 'Meeting',
  other: 'Other',
};
const OUTCOME_LABELS: Record<string, string> = {
  no_answer: 'No answer',
  left_message: 'Left message',
  connected: 'Connected',
  scheduled: 'Scheduled',
  declined: 'Declined',
  other: 'Other',
};

function asList(value: any): string {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
}

/** Build a datetime-local default (now, local tz) for the create form. */
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function Field({ label, value }: { label: string; value: any }) {
  const display =
    value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="py-1.5 border-b border-[rgba(255,255,255,0.06)] last:border-0">
      <div className="text-xs text-ace-muted">{label}</div>
      <div className="text-sm">{display}</div>
    </div>
  );
}

export default function Tab1QuoteRequested({
  client,
  quote,
  advanceStage,
}: PanelProps) {
  // --- Platform entry (only when the quote didn't carry one) ---
  const [platformDraft, setPlatformDraft] = useState('');
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [platformSaved, setPlatformSaved] = useState<string | null>(
    quote?.platform || null,
  );
  const [platformError, setPlatformError] = useState<string | null>(null);

  const savePlatform = async () => {
    const value = platformDraft.trim();
    if (!value || !quote?.id) return;
    setSavingPlatform(true);
    setPlatformError(null);
    try {
      await updateQuote({ id: quote.id, platform: value });
      setPlatformSaved(value);
      setPlatformDraft('');
    } catch (err: any) {
      console.error('savePlatform failed:', err);
      setPlatformError(
        'Could not save the platform: ' + (err?.message || 'Unknown error'),
      );
    } finally {
      setSavingPlatform(false);
    }
  };

  // --- Contact-attempt log ---
  const attemptsQuery = useQuery({
    queryKey: ['contactAttempts', client?.id],
    queryFn: () => listContactAttemptsByClient(client.id),
    enabled: !!client?.id,
  });

  const attempts: any[] = [...(attemptsQuery.data || [])].sort((a, b) =>
    String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')),
  );
  // The ContactAttempt model is deploy-gated; a failed query means it isn't
  // deployed yet — render the empty/disabled state rather than an error.
  const logUndeployed = attemptsQuery.isError;

  const [form, setForm] = useState({
    occurredAt: nowLocalInput(),
    method: 'phone' as (typeof METHODS)[number],
    outcome: 'no_answer' as (typeof OUTCOMES)[number],
    notes: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const submitAttempt = async () => {
    setCreateError(null);
    // Validation: occurredAt required + parseable; method/outcome in-enum.
    const parsed = form.occurredAt ? new Date(form.occurredAt) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      setCreateError('Enter a valid date/time for the contact attempt.');
      return;
    }
    if (!METHODS.includes(form.method)) {
      setCreateError('Choose a valid method.');
      return;
    }
    if (!OUTCOMES.includes(form.outcome)) {
      setCreateError('Choose a valid outcome.');
      return;
    }
    setCreating(true);
    try {
      let sub = '';
      try {
        const session = await fetchAuthSession();
        sub = (session.tokens?.accessToken?.payload?.['sub'] as string) || '';
      } catch {
        /* best-effort stamp */
      }
      await createContactAttempt({
        clientId: client.id,
        quoteId: quote?.id || null,
        method: form.method,
        outcome: form.outcome,
        occurredAt: parsed.toISOString(),
        notes: form.notes.trim() || null,
        createdBySub: sub || null,
      });
      // Keep method/outcome, reset time to now + clear notes.
      setForm((f) => ({ ...f, occurredAt: nowLocalInput(), notes: '' }));
      await attemptsQuery.refetch();
    } catch (err: any) {
      console.error('createContactAttempt failed:', err);
      setCreateError(
        'Could not save the contact attempt: ' +
          (err?.message || 'Unknown error'),
      );
    } finally {
      setCreating(false);
    }
  };

  const isDigital = quote?.serviceType === 'digital' || !!quote?.digitalServices;

  return (
    <div className="space-y-6">
      {/* Incoming request */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Quote Request</h2>
        {quote ? (
          <>
            {isDigital && (
              <Field label="Services" value={asList(quote.digitalServices)} />
            )}
            <Field label="Description" value={quote.projectDescription} />
            <Field label="Timeline" value={quote.timeline} />
            <Field label="Features" value={asList(quote.features)} />
            <Field label="Budget" value={quote.digitalBudget} />
            <Field
              label="Contact"
              value={[
                `${quote.firstName || ''} ${quote.lastName || ''}`.trim(),
                quote.email,
                quote.phone,
                quote.organization,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          </>
        ) : (
          <p className="text-sm text-ace-muted">
            No linked quote found for this client. The request details appear here
            once a quote is linked (by client or email).
          </p>
        )}
      </div>

      {/* Platform */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Target Platform</h2>
        {platformSaved ? (
          <Field label="Platform" value={platformSaved} />
        ) : (
          <div>
            <p className="text-sm text-ace-muted mb-2">
              The quote didn't specify a platform. Record it here.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={platformDraft}
                onChange={(e) => setPlatformDraft(e.target.value)}
                placeholder="e.g. iOS + Android, Web app, Shopify..."
                disabled={!quote?.id || savingPlatform}
                className="input flex-1 text-sm disabled:opacity-50"
              />
              <button
                onClick={savePlatform}
                disabled={!quote?.id || savingPlatform || !platformDraft.trim()}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {savingPlatform ? 'Saving...' : 'Save'}
              </button>
            </div>
            {!quote?.id && (
              <p className="text-xs text-ace-muted mt-2 italic">
                Available once a quote is linked to this client.
              </p>
            )}
            {platformError && (
              <p className="text-xs text-red-300 mt-2">{platformError}</p>
            )}
          </div>
        )}
      </div>

      {/* AI recommendation */}
      {quote?.aiAnalysis && !String(quote.aiAnalysis).includes('unavailable') && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Brain size={18} className="text-ace-magenta" /> AI Recommendation
          </h2>
          <pre className="text-sm text-ace-muted whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
            {quote.aiAnalysis}
          </pre>
        </div>
      )}

      {/* Contact-attempt log */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Phone size={18} className="text-ace-cyan" /> Contact Attempts
        </h2>

        {logUndeployed ? (
          <p className="text-sm text-ace-muted italic">
            Contact logging is available after deploy.
          </p>
        ) : attemptsQuery.isLoading ? (
          <p className="text-sm text-ace-muted">Loading contact attempts...</p>
        ) : attempts.length === 0 ? (
          <p className="text-sm text-ace-muted">No contact attempts logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[rgba(255,255,255,0.06)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {METHOD_LABELS[a.method] || a.method} ·{' '}
                    {OUTCOME_LABELS[a.outcome] || a.outcome}
                  </span>
                  <span className="text-xs text-ace-muted">
                    {a.occurredAt
                      ? new Date(a.occurredAt).toLocaleString()
                      : '—'}
                  </span>
                </div>
                {a.notes && (
                  <p className="text-sm text-ace-muted mt-1 whitespace-pre-wrap">
                    {a.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Inline create */}
        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
          <h3 className="text-sm font-semibold mb-2">Log a contact attempt</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-ace-muted block mb-1">
                Date / time
              </label>
              <input
                type="datetime-local"
                value={form.occurredAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, occurredAt: e.target.value }))
                }
                disabled={logUndeployed || creating}
                className="input w-full text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-ace-muted block mb-1">Method</label>
              <select
                value={form.method}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    method: e.target.value as (typeof METHODS)[number],
                  }))
                }
                disabled={logUndeployed || creating}
                className="input w-full text-sm disabled:opacity-50"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-ace-muted block mb-1">Outcome</label>
              <select
                value={form.outcome}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    outcome: e.target.value as (typeof OUTCOMES)[number],
                  }))
                }
                disabled={logUndeployed || creating}
                className="input w-full text-sm disabled:opacity-50"
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            rows={2}
            disabled={logUndeployed || creating}
            className="input w-full text-sm mt-2 disabled:opacity-50"
          />
          {createError && (
            <p className="text-xs text-red-300 mt-2">{createError}</p>
          )}
          {logUndeployed && (
            <p className="text-xs text-ace-muted mt-2 italic">
              Logging a contact attempt is available after deploy.
            </p>
          )}
          <div className="flex justify-end mt-2">
            <button
              onClick={submitAttempt}
              disabled={logUndeployed || creating}
              className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={14} />
              {creating ? 'Saving...' : 'Add attempt'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div className="flex justify-end">
        <button
          onClick={() => advanceStage('demo_details')}
          className="btn-primary text-sm flex items-center gap-2"
        >
          Advance to {STAGE_LABELS.demo_details}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
