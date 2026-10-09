/**
 * Admin project detail — the ported Green-Casting dashboard UX for a single
 * project. Panels: category progress bars (frontend/backend/middleware),
 * page cards (dev-status select + look/features toggles + 0-5 rating display +
 * href link), a text+voice ProjectNote panel, a daily-log feed from
 * ProjectEvent, a meetings panel (confirm/decline), and a contract section
 * with a manual-upload view and an e-sign provider // TODO seam.
 *
 * Admin edits to a page both updateProjectPage AND createProjectEvent so the
 * change shows up in the daily log.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  FileSignature,
  CalendarClock,
  ScrollText,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import {
  getProject,
  listProjectPages,
  updateProjectPage,
  createProjectEvent,
  listProjectNotes,
  listProjectEvents,
  listMeetings,
  createMeeting,
  updateMeeting,
  getContract,
  getClient,
} from '../utils/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { logProjectEvent } from '../projects/lifecycleEvents';
import { sendMeetingResponseNotification } from '../utils/sendNotification';
import { getTemplate } from '../projects/templates';
import type { Category, TrackedItem } from '../projects/templates/types';
import {
  categoryDisplayed,
  overallDisplayed,
  trackStatus,
  type PageState,
} from '../projects/progress';
import {
  ProgressBar,
  TrackBadge,
  StarRating,
  DevStatusBadge,
  DEV_STATUS_OPTIONS,
  VoiceNotePlayer,
  NoteComposer,
} from '../projects/ui';
import { toStates } from './Projects';

const CATEGORIES: { key: Category; label: string; accent: string }[] = [
  { key: 'frontend', label: 'Frontend', accent: 'bg-ace-cyan' },
  { key: 'backend', label: 'Backend', accent: 'bg-ace-purple' },
  { key: 'middleware', label: 'Setup / middleware', accent: 'bg-ace-magenta' },
];

/** Meeting modes mirror Green-Casting APPT_MODES (label + per-mode hint). */
const APPT_MODES: { v: 'ZOOM' | 'IN_PERSON' | 'PHONE'; label: string; hint: string }[] = [
  { v: 'ZOOM', label: 'Zoom', hint: 'Zoom link (optional)' },
  { v: 'IN_PERSON', label: 'In person', hint: 'Address / place' },
  { v: 'PHONE', label: 'Phone call', hint: 'Phone number (optional)' },
];

