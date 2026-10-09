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
  ExternalLink,
  FileSignature,
  MessageSquare,
  MonitorPlay,
  Receipt,
  Wrench,
} from 'lucide-react';
import {
  listClients,
  listProjects,
  listProjectPages,
  updateProjectPage,
  listProjectNotes,
  listMeetings,
  createMeeting,
  listDemos,
  updateDemo,
  getContract,
  updateContract,
  listInvoices,
  listMaintenancePlansByProject,
  createMaintenanceWindow,
  listMaintenanceWindowsByPlan,
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
  DemoImage,
} from '../../projects/ui';
import {
  sendProjectNoteNotification,
  sendMeetingRequestNotification,
  sendDemoFeedbackNotification,
  sendContractSignedNotification,
  sendMaintenanceWindowNotification,
} from '../../utils/sendNotification';
import { logProjectEvent } from '../../projects/lifecycleEvents';
import { contractUrl } from '../../contracts/contracts';
import { dropboxSign } from '../../contracts/providers/dropboxSign';

/** Meeting modes mirror Green-Casting APPT_MODES (label + per-mode hint). */
const APPT_MODES: { v: 'ZOOM' | 'IN_PERSON' | 'PHONE'; label: string; hint: string }[] = [
  { v: 'ZOOM', label: 'Zoom', hint: 'Zoom link (optional)' },
  { v: 'IN_PERSON', label: 'In person', hint: 'Address / place' },
  { v: 'PHONE', label: 'Phone call', hint: 'Phone number (optional)' },
];

