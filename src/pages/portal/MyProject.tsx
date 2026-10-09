/**
 * Customer project dashboard. Everything here is scoped to the signed-in
 * customer: we resolve THEIR Client by matching the Cognito identity
 * (sub / username / email from fetchAuthSession) against Client.cognitoUserId,
 * then load the Project(s) linked to that clientId. Ownership was stamped at
 * promotion (FEAT-002) so allow.owner() lets the customer read their own
 * Project / ProjectPage / notes / meetings / demos / contract rows.
 *
 * The customer can:
 *  - see category + overall progress bars and page cards,
 *  - set a 0-5 rating that writes ONLY clientApproval via updateProjectPage,
 *  - leave a TEXT or VOICE ProjectNote (notes.ts persists; MyProject then fires
 *    the REQUIRED SES notification to wilson.danny@me.com via
 *    sendProjectNoteNotification),
 *  - view meetings, review demos (set selectedOption / clientFeedback),
 *  - view/acknowledge the contract, and
 *  - see their invoices (listInvoices filtered to their clientId/projectId).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { format, parseISO } from 'date-fns';
import {
  CalendarClock,
  FileSignature,
  MessageSquare,
  MonitorPlay,
  Receipt,
} from 'lucide-react';
import {
  listClients,
  listProjects,
  listProjectPages,
  updateProjectPage,
  listProjectNotes,
  listMeetings,
  listDemos,
  updateDemo,
  getContract,
  listInvoices,
} from '../../utils/api';
import { getTemplate } from '../../projects/templates';
import type { Category, TrackedItem } from '../../projects/templates/types';
import {
  categoryDisplayed,
  overallDisplayed,
  type PageState,
} from '../../projects/progress';
import {
  ProgressBar,
  StarRating,
  DevStatusBadge,
  VoiceNotePlayer,
  NoteComposer,
} from '../../projects/ui';
import { sendProjectNoteNotification } from '../../utils/sendNotification';

const CATEGORIES: { key: Category; label: string; accent: string }[] = [
  { key: 'frontend', label: 'What you see', accent: 'bg-ace-cyan' },
  { key: 'backend', label: 'Behind the scenes', accent: 'bg-ace-purple' },
  { key: 'middleware', label: 'Setup steps', accent: 'bg-ace-magenta' },
];

function toStates(pages: any[]): Map<string, PageState> {
  const map = new Map<string, PageState>();
  for (const p of pages || []) {
    map.set(p.pageKey, {
      pageKey: p.pageKey,
      devStatus: p.devStatus,
      lookComplete: p.lookComplete,
      featuresComplete: p.featuresComplete,
      clientApproval: p.clientApproval,
    });
  }
  return map;
}

export default function MyProject() {
  const [project, setProject] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [demos, setDemos] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjectData = useCallback(async (projectId: string) => {
    const [pg, ns, mt, dm, ct] = await Promise.all([
      listProjectPages(projectId),
      listProjectNotes(projectId),
      listMeetings(projectId),
      listDemos(projectId),
      getContract(projectId),
    ]);
    setPages(pg);
    setNotes(ns);
    setMeetings(mt);
    setDemos(dm);
    setContracts(ct);
  }, []);

  const resolve = useCallback(async () => {
    // Resolve the signed-in customer's Cognito identity.
    const session = await fetchAuthSession();
    const payload = session.tokens?.accessToken?.payload || {};
    const idPayload = session.tokens?.idToken?.payload || {};
    const sub = (payload['sub'] as string) || '';
    const username = (payload['username'] as string) || '';
    const email = ((idPayload['email'] as string) || '').toLowerCase();
    const identities = [sub, username, email].filter(Boolean);

    // Match THEIR Client row by cognitoUserId (stamped at promotion with the
    // Cognito Username, which is email-based in this pool) — fall back to email.
    const clients = await listClients();
    const client = (clients || []).find((c: any) => {
      const cuid = (c.cognitoUserId || '').toLowerCase();
      return (
        (cuid && identities.includes(cuid)) ||
        (c.email || '').toLowerCase() === email
      );
    });
    if (!client) {
      setError('We could not find your project yet. Please contact your project manager.');
      return;
    }

    // Load the customer's project(s) scoped to their clientId (most recent).
    const allProjects = await listProjects();
    const mine = (allProjects || []).filter((p: any) => p.clientId === client.id);
    if (mine.length === 0) {
      setError('Your project is being set up. Check back soon.');
      return;
    }
    const proj = mine.sort(
      (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )[0];
    setProject(proj);

    await loadProjectData(proj.id);

    // Invoices scoped to this customer / project.
    try {
      const all = await listInvoices();
      setInvoices(
        (all || []).filter(
          (inv: any) => inv.clientId === client.id || inv.projectId === proj.id,
        ),
      );
    } catch (err) {
      console.error('Failed to load invoices', err);
    }
  }, [loadProjectData]);

  useEffect(() => {
    resolve()
      .catch((err) => {
        console.error(err);
        setError('Something went wrong loading your project.');
      })
      .finally(() => setLoading(false));
  }, [resolve]);

  const template = useMemo(() => {
    const t = getTemplate(project?.templateKey);
    if (project?.launchStart) t.launch.start = project.launchStart;
    if (project?.launchTarget) t.launch.target = project.launchTarget;
    if (project?.backendCeiling != null) t.backendCeiling = project.backendCeiling;
    return t;
  }, [project]);

  const states = useMemo<Map<string, PageState>>(() => toStates(pages), [pages]);
  const pageByKey = useMemo(() => {
    const m = new Map<string, any>();
    pages.forEach((p) => m.set(p.pageKey, p));
    return m;
  }, [pages]);

  // Customer rating writes ONLY clientApproval (field-scope enforced in UI;
  // the schema also limits the customer to read+update on ProjectPage).
  async function rate(item: TrackedItem, next: number) {
    const row = pageByKey.get(item.key);
    if (!row) return;
    await updateProjectPage({ id: row.id, clientApproval: next });
    if (project) await loadProjectData(project.id);
  }

  // Persist the note (notes.ts), THEN fire the REQUIRED SES notification to the
  // owner (wilson.danny@me.com). The notification is best-effort — the note is
  // already saved by the time this runs.
  async function handleNoteCreated(info: { kind: 'TEXT' | 'VOICE'; noteRef: string }) {
    await sendProjectNoteNotification({
      projectName: project?.name || 'Your project',
      kind: info.kind,
      noteRef: info.noteRef,
    });
    if (project) await loadProjectData(project.id);
  }

  async function pickDemoOption(demo: any, option: string) {
    await updateDemo({ id: demo.id, selectedOption: option });
    if (project) await loadProjectData(project.id);
  }

  async function sendDemoFeedback(demo: any, feedback: string) {
    await updateDemo({ id: demo.id, clientFeedback: feedback });
    if (project) await loadProjectData(project.id);
  }

  if (loading) return <div className="text-ace-muted">Loading your project...</div>;
  if (error) return <div className="card text-ace-muted">{error}</div>;
  if (!project) return <div className="card text-ace-muted">No project found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-ace-muted text-sm">
          Status: {(project.status || 'planning').replace(/_/g, ' ')}
        </p>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="grid sm:grid-cols-3 gap-6 mb-4">
          {CATEGORIES.map((c) => (
            <ProgressBar
              key={c.key}
              label={c.label}
              value={categoryDisplayed(c.key, template, states)}
              accent={c.accent}
            />
          ))}
        </div>
        <ProgressBar label="Overall" value={overallDisplayed(template, states)} />
      </div>

      {/* Page cards with settable rating */}
      {CATEGORIES.map((c) => {
        const items = template[c.key];
        if (!items.length) return null;
        return (
          <div key={c.key} className="card">
            <h2 className="text-lg font-semibold mb-4">{c.label}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((item) => {
                const row = pageByKey.get(item.key);
                const approval = row?.clientApproval ?? 0;
                return (
                  <div
                    key={item.key}
                    className="bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)] space-y-2"
                  >
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-xs text-ace-muted leading-snug">{item.blurb}</div>
                    <div className="flex items-center justify-between gap-2">
                      <DevStatusBadge value={row?.devStatus} />
                    </div>
                    <div>
                      <div className="text-xs text-ace-muted mb-1">How complete does it feel?</div>
                      <StarRating
                        value={approval}
                        editable={!!row}
                        onChange={(next) => rate(item, next)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Notes composer (TEXT + VOICE) */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-ace-cyan" /> Messages
        </h2>
        <div className="space-y-3 mb-4 max-h-[360px] overflow-y-auto">
          {notes.length === 0 && <p className="text-sm text-ace-muted">No messages yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="bg-[#0e0e0e] rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-ace-muted mb-1">
                <span>
                  {n.authorRole || 'you'} · {n.kind === 'VOICE' ? '🎙 voice' : 'note'}
                </span>
                <span>{fmtWhen(n.createdAt)}</span>
              </div>
              {n.kind === 'VOICE' && n.audioKey ? (
                <VoiceNotePlayer audioKey={n.audioKey} />
              ) : (
                <div className="text-sm whitespace-pre-wrap">{n.body}</div>
              )}
            </div>
          ))}
        </div>
        <NoteComposer projectId={project.id} onCreated={handleNoteCreated} />
      </div>

      {/* Demos to review */}
      {demos.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MonitorPlay size={18} className="text-ace-purple" /> Demos to review
          </h2>
          <div className="space-y-4">
            {demos.map((d) => {
              const options = parseOptions(d.options);
              return (
                <div key={d.id} className="bg-[#0e0e0e] rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{d.title}</span>
                    <span className="badge bg-white/5 text-ace-muted">{d.status}</span>
                  </div>
                  {d.previewUrl && (
                    <a
                      href={d.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-ace-cyan hover:text-white"
                    >
                      Open preview
                    </a>
                  )}
                  {options.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => pickDemoOption(d, opt)}
                          className={`text-xs px-3 py-1 rounded-lg border ${
                            d.selectedOption === opt
                              ? 'border-ace-purple bg-ace-purple/15 text-white'
                              : 'border-[rgba(255,255,255,0.06)] text-ace-muted hover:text-white'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  <DemoFeedback
                    initial={d.clientFeedback || ''}
                    onSave={(fb) => sendDemoFeedback(d, fb)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meetings */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarClock size={18} className="text-ace-cyan" /> Meetings
        </h2>
        {meetings.length === 0 ? (
          <p className="text-sm text-ace-muted">No meetings scheduled.</p>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="bg-[#0e0e0e] rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{m.purpose || 'Meeting'}</span>
                  <span className="badge bg-white/5 text-ace-muted">{m.status}</span>
                </div>
                <div className="text-xs text-ace-muted mt-1">
                  {m.proposedAt ? fmtWhen(m.proposedAt) : 'Time TBD'} · {m.mode || 'virtual'}
                </div>
                {m.agenda && <div className="text-xs mt-1">{m.agenda}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contract */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileSignature size={18} className="text-ace-magenta" /> Contract
        </h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-ace-muted">No contract to review yet.</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((c) => (
              <div key={c.id} className="bg-[#0e0e0e] rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="badge bg-white/5 text-ace-muted">{c.status}</span>
                  {c.amount != null && (
                    <span className="text-sm">${Number(c.amount).toLocaleString()}</span>
                  )}
                </div>
                {c.terms && <div className="text-xs text-ace-muted mt-2 whitespace-pre-wrap">{c.terms}</div>}
                {/* Manual-upload contract is viewable; e-sign is a // TODO seam. */}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Receipt size={18} className="text-green-400" /> Invoices &amp; payments
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-ace-muted">No invoices yet.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-[#0e0e0e] rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    ${Number(inv.total || 0).toLocaleString()}
                    {inv.kind ? ` · ${inv.kind}` : ''}
                  </span>
                  <span className="badge bg-white/5 text-ace-muted">{inv.status}</span>
                </div>
                <div className="text-xs text-ace-muted mt-1">
                  {inv.dueDate ? `Due ${fmtWhen(inv.dueDate)}` : ''}
                </div>
                {inv.paymentLink && inv.status !== 'paid' && (
                  <a
                    href={inv.paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20"
                  >
                    Pay now
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DemoFeedback({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (feedback: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="mt-2 space-y-2">
      <textarea
        className="input min-h-[60px] resize-y text-sm"
        placeholder="Share your feedback on this demo…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(value.trim());
          } finally {
            setSaving(false);
          }
        }}
        disabled={saving || !value.trim()}
        className="text-xs px-3 py-1.5 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Send feedback'}
      </button>
    </div>
  );
}

function parseOptions(options: any): string[] {
  if (Array.isArray(options)) return options.filter(Boolean);
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fmtWhen(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, h:mm a');
  } catch {
    return iso;
  }
}