const MEETING_PURPOSES: { v: string; label: string }[] = [
  { v: 'discovery', label: 'Discovery' },
  { v: 'kickoff', label: 'Kickoff' },
  { v: 'demo_review', label: 'Demo review' },
  { v: 'closing', label: 'Closing' },
  { v: 'maintenance', label: 'Maintenance' },
  { v: 'other', label: 'Other' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    const proj = await getProject(id);
    setProject(proj);
    const [pg, ns, ev, mt, ct] = await Promise.all([
      listProjectPages(id),
      listProjectNotes(id),
      listProjectEvents(id),
      listMeetings(id),
      getContract(id),
    ]);
    setPages(pg);
    setNotes(ns);
    setEvents(ev);
    setMeetings(mt);
    setContracts(ct);
    if (proj?.clientId) {
      try {
        setClient(await getClient(proj.clientId));
      } catch (err) {
        console.error('Failed to load client', err);
      }
    }
  }, [id]);

  useEffect(() => {
    refresh().catch(console.error).finally(() => setLoading(false));
  }, [refresh]);

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

  const clientName = client
    ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.organization || '—'
    : '—';

  async function editPage(item: TrackedItem, patch: Record<string, any>, logMsg: string) {
    const row = pageByKey.get(item.key);
    if (!row) return;
    await updateProjectPage({ id: row.id, ...patch });
    await createProjectEvent({
      projectId: id,
      pageKey: item.key,
      actor: 'admin',
      message: logMsg,
    });
    await refresh();
  }

  // Notify the customer of a meeting response when we have their email; skip
  // otherwise (per FEAT-001 TODO — the Notification.type enum has no meeting
  // value, so there is no in-app fallback row and we do NOT widen the schema).
  async function notifyMeetingResponse(
    status: string,
    responseNote: string,
    confirmedAt: string,
  ) {
    if (!client?.email) return;
    await sendMeetingResponseNotification({
      customerEmail: client.email,
      projectName: project?.name || 'your project',
      status,
      responseNote,
      confirmedAt,
    });
  }

  async function acceptMeeting(m: any) {
    const confirmedAt = new Date().toISOString();
    await updateMeeting({ id: m.id, status: 'ACCEPTED', confirmedAt });
    await notifyMeetingResponse('accepted', '', confirmedAt);
    await logProjectEvent(id!, 'admin', 'accepted meeting');
    await refresh();
  }

  async function declineMeeting(m: any) {
    const responseNote = window.prompt('Reason / note for declining (optional):') || '';
    await updateMeeting({ id: m.id, status: 'DECLINED', responseNote });
    await notifyMeetingResponse('declined', responseNote, '');
    await logProjectEvent(id!, 'admin', 'declined meeting');
    await refresh();
  }

  async function rescheduleMeeting(m: any) {
    const whenRaw = window.prompt('Propose a new time (YYYY-MM-DD HH:MM):') || '';
    if (!whenRaw.trim()) return;
    const parsed = new Date(whenRaw);
    if (isNaN(parsed.getTime())) {
      window.alert('Could not parse that date/time. Please try again.');
      return;
    }
    const proposedAt = parsed.toISOString();
    const responseNote = window.prompt('Note for the customer (optional):') || '';
    await updateMeeting({ id: m.id, status: 'RESCHEDULE', proposedAt, responseNote });
    await notifyMeetingResponse('reschedule', responseNote, proposedAt);
    await logProjectEvent(id!, 'admin', 'proposed a new meeting time');
    await refresh();
  }

  async function completeMeeting(m: any) {
    await updateMeeting({ id: m.id, status: 'COMPLETED' });
    await logProjectEvent(id!, 'admin', 'marked meeting completed');
    await refresh();
  }

  // Admin proactively schedules a meeting with the customer.
  async function scheduleMeeting(input: {
    mode: 'ZOOM' | 'IN_PERSON' | 'PHONE';
    when: string;
    location: string;
    agenda: string;
    purpose: string;
  }) {
    if (!project || !id) return;
    const session = await fetchAuthSession();
    const sub = (session.tokens?.accessToken?.payload?.['sub'] as string) || '';
    const proposedAt = input.when ? new Date(input.when).toISOString() : '';
    await createMeeting({
      projectId: id,
      clientId: project.clientId,
      requestedBySub: sub,
      mode: input.mode,
      proposedAt,
      location: input.location,
      agenda: input.agenda,
      purpose: input.purpose,
      status: 'REQUESTED',
    });
    await notifyMeetingResponse('reschedule', input.agenda, proposedAt);
    await logProjectEvent(id, 'admin', `scheduled a ${input.purpose} meeting (${input.mode})`);
    await refresh();
  }

  if (loading) return <div className="text-ace-muted">Loading project...</div>;
  if (!project) return <div className="text-ace-muted">Project not found.</div>;

  const track = trackStatus(template, states);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/projects')} className="text-ace-muted hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{project.name}</h1>
          <p className="text-ace-muted text-sm">
            {clientName} • {(project.status || 'planning').replace(/_/g, ' ')}
          </p>
        </div>
        <TrackBadge tone={track.tone} label={track.label} />
      </div>

      {/* Category progress */}
      <div className="card mb-6">
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

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Page cards grouped by category */}
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm">{item.label}</div>
                            <div className="text-xs text-ace-muted leading-snug">{item.blurb}</div>
                          </div>
                          {item.href && (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-ace-cyan hover:text-white flex-shrink-0"
                              title="Open preview"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <DevStatusBadge value={row?.devStatus} />
                          <StarRating value={approval} />
                        </div>

                        <select
                          className="input py-1.5 text-xs"
                          value={row?.devStatus || 'NOT_STARTED'}
                          onChange={(e) =>
                            editPage(
                              item,
                              { devStatus: e.target.value },
                              `set "${item.label}" to ${e.target.value.replace(/_/g, ' ').toLowerCase()}`,
                            )
                          }
                        >
                          {DEV_STATUS_OPTIONS.map((s) => (
                            <option key={s.v} value={s.v}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        <div className="flex gap-3 text-xs">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!row?.lookComplete}
                              onChange={(e) =>
                                editPage(
                                  item,
                                  { lookComplete: e.target.checked },
                                  `marked look ${e.target.checked ? 'complete' : 'incomplete'} on "${item.label}"`,
                                )
                              }
                            />
                            Look
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!row?.featuresComplete}
                              onChange={(e) =>
                                editPage(
                                  item,
                                  { featuresComplete: e.target.checked },
                                  `marked features ${e.target.checked ? 'complete' : 'incomplete'} on "${item.label}"`,
                                )
                              }
                            />
                            Features
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-ace-cyan" /> Notes
            </h2>
            <div className="space-y-3 mb-4 max-h-[360px] overflow-y-auto">
              {notes.length === 0 && (
                <p className="text-sm text-ace-muted">No notes yet.</p>
              )}
              {notes.map((n) => (
                <div key={n.id} className="bg-[#0e0e0e] rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-ace-muted mb-1">
                    <span>
                      {n.authorRole || 'user'} · {n.kind === 'VOICE' ? '🎙 voice' : 'note'}
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
            {/* Admin composer: persist only (no owner-notification needed here). */}
            <NoteComposer projectId={project.id} onCreated={() => refresh()} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Daily log */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <ScrollText size={16} className="text-ace-purple" /> Daily log
            </h3>
            {events.length === 0 ? (
              <p className="text-sm text-ace-muted">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {groupEventsByDay(events).map(([day, dayEvents]) => (
                  <div key={day}>
                    <div className="text-xs font-semibold text-ace-muted mb-1">{fmtDay(day)}</div>
                    <ul className="space-y-1">
                      {dayEvents.map((e) => (
                        <li key={e.id} className="text-sm text-white/80">
                          <span className="text-ace-muted">{e.actor || 'system'}</span> {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Meetings */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CalendarClock size={16} className="text-ace-cyan" /> Meetings
            </h3>

            <ScheduleMeetingForm onSubmit={scheduleMeeting} />

            <div className="mt-3">
              {meetings.length === 0 ? (
                <p className="text-sm text-ace-muted">No meetings requested.</p>
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
                      {m.confirmedAt && (
                        <div className="text-xs text-green-400 mt-1">
                          Confirmed for {fmtWhen(m.confirmedAt)}
                        </div>
                      )}
                      {m.agenda && <div className="text-xs mt-1">{m.agenda}</div>}
                      {m.responseNote && (
                        <div className="text-xs text-ace-muted mt-2 whitespace-pre-wrap">
                          <span className="text-white/70">Reply:</span> {m.responseNote}
                        </div>
                      )}
                      {m.status === 'REQUESTED' && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <button
                            onClick={() => acceptMeeting(m)}
                            className="text-xs px-3 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => declineMeeting(m)}
                            className="text-xs px-3 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => rescheduleMeeting(m)}
                            className="text-xs px-3 py-1 rounded-lg bg-white/5 text-ace-muted border border-[rgba(255,255,255,0.06)] hover:text-white"
                          >
                            Propose new time
                          </button>
                        </div>
                      )}
                      {m.status === 'ACCEPTED' && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => completeMeeting(m)}
                            className="text-xs px-3 py-1 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20"
                          >
                            Mark completed
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contract */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileSignature size={16} className="text-ace-magenta" /> Contract
            </h3>
            {contracts.length === 0 ? (
              <p className="text-sm text-ace-muted">No contract on file yet.</p>
            ) : (
              <div className="space-y-3">
                {contracts.map((c) => (
                  <div key={c.id} className="bg-[#0e0e0e] rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="badge bg-white/5 text-ace-muted">{c.status}</span>
                      <span className="text-xs text-ace-muted">{c.provider || 'manual_upload'}</span>
                    </div>
                    {c.amount != null && (
                      <div className="text-sm mt-1">
                        ${Number(c.amount).toLocaleString()}
                      </div>
                    )}
                    {/* Manual-upload view: the signed/unsigned document lives at
                        clients/{clientId}/contracts/* in S3. */}
                    {c.provider === 'manual_upload' || !c.provider ? (
                      c.documentKey ? (
                        <div className="text-xs text-ace-muted mt-1 break-all">
                          Document: {c.documentKey}
                        </div>
                      ) : (
                        <div className="text-xs text-ace-muted mt-1">
                          Upload the signed agreement to clients/{project.clientId}/contracts/*.
                        </div>
                      )
                    ) : (
                      // TODO(e-sign-provider seam): wire DocuSign / Dropbox Sign /
                      // eSignatures.io send+status based on Contract.provider. The
                      // manual-upload path above works today; no live provider call
                      // is made here.
                      <div className="text-xs text-yellow-400 mt-1">
                        {c.provider} e-sign integration pending.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleMeetingForm({
  onSubmit,
}: {
  onSubmit: (input: {
    mode: 'ZOOM' | 'IN_PERSON' | 'PHONE';
    when: string;
    location: string;
    agenda: string;
    purpose: string;
  }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'ZOOM' | 'IN_PERSON' | 'PHONE'>('ZOOM');
  const [when, setWhen] = useState('');
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [purpose, setPurpose] = useState('discovery');
  const [busy, setBusy] = useState(false);

  const hint = APPT_MODES.find((m) => m.v === mode)!.hint;

  async function submit() {
    setBusy(true);
    try {
      await onSubmit({ mode, when, location, agenda, purpose });
      setWhen('');
      setLocation('');
      setAgenda('');
      setPurpose('discovery');
      setMode('ZOOM');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20"
      >
        Schedule a meeting
      </button>
    );
  }

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3 space-y-3 border border-[rgba(255,255,255,0.04)]">
      <div className="flex gap-2 flex-wrap">
        {APPT_MODES.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => setMode(m.v)}
            className={`text-xs px-3 py-1 rounded-lg border ${
              mode === m.v
                ? 'border-ace-cyan bg-ace-cyan/15 text-white'
                : 'border-[rgba(255,255,255,0.06)] text-ace-muted hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-ace-muted mb-1 block">When</label>
        <input
          type="datetime-local"
          className="input text-sm"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-ace-muted mb-1 block">{hint}</label>
        <input
          type="text"
          className="input text-sm"
          placeholder={hint}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-ace-muted mb-1 block">Purpose</label>
        <select
          className="input py-1.5 text-sm"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        >
          {MEETING_PURPOSES.map((p) => (
            <option key={p.v} value={p.v}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-ace-muted mb-1 block">Agenda</label>
        <textarea
          className="input min-h-[60px] resize-y text-sm"
          placeholder="What should this meeting cover?"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !when}
          className="text-xs px-3 py-1.5 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20 disabled:opacity-50"
        >
          {busy ? 'Scheduling…' : 'Schedule'}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] text-ace-muted hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function fmtWhen(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, h:mm a');
  } catch {
    return '';
  }
}

function fmtDay(dayKey: string): string {
  try {
    return format(parseISO(dayKey + 'T00:00:00'), 'EEEE, MMMM d, yyyy');
  } catch {
    return dayKey;
  }
}

/** Group ProjectEvents into [YYYY-MM-DD, events[]] newest-day first. */
function groupEventsByDay(events: any[]): [string, any[]][] {
  const byDay = new Map<string, any[]>();
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
  for (const e of sorted) {
    const day = (e.createdAt || '').slice(0, 10) || 'unknown';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }
  return Array.from(byDay.entries());
}