/** Purpose options the customer can request a meeting for. */
const MEETING_PURPOSES: { v: string; label: string }[] = [
  { v: 'discovery', label: 'Discovery' },
  { v: 'kickoff', label: 'Kickoff' },
  { v: 'demo_review', label: 'Demo review' },
  { v: 'maintenance', label: 'Maintenance' },
  { v: 'other', label: 'Other' },
];

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
  const [client, setClient] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [demos, setDemos] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [plan, setPlan] = useState<any | null>(null);
  const [maintenanceWindows, setMaintenanceWindows] = useState<any[]>([]);
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

    // Maintenance plan + the customer's own windows. Plan reads may depend on
    // the promotion owner-stamp resolving (same caveat as Project/Contract
    // reads), so tolerate a failure with a graceful empty state rather than
    // throwing — mirroring how the rest of this page handles missing data.
    try {
      const myPlans = await listMaintenancePlansByProject(projectId);
      // Prefer an active plan; otherwise show the most recent one.
      const active = (myPlans || []).find((p: any) => p.status === 'active');
      const chosen = active
        || (myPlans || []).sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        )[0]
        || null;
      setPlan(chosen);
      if (chosen) {
        const wins = await listMaintenanceWindowsByPlan(chosen.id);
        setMaintenanceWindows(wins || []);
      } else {
        setMaintenanceWindows([]);
      }
    } catch (err) {
      console.error('Failed to load maintenance plan', err);
      setPlan(null);
      setMaintenanceWindows([]);
    }
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
    // Keep the resolved client row so the meeting-request form can read client.id.
    setClient(client);

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

  // Never show DRAFT demos to the customer — only SHARED/FEEDBACK/APPROVED.
  const visibleDemos = useMemo(
    () => demos.filter((d) => ['SHARED', 'FEEDBACK', 'APPROVED'].includes(d.status)),
    [demos],
  );

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

  // Customer picks a choice-board option. TD-1 field-scope: the customer
  // updateDemo call sends ONLY selectedOption + status (never title/kind/
  // options/previewUrl); scoping is UI-enforced, matching the
  // ProjectPage.clientApproval pattern. Picking moves the demo to FEEDBACK,
  // notifies the owner, and logs the activity.
  async function pickDemoOption(demo: any, slug: string) {
    await updateDemo({ id: demo.id, selectedOption: slug, status: 'FEEDBACK' });
    await sendDemoFeedbackNotification({
      projectName: project?.name || 'Your project',
      demoTitle: demo.title || 'Demo',
      selectedOption: slug,
      clientFeedback: demo.clientFeedback || '',
    });
    if (project) {
      await logProjectEvent(project.id, 'customer', `picked "${slug}" on demo "${demo.title}"`);
      await loadProjectData(project.id);
    }
  }

  // Customer leaves written feedback. TD-1 field-scope: sends ONLY
  // clientFeedback + status. Moves the demo to FEEDBACK, notifies, logs.
  async function sendDemoFeedback(demo: any, feedback: string) {
    await updateDemo({ id: demo.id, clientFeedback: feedback, status: 'FEEDBACK' });
    await sendDemoFeedbackNotification({
      projectName: project?.name || 'Your project',
      demoTitle: demo.title || 'Demo',
      selectedOption: demo.selectedOption || '',
      clientFeedback: feedback,
    });
    if (project) {
      await logProjectEvent(project.id, 'customer', `left feedback on demo "${demo.title}"`);
      await loadProjectData(project.id);
    }
  }

  // Customer requests a meeting: resolve the Cognito sub (same access-token
  // payload pattern as notes.ts resolveAuthor), create a REQUESTED meeting
  // scoped to this client/project, notify the owner, log the activity, reload.
  async function requestMeeting(input: {
    mode: 'ZOOM' | 'IN_PERSON' | 'PHONE';
    when: string;
    location: string;
    agenda: string;
    purpose: string;
  }) {
    if (!project || !client) return;
    const session = await fetchAuthSession();
    const sub = (session.tokens?.accessToken?.payload?.['sub'] as string) || '';
    const proposedAt = input.when ? new Date(input.when).toISOString() : '';
    await createMeeting({
      projectId: project.id,
      clientId: client.id,
      requestedBySub: sub,
      mode: input.mode,
      proposedAt,
      location: input.location,
      agenda: input.agenda,
      purpose: input.purpose,
      status: 'REQUESTED',
    });
    await sendMeetingRequestNotification({
      projectName: project.name || 'Your project',
      proposedAt,
      mode: input.mode,
      agenda: input.agenda,
      purpose: input.purpose,
    });
    await logProjectEvent(
      project.id,
      'customer',
      `requested a ${input.purpose} meeting (${input.mode})`,
    );
    await loadProjectData(project.id);
  }

  // Customer requests a maintenance window. Field-scope (TD-1/TD-3): the
  // createMaintenanceWindow payload carries ONLY the request fields (planId,
  // requestedBySub, scheduledFor, durationMins, description, status:'requested')
  // — never plan status/amount; scoping is UI-enforced and schema auth is
  // untouched. Then notify the owner (best-effort) and log the activity.
  async function requestMaintenanceWindow(input: {
    when: string;
    durationMins: number;
    description: string;
  }) {
    if (!project || !plan) return;
    const session = await fetchAuthSession();
    const sub = (session.tokens?.accessToken?.payload?.['sub'] as string) || '';
    const scheduledFor = input.when ? new Date(input.when).toISOString() : '';
    await createMaintenanceWindow({
      planId: plan.id,
      requestedBySub: sub,
      scheduledFor,
      durationMins: input.durationMins,
      description: input.description,
      status: 'requested',
    });
    await sendMaintenanceWindowNotification({
      projectName: project.name || 'Your project',
      scheduledFor,
      durationMins: input.durationMins,
      description: input.description,
    });
    await logProjectEvent(project.id, 'customer', 'requested a maintenance window');
    await loadProjectData(project.id);
  }

  // Auto-advance a freshly 'sent' contract to 'viewed' on first render. This is
  // a customer field-scoped update (status only), UI-enforced per TD-1 — we do
  // NOT widen schema auth. Guarded by a ref-like set so each contract flips at
  // most once per mount.
  const [autoViewed, setAutoViewed] = useState<Set<string>>(new Set());
  useEffect(() => {
    const toView = contracts.filter((c) => c.status === 'sent' && !autoViewed.has(c.id));
    if (toView.length === 0) return;
    setAutoViewed((prev) => {
      const next = new Set(prev);
      toView.forEach((c) => next.add(c.id));
      return next;
    });
    (async () => {
      for (const c of toView) {
        try {
          await updateContract({ id: c.id, status: 'viewed' });
        } catch (err) {
          console.error('Failed to mark contract viewed', err);
        }
      }
      if (project) await loadProjectData(project.id);
    })();
  }, [contracts, autoViewed, project, loadProjectData]);

  // Customer signs a manual-upload contract in-app. TD-1 field-scope: the
  // updateContract payload carries ONLY status / signedAt / terms (never the
  // documentKey, amount, provider, etc.); scoping is UI-enforced, mirroring the
  // demo flow. The typed signer name is recorded inside the terms json so it is
  // preserved alongside any existing terms. Manual signing does NOT depend on
  // the PDF URL resolving (see the {entity_id} caveat).
  async function signContract(c: any, signerName: string) {
    const signedAt = new Date().toISOString();
    const existing = parseTerms(c.terms);
    const base = existing && typeof existing === 'object' ? existing : {};
    const terms = { ...base, signerName, signedVia: 'in_app', signedAt };
    await updateContract({ id: c.id, status: 'signed', signedAt, terms });
    await sendContractSignedNotification({
      projectName: project?.name || 'Your project',
      signerName,
    });
    if (project) {
      await logProjectEvent(project.id, 'customer', `signed the contract as ${signerName}`);
      await loadProjectData(project.id);
    }
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

      {/* Demos to review — only SHARED/FEEDBACK/APPROVED are shown to the
          customer; DRAFT demos stay hidden until the admin shares them. */}
      {visibleDemos.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MonitorPlay size={18} className="text-ace-purple" /> Demos to review
          </h2>
          <div className="space-y-4">
            {visibleDemos.map((d) => {
              const options = parseOptions(d.options);
              const isChoiceBoard = d.kind === 'CHOICE_BOARD';
              return (
                <div key={d.id} className="bg-[#0e0e0e] rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{d.title}</span>
                    <span className="badge bg-white/5 text-ace-muted">{d.status}</span>
                  </div>

                  {/* PREVIEW_URL / PROTOTYPE / DECK: show the link/asset. */}
                  {d.previewUrl && (
                    <a
                      href={d.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-xs text-ace-cyan hover:text-white"
                    >
                      Open preview
                    </a>
                  )}

                  {/* CHOICE_BOARD: image cards resolved via signed S3 URLs
                      (DemoImage), never inlined. Clicking a card selects it. */}
                  {isChoiceBoard && options.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                      {options.map((opt) => {
                        const selected = d.selectedOption === opt.slug;
                        return (
                          <button
                            key={opt.slug}
                            type="button"
                            onClick={() => pickDemoOption(d, opt.slug)}
                            className={`text-left rounded-lg border overflow-hidden transition-colors ${
                              selected
                                ? 'border-ace-purple ring-1 ring-ace-purple'
                                : 'border-[rgba(255,255,255,0.06)] hover:border-ace-purple/50'
                            }`}
                          >
                            {opt.imageKey ? (
                              <DemoImage
                                imageKey={opt.imageKey}
                                alt={opt.name}
                                className="w-full h-40 object-cover bg-black/40"
                              />
                            ) : (
                              <div className="w-full h-40 flex items-center justify-center text-xs text-ace-muted bg-white/5">
                                No image
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2 px-3 py-2">
                              <span className="text-xs font-medium truncate">{opt.name}</span>
                              {selected && (
                                <span className="text-xs text-ace-purple">Selected ✓</span>
                              )}
                            </div>
                            {opt.previewUrl && (
                              <a
                                href={opt.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="block px-3 pb-2 text-xs text-ace-cyan hover:text-white"
                              >
                                Open preview
                              </a>
                            )}
                          </button>
                        );
                      })}
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

        <MeetingRequestForm onSubmit={requestMeeting} disabled={!client} />

        <div className="mt-4">
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
                </div>
              ))}
            </div>
          )}
        </div>
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
              <CustomerContractCard
                key={c.id}
                contract={c}
                onSign={(name) => signContract(c, name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Maintenance */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wrench size={18} className="text-ace-cyan" /> Maintenance
        </h2>

        {!plan || plan.status === 'cancelled' ? (
          <p className="text-sm text-ace-muted">No maintenance plan.</p>
        ) : (
          <>
            <div className="bg-[#0e0e0e] rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  ${Number(plan.amount || 0).toLocaleString()}
                  <span className="text-ace-muted"> / {plan.cadence}</span>
                </span>
                <span className="badge bg-white/5 text-ace-muted">{plan.status}</span>
              </div>
              {plan.includedHours != null && (
                <div className="text-xs text-ace-muted mt-1">
                  {plan.includedHours}h included per cycle
                </div>
              )}
              {plan.nextBillingDate && (
                <div className="text-xs text-ace-muted mt-1">
                  Next billing: {plan.nextBillingDate}
                </div>
              )}
            </div>

            {plan.status === 'active' && (
              <div className="mt-4">
                <MaintenanceWindowRequestForm onSubmit={requestMaintenanceWindow} />
              </div>
            )}

            <div className="mt-4">
              {maintenanceWindows.length === 0 ? (
                <p className="text-sm text-ace-muted">No maintenance windows yet.</p>
              ) : (
                <div className="space-y-3">
                  {maintenanceWindows.map((w) => (
                    <div key={w.id} className="bg-[#0e0e0e] rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{w.description || 'Window'}</span>
                        <span className="badge bg-white/5 text-ace-muted">{w.status}</span>
                      </div>
                      <div className="text-xs text-ace-muted mt-1">
                        {w.scheduledFor ? fmtWhen(w.scheduledFor) : 'Time TBD'}
                        {w.durationMins != null ? ` · ${w.durationMins} min` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
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

function MeetingRequestForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (input: {
    mode: 'ZOOM' | 'IN_PERSON' | 'PHONE';
    when: string;
    location: string;
    agenda: string;
    purpose: string;
  }) => void | Promise<void>;
  disabled?: boolean;
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
        disabled={disabled}
        className="text-xs px-3 py-1.5 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20 disabled:opacity-50"
      >
        Request a meeting
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
          placeholder="What would you like to discuss?"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || disabled || !when}
          className="text-xs px-3 py-1.5 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send request'}
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

function MaintenanceWindowRequestForm({
  onSubmit,
}: {
  onSubmit: (input: {
    when: string;
    durationMins: number;
    description: string;
  }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState('');
  const [durationMins, setDurationMins] = useState('60');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setWhen('');
    setDurationMins('60');
    setDescription('');
  }

  async function submit() {
    setBusy(true);
    try {
      await onSubmit({
        when,
        durationMins: Number(durationMins) || 0,
        description: description.trim(),
      });
      reset();
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
        Request a maintenance window
      </button>
    );
  }

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3 space-y-3 border border-[rgba(255,255,255,0.04)]">
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
        <label className="text-xs text-ace-muted mb-1 block">Duration (minutes)</label>
        <input
          type="number"
          min="0"
          step="15"
          className="input text-sm"
          placeholder="e.g. 60"
          value={durationMins}
          onChange={(e) => setDurationMins(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-ace-muted mb-1 block">What needs attention?</label>
        <textarea
          className="input min-h-[60px] resize-y text-sm"
          placeholder="Describe the work you'd like done."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !when}
          className="text-xs px-3 py-1.5 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send request'}
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] text-ace-muted hover:text-white"
        >
          Cancel
        </button>
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

/** A single choice-board option as stored in Demo.options (json). */
type DemoOption = { slug: string; name: string; imageKey?: string; previewUrl?: string };

/**
 * Parse Demo.options (a json column that may arrive as an array already, or as
 * a JSON string) into [{slug,name,imageKey,previewUrl}] objects. Tolerates the
 * legacy plain-string shape by wrapping each string into an option object.
 */
function parseOptions(options: any): DemoOption[] {
  let raw: any = options;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o: any): DemoOption | null => {
      if (typeof o === 'string') return { slug: o, name: o };
      if (o && typeof o === 'object' && (o.slug || o.name)) {
        return {
          slug: String(o.slug || o.name),
          name: String(o.name || o.slug),
          imageKey: o.imageKey || undefined,
          previewUrl: o.previewUrl || undefined,
        };
      }
      return null;
    })
    .filter((o): o is DemoOption => o !== null);
}

/**
 * Contract.terms is a.json() — it can arrive as an already-parsed object, as a
 * JSON string, or as a plain human-readable string. Parse defensively: return
 * the object when it is one (or a JSON string that decodes to an object),
 * otherwise return the original string so callers can render it as prose.
 */
function parseTerms(terms: any): any {
  if (terms == null) return null;
  if (typeof terms === 'object') return terms;
  if (typeof terms === 'string') {
    const trimmed = terms.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return terms;
      }
    }
    return terms;
  }
  return terms;
}

/**
 * Signed-URL contract document link mirroring ProjectDetail's ContractDocLink
 * and DemoImage: resolve the signed GET URL in an effect and fall back to a
 * graceful "unavailable" message rather than erroring. This covers the
 * {entity_id} identity-rule caveat where a customer may be denied the GET URL
 * (clientId != their Cognito identity id).
 */
function CustomerContractDocLink({ docKey, label }: { docKey: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    let active = true;
    contractUrl(docKey)
      .then((u) => {
        if (active) setUrl(u);
      })
      .finally(() => {
        if (active) setResolved(true);
      });
    return () => {
      active = false;
    };
  }, [docKey]);

  if (!resolved) {
    return <div className="text-xs text-ace-muted mt-1">Loading {label}…</div>;
  }
  if (!url) {
    return <div className="text-xs text-ace-muted mt-1">Document unavailable.</div>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 mt-1 text-xs text-ace-cyan hover:text-white"
    >
      <ExternalLink size={12} /> View {label}
    </a>
  );
}

/**
 * Customer-facing contract card: shows status / amount / terms, the document
 * link(s) with a graceful fallback, and — for the manual_upload provider — an
 * in-app type-to-sign form (full name + agree checkbox). For dropbox_sign it
 * surfaces the provider signing link / a "not configured" or "pending" state
 * and does NOT offer in-app type-to-sign.
 */
function CustomerContractCard({
  contract: c,
  onSign,
}: {
  contract: any;
  onSign: (signerName: string) => void | Promise<void>;
}) {
  const terms = parseTerms(c.terms);
  const termsIsObject = terms && typeof terms === 'object';
  const isDropbox = c.provider === 'dropbox_sign';
  const canSign = c.status === 'sent' || c.status === 'viewed';
  const alreadySigned = c.status === 'signed' || c.status === 'countersigned';

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="badge bg-white/5 text-ace-muted">{c.status}</span>
        {c.amount != null && (
          <span className="text-sm">${Number(c.amount).toLocaleString()}</span>
        )}
      </div>

      {/* Terms — a.json() may be an object or a plain string. */}
      {termsIsObject ? (
        <div className="text-xs text-ace-muted mt-2 space-y-1">
          {terms.signerName && (
            <div>
              <span className="text-white/70">Signed by:</span> {terms.signerName}
            </div>
          )}
          {terms.notes && <div className="whitespace-pre-wrap">{terms.notes}</div>}
        </div>
      ) : (
        terms && (
          <div className="text-xs text-ace-muted mt-2 whitespace-pre-wrap">{String(terms)}</div>
        )
      )}

      {/* Document link(s) with graceful fallback for the {entity_id} caveat. */}
      {c.documentKey && <CustomerContractDocLink docKey={c.documentKey} label="document" />}
      {c.signedDocumentKey && (
        <CustomerContractDocLink docKey={c.signedDocumentKey} label="signed document" />
      )}

      {alreadySigned && (
        <div className="text-xs text-green-400 mt-2">
          {c.signedAt ? `Signed on ${fmtWhen(c.signedAt)}` : 'Signed'}
        </div>
      )}

      {/* Signing area. */}
      {!alreadySigned && isDropbox ? (
        <DropboxSignNotice hasEnvelope={Boolean(c.providerEnvelopeId)} />
      ) : (
        !alreadySigned &&
        canSign && <ManualSignForm onSign={onSign} />
      )}
    </div>
  );
}

/**
 * Dropbox Sign branch: this provider sends the signing request out of band
 * (the signer completes it via Dropbox Sign's own flow, not in-app), so we
 * surface a status notice instead of a type-to-sign form. When the provider is
 * not configured we say so; when a signature request exists (envelope present)
 * we point the signer to the emailed link; otherwise the link is still pending.
 * No in-app type-to-sign is offered in this mode.
 */
function DropboxSignNotice({ hasEnvelope }: { hasEnvelope: boolean }) {
  if (!dropboxSign.configured()) {
    return (
      <p className="text-xs text-ace-muted mt-3">
        E-signing is not configured yet. Your project manager will reach out with next steps.
      </p>
    );
  }
  if (hasEnvelope) {
    return (
      <p className="text-xs text-ace-muted mt-3">
        A signing request has been sent via Dropbox Sign. Check your email to review and sign the
        contract.
      </p>
    );
  }
  return (
    <p className="text-xs text-ace-muted mt-3">
      Your signing link is being prepared. Check back shortly.
    </p>
  );
}

/**
 * Manual in-app type-to-sign: full name + an explicit "I agree" checkbox. The
 * Sign button is enabled only when both a name is typed and the box is checked.
 */
function ManualSignForm({
  onSign,
}: {
  onSign: (signerName: string) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = name.trim().length > 0 && agree;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    try {
      await onSign(name.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
      <label className="text-xs text-ace-muted block">Type your full name to sign</label>
      <input
        type="text"
        className="input text-sm"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="flex items-start gap-2 text-xs text-ace-muted">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
        />
        <span>I agree to these terms and consent to signing electronically.</span>
      </label>
      <button
        onClick={submit}
        disabled={!ready || busy}
        className="text-xs px-3 py-1.5 rounded-lg bg-ace-magenta/15 text-ace-magenta border border-ace-magenta/20 disabled:opacity-50"
      >
        {busy ? 'Signing…' : 'Sign contract'}
      </button>
    </div>
  );
}

function fmtWhen(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, h:mm a');
  } catch {
    return iso;
  }
}
