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
  Wrench,
  CalendarClock,
  ScrollText,
  MessageSquare,
  MonitorPlay,
  ExternalLink,
  Plus,
  Trash2,
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
  listDemos,
  createDemo,
  updateDemo,
  getContract,
  createContract,
  updateContract,
  updateProject,
  getClient,
  createMaintenancePlan,
  listMaintenancePlansByProject,
  updateMaintenancePlan,
  createMaintenanceWindow,
  listMaintenanceWindowsByPlan,
  updateMaintenanceWindow,
  createInvoice,
} from '../utils/api';
import { uploadDemoImage, slugify } from '../projects/demos';
import { uploadContractPdf, contractUrl } from '../contracts/contracts';
import { dropboxSign } from '../contracts/providers/dropboxSign';
import { stripe } from '../billing/providers/stripe';
import { billingConfigured } from '../billing/billing';
import { fetchAuthSession } from 'aws-amplify/auth';
import { logProjectEvent } from '../projects/lifecycleEvents';
import {
  sendMeetingResponseNotification,
  sendContractSentNotification,
} from '../utils/sendNotification';
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
  DemoImage,
} from '../projects/ui';
import { toStates } from './Projects';

/** Demo kinds mirror the Demo model enum. */
const DEMO_KINDS: { v: 'CHOICE_BOARD' | 'PROTOTYPE' | 'PREVIEW_URL' | 'DECK'; label: string }[] = [
  { v: 'CHOICE_BOARD', label: 'Choice board (images)' },
  { v: 'PROTOTYPE', label: 'Prototype (URL)' },
  { v: 'PREVIEW_URL', label: 'Preview URL' },
  { v: 'DECK', label: 'Deck (URL)' },
];

/** A single choice-board option as persisted in Demo.options. */
type DemoOption = { slug: string; name: string; imageKey?: string; previewUrl?: string };

/** Parse Demo.options (json or JSON string) into option objects. */
function parseDemoOptions(options: any): DemoOption[] {
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
    .filter((o: any) => o && typeof o === 'object' && (o.slug || o.name))
    .map((o: any) => ({
      slug: String(o.slug || o.name),
      name: String(o.name || o.slug),
      imageKey: o.imageKey || undefined,
      previewUrl: o.previewUrl || undefined,
    }));
}

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
  const [demos, setDemos] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  // Maintenance windows keyed by planId, loaded alongside the plans.
  const [windowsByPlan, setWindowsByPlan] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    const proj = await getProject(id);
    setProject(proj);
    const [pg, ns, ev, mt, dm, ct, pl] = await Promise.all([
      listProjectPages(id),
      listProjectNotes(id),
      listProjectEvents(id),
      listMeetings(id),
      listDemos(id),
      getContract(id),
      listMaintenancePlansByProject(id),
    ]);
    setPages(pg);
    setNotes(ns);
    setEvents(ev);
    setMeetings(mt);
    setDemos(dm);
    setContracts(ct);
    setPlans(pl);
    // Load each plan's windows so the admin can manage them inline.
    try {
      const entries = await Promise.all(
        (pl || []).map(async (p: any) => [p.id, await listMaintenanceWindowsByPlan(p.id)] as const),
      );
      setWindowsByPlan(Object.fromEntries(entries));
    } catch (err) {
      console.error('Failed to load maintenance windows', err);
    }
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

  // Admin creates a demo. For CHOICE_BOARD the option images were already
  // uploaded (uploadDemoImage) by the create form and arrive as
  // [{slug,name,imageKey,previewUrl}]. PREVIEW_URL/PROTOTYPE/DECK carry a
  // previewUrl instead. New demos always start as DRAFT.
  async function createDemoRecord(input: {
    title: string;
    kind: 'CHOICE_BOARD' | 'PROTOTYPE' | 'PREVIEW_URL' | 'DECK';
    options: DemoOption[];
    previewUrl: string;
  }) {
    if (!id) return;
    const payload: Record<string, any> = {
      projectId: id,
      title: input.title,
      kind: input.kind,
      status: 'DRAFT',
    };
    if (input.kind === 'CHOICE_BOARD') payload.options = input.options;
    else payload.previewUrl = input.previewUrl;
    await createDemo(payload);
    await logProjectEvent(id, 'admin', `created ${input.kind} demo "${input.title}"`);
    await refresh();
  }

  async function shareDemo(d: any) {
    await updateDemo({ id: d.id, status: 'SHARED' });
    await logProjectEvent(id!, 'admin', `shared demo "${d.title}" with the client`);
    await refresh();
  }

  async function approveDemo(d: any) {
    await updateDemo({ id: d.id, status: 'APPROVED' });
    await logProjectEvent(id!, 'admin', `marked demo "${d.title}" approved`);
    await refresh();
  }

  // --- Contract admin actions ---

  // Create a draft contract. terms is stored into Contract.terms (a.json()).
  async function createContractRecord(input: {
    amount: number;
    terms: string;
    provider: 'manual_upload' | 'dropbox_sign';
  }) {
    if (!id || !project) return;
    await createContract({
      projectId: id,
      clientId: project.clientId,
      status: 'draft',
      provider: input.provider,
      amount: input.amount,
      terms: input.terms,
    });
    await logProjectEvent(id, 'admin', 'created a contract');
    await refresh();
  }

  // Upload an unsigned contract PDF and persist its documentKey.
  async function uploadContractDocument(c: any, file: File) {
    if (!id || !project) return;
    const documentKey = await uploadContractPdf(project.clientId, file, 'contract');
    await updateContract({ id: c.id, documentKey });
    await logProjectEvent(id, 'admin', 'uploaded the contract');
    await refresh();
  }

  // Send a draft contract to the customer. For manual_upload we flip the status
  // and notify the customer; for dropbox_sign we go through the adapter, which
  // is a clean no-op when the secret is absent (handled in the UI).
  async function sendContract(c: any) {
    if (!id) return;
    if (c.provider === 'dropbox_sign') {
      if (!dropboxSign.configured()) return; // UI shows the 'not configured' notice
      const res = await dropboxSign.createSignatureRequest({
        contractId: c.id,
        documentKey: c.documentKey,
        signerName: clientName,
        signerEmail: client?.email,
      });
      await updateContract({
        id: c.id,
        status: 'sent',
        sentAt: new Date().toISOString(),
        providerEnvelopeId: res.envelopeId,
      });
    } else {
      await updateContract({ id: c.id, status: 'sent', sentAt: new Date().toISOString() });
      if (client?.email) {
        await sendContractSentNotification({
          customerEmail: client.email,
          projectName: project?.name || 'your project',
          amount: c.amount,
        });
      }
    }
    await logProjectEvent(id, 'admin', 'sent the contract to the client');
    await refresh();
  }

  // Countersign a client-signed contract.
  async function countersignContract(c: any) {
    if (!id) return;
    await updateContract({ id: c.id, status: 'countersigned' });
    await logProjectEvent(id, 'admin', 'countersigned the contract');
    await refresh();
  }

  // --- Maintenance admin actions ---

  // Create a maintenance plan as a draft (paused) DB record. Activation (and
  // any Stripe subscription) is a separate explicit step.
  async function createMaintenancePlanRecord(input: {
    cadence: 'monthly' | 'quarterly' | 'annual';
    amount: number;
    includedHours: number;
  }) {
    if (!id || !project) return;
    await createMaintenancePlan({
      projectId: id,
      clientId: project.clientId,
      status: 'paused',
      cadence: input.cadence,
      amount: input.amount,
      includedHours: input.includedHours,
    });
    await logProjectEvent(id, 'admin', `created a ${input.cadence} maintenance plan`);
    await refresh();
  }

  // Activate a plan. Branch on the Stripe adapter: when configured, create the
  // subscription and store the returned stripeSubscriptionId + nextBillingDate;
  // when NOT configured, still activate as a DB record with NO charge attempted
  // (the plan card renders a 'billing not connected' badge).
  async function activatePlan(plan: any) {
    if (!id) return;
    const patch: Record<string, any> = {
      id: plan.id,
      status: 'active',
      startedAt: new Date().toISOString().slice(0, 10),
    };
    const res = await stripe.createSubscription({ plan: plan.id });
    if (res.configured) {
      if (res.subscriptionId) patch.stripeSubscriptionId = res.subscriptionId;
      if (res.nextBillingDate) patch.nextBillingDate = res.nextBillingDate;
    }
    await updateMaintenancePlan(patch);
    await logProjectEvent(
      id,
      'admin',
      res.configured
        ? 'activated the maintenance plan'
        : 'activated the maintenance plan (billing not connected)',
    );
    await refresh();
  }

  // Pause an active plan (no billing side effect in this build).
  async function pausePlan(plan: any) {
    if (!id) return;
    await updateMaintenancePlan({ id: plan.id, status: 'paused' });
    await logProjectEvent(id, 'admin', 'paused the maintenance plan');
    await refresh();
  }

  // Cancel a plan. Cancel the Stripe subscription when the adapter is
  // configured and a subscription exists; always set the DB record to cancelled.
  async function cancelPlan(plan: any) {
    if (!id) return;
    if (plan.stripeSubscriptionId && stripe.configured()) {
      await stripe.cancelSubscription({ subscriptionId: plan.stripeSubscriptionId });
    }
    await updateMaintenancePlan({
      id: plan.id,
      status: 'cancelled',
      cancelledAt: new Date().toISOString().slice(0, 10),
    });
    await logProjectEvent(id, 'admin', 'cancelled the maintenance plan');
    await refresh();
  }

  // Schedule a requested window for a concrete time.
  async function scheduleWindow(plan: any, win: any, scheduledFor: string) {
    if (!id) return;
    await updateMaintenanceWindow({
      id: win.id,
      status: 'scheduled',
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : win.scheduledFor,
    });
    await logProjectEvent(id, 'admin', 'scheduled a maintenance window');
    await refresh();
  }

  // Move a window to in_progress.
  async function startWindow(plan: any, win: any) {
    if (!id) return;
    await updateMaintenanceWindow({ id: win.id, status: 'in_progress' });
    await logProjectEvent(id, 'admin', 'started a maintenance window');
    await refresh();
  }

  // Mark a window done and record hoursUsed. When hoursUsed exceeds the plan's
  // includedHours, bill the overage as a kind='maintenance' draft Invoice and
  // link it back on the window.
  async function completeWindow(plan: any, win: any, hoursUsed: number) {
    if (!id || !project) return;
    const includedHours = Number(plan.includedHours) || 0;
    const overage = hoursUsed - includedHours;
    let invoiceId: string | undefined;
    if (overage > 0) {
      // Rate the overage against the plan amount prorated over included hours;
      // fall back to the full plan amount per overage hour when no hours are
      // included on the plan.
      const perHour = includedHours > 0 ? Number(plan.amount) / includedHours : Number(plan.amount);
      const subtotal = Math.round(perHour * overage * 100) / 100;
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const invoice = await createInvoice({
        clientId: project.clientId,
        projectId: id,
        kind: 'maintenance',
        recurring: false,
        maintenancePlanId: plan.id,
        status: 'draft',
        subtotal,
        total: subtotal,
        dueDate,
      });
      invoiceId = invoice?.id;
    }
    await updateMaintenanceWindow({
      id: win.id,
      status: 'done',
      hoursUsed,
      ...(invoiceId ? { invoiceId } : {}),
    });
    await logProjectEvent(
      id,
      'admin',
      overage > 0
        ? `completed a maintenance window (${hoursUsed}h; billed ${overage}h overage)`
        : `completed a maintenance window (${hoursUsed}h)`,
    );
    await refresh();
  }

  // When a contract is observed signed, activate the project exactly once.
  const [activating, setActivating] = useState(false);
  useEffect(() => {
    if (!project || activating) return;
    const hasSigned = contracts.some(
      (c) => c.status === 'signed' || c.status === 'countersigned',
    );
    if (hasSigned && project.status === 'contract_pending') {
      setActivating(true);
      (async () => {
        try {
          await updateProject({ id: project.id, status: 'active' });
          await logProjectEvent(project.id, 'system', 'activated the project on contract signing');
          await refresh();
        } catch (err) {
          console.error('Failed to activate project', err);
          setActivating(false);
        }
      })();
    }
  }, [contracts, project, activating, refresh]);

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

          {/* Demos / choice board */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MonitorPlay size={18} className="text-ace-purple" /> Demos
            </h2>

            <DemoCreateForm projectId={project.id} onCreate={createDemoRecord} />

            <div className="mt-4 space-y-3">
              {demos.length === 0 ? (
                <p className="text-sm text-ace-muted">No demos yet.</p>
              ) : (
                demos.map((d) => {
                  const options = parseDemoOptions(d.options);
                  return (
                    <div key={d.id} className="bg-[#0e0e0e] rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{d.title}</span>
                        <span className="badge bg-white/5 text-ace-muted">{d.status}</span>
                      </div>
                      <div className="text-xs text-ace-muted mt-1">
                        {DEMO_KINDS.find((k) => k.v === d.kind)?.label || d.kind}
                      </div>

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

                      {d.kind === 'CHOICE_BOARD' && options.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {options.map((opt) => {
                            const selected = d.selectedOption === opt.slug;
                            return (
                              <div
                                key={opt.slug}
                                className={`rounded-lg border overflow-hidden ${
                                  selected
                                    ? 'border-ace-purple ring-1 ring-ace-purple'
                                    : 'border-[rgba(255,255,255,0.06)]'
                                }`}
                              >
                                {opt.imageKey ? (
                                  <DemoImage
                                    imageKey={opt.imageKey}
                                    alt={opt.name}
                                    className="w-full h-24 object-cover bg-black/40"
                                  />
                                ) : (
                                  <div className="w-full h-24 flex items-center justify-center text-xs text-ace-muted bg-white/5">
                                    No image
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-1 px-2 py-1">
                                  <span className="text-xs truncate">{opt.name}</span>
                                  {selected && <span className="text-xs text-ace-purple">✓</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {d.selectedOption && (
                        <div className="text-xs mt-2">
                          <span className="text-ace-muted">Client picked:</span> {d.selectedOption}
                        </div>
                      )}
                      {d.clientFeedback && (
                        <div className="text-xs text-ace-muted mt-1 whitespace-pre-wrap">
                          <span className="text-white/70">Feedback:</span> {d.clientFeedback}
                        </div>
                      )}

                      <div className="flex gap-2 mt-2 flex-wrap">
                        {d.status === 'DRAFT' && (
                          <button
                            onClick={() => shareDemo(d)}
                            className="text-xs px-3 py-1 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20"
                          >
                            Share with client
                          </button>
                        )}
                        {(d.status === 'SHARED' || d.status === 'FEEDBACK') && (
                          <button
                            onClick={() => approveDemo(d)}
                            className="text-xs px-3 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20"
                          >
                            Mark approved
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
            <ContractCreateForm onCreate={createContractRecord} />

            {contracts.length === 0 ? (
              <p className="text-sm text-ace-muted mt-3">No contract on file yet.</p>
            ) : (
              <div className="space-y-3 mt-3">
                {contracts.map((c) => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    onUpload={(file) => uploadContractDocument(c, file)}
                    onSend={() => sendContract(c)}
                    onCountersign={() => countersignContract(c)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Maintenance */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Wrench size={16} className="text-ace-cyan" /> Maintenance
            </h3>
            <MaintenancePlanCreateForm onCreate={createMaintenancePlanRecord} />

            {plans.length === 0 ? (
              <p className="text-sm text-ace-muted mt-3">No maintenance plan yet.</p>
            ) : (
              <div className="space-y-3 mt-3">
                {plans.map((p) => (
                  <MaintenancePlanCard
                    key={p.id}
                    plan={p}
                    windows={windowsByPlan[p.id] || []}
                    onActivate={() => activatePlan(p)}
                    onPause={() => pausePlan(p)}
                    onCancel={() => cancelPlan(p)}
                    onSchedule={(win, when) => scheduleWindow(p, win, when)}
                    onStart={(win) => startWindow(p, win)}
                    onComplete={(win, hours) => completeWindow(p, win, hours)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Maintenance cadence options mirror the MaintenancePlan.cadence enum. */
const MAINTENANCE_CADENCES: { v: 'monthly' | 'quarterly' | 'annual'; label: string }[] = [
  { v: 'monthly', label: 'Monthly' },
  { v: 'quarterly', label: 'Quarterly' },
  { v: 'annual', label: 'Annual' },
];

function MaintenancePlanCreateForm({
  onCreate,
}: {
  onCreate: (input: {
    cadence: 'monthly' | 'quarterly' | 'annual';
    amount: number;
    includedHours: number;
  }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [amount, setAmount] = useState('');
  const [includedHours, setIncludedHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCadence('monthly');
    setAmount('');
    setIncludedHours('');
    setError(null);
  }

  async function submit() {
    const amt = Number(amount);
    if (!amount.trim() || Number.isNaN(amt) || amt < 0) {
      setError('Enter a valid amount.');
      return;
    }
    const hrs = includedHours.trim() ? Number(includedHours) : 0;
    if (Number.isNaN(hrs) || hrs < 0) {
      setError('Enter valid included hours.');
      return;
    }
    setBusy(true);
    try {
      await onCreate({ cadence, amount: amt, includedHours: hrs });
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
        New plan
      </button>
    );
  }

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3 space-y-3 border border-[rgba(255,255,255,0.04)]">
      {error && (
        <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{error}</div>
      )}
      <div>
        <label className="text-xs text-ace-muted mb-1 block">Cadence</label>
        <select
          className="input py-1.5 text-sm"
          value={cadence}
          onChange={(e) => setCadence(e.target.value as typeof cadence)}
        >
          {MAINTENANCE_CADENCES.map((c) => (
            <option key={c.v} value={c.v}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-ace-muted mb-1 block">Amount (USD / cycle)</label>
        <input
          type="number"
          min="0"
          className="input text-sm"
          placeholder="e.g. 150"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-ace-muted mb-1 block">Included hours / cycle</label>
        <input
          type="number"
          min="0"
          className="input text-sm"
          placeholder="e.g. 4"
          value={includedHours}
          onChange={(e) => setIncludedHours(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create plan'}
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

function MaintenancePlanCard({
  plan,
  windows,
  onActivate,
  onPause,
  onCancel,
  onSchedule,
  onStart,
  onComplete,
}: {
  plan: any;
  windows: any[];
  onActivate: () => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onSchedule: (win: any, when: string) => void | Promise<void>;
  onStart: (win: any) => void | Promise<void>;
  onComplete: (win: any, hoursUsed: number) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // The frontend can only see the publishable key; the authoritative secret
  // gate lives in the backend adapter. We surface the 'billing not connected'
  // badge for an active plan that has no Stripe subscription recorded.
  const billingConnected = billingConfigured();
  const showNotConnected =
    plan.status === 'active' && !plan.stripeSubscriptionId && !billingConnected;

  async function run(fn: () => void | Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="badge bg-white/5 text-ace-muted">{plan.status}</span>
        <span className="text-xs text-ace-muted">{plan.cadence}</span>
      </div>
      <div className="text-sm mt-1">
        ${Number(plan.amount || 0).toLocaleString()}
        <span className="text-ace-muted"> / {plan.cadence}</span>
        {plan.includedHours != null && (
          <span className="text-ace-muted"> · {plan.includedHours}h included</span>
        )}
      </div>
      {plan.nextBillingDate && (
        <div className="text-xs text-ace-muted mt-1">Next billing: {plan.nextBillingDate}</div>
      )}

      {showNotConnected && (
        <div className="text-xs text-yellow-400 mt-2">
          Billing not connected — Stripe not configured.
        </div>
      )}

      <div className="flex gap-2 mt-2 flex-wrap">
        {(plan.status === 'paused' || plan.status === 'past_due') && (
          <button
            onClick={() => run(onActivate)}
            disabled={busy}
            className="text-xs px-3 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 disabled:opacity-50"
          >
            Activate
          </button>
        )}
        {plan.status === 'active' && (
          <button
            onClick={() => run(onPause)}
            disabled={busy}
            className="text-xs px-3 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] disabled:opacity-50"
          >
            Pause
          </button>
        )}
        {plan.status !== 'cancelled' && (
          <button
            onClick={() => run(onCancel)}
            disabled={busy}
            className="text-xs px-3 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Windows */}
      <div className="mt-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
        <div className="text-xs text-ace-muted mb-2">Maintenance windows</div>
        {windows.length === 0 ? (
          <p className="text-xs text-ace-muted">No windows yet.</p>
        ) : (
          <div className="space-y-2">
            {windows.map((w) => (
              <MaintenanceWindowRow
                key={w.id}
                win={w}
                onSchedule={(when) => onSchedule(w, when)}
                onStart={() => onStart(w)}
                onComplete={(hours) => onComplete(w, hours)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MaintenanceWindowRow({
  win,
  onSchedule,
  onStart,
  onComplete,
}: {
  win: any;
  onSchedule: (when: string) => void | Promise<void>;
  onStart: () => void | Promise<void>;
  onComplete: (hoursUsed: number) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState('');
  const [hours, setHours] = useState('');

  async function run(fn: () => void | Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#141414] rounded-lg p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs">{win.description || 'Window'}</span>
        <span className="badge bg-white/5 text-ace-muted">{win.status}</span>
      </div>
      <div className="text-xs text-ace-muted mt-1">
        {win.scheduledFor ? fmtWhen(win.scheduledFor) : 'Time TBD'}
        {win.durationMins != null ? ` · ${win.durationMins} min` : ''}
      </div>
      {win.hoursUsed != null && (
        <div className="text-xs text-ace-muted mt-1">{win.hoursUsed}h used</div>
      )}
      {win.invoiceId && (
        <div className="text-xs text-ace-muted mt-1">Overage invoiced</div>
      )}

      {win.status === 'requested' && (
        <div className="mt-2 flex items-end gap-2 flex-wrap">
          <input
            type="datetime-local"
            className="input text-xs py-1"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <button
            onClick={() => run(() => onSchedule(when))}
            disabled={busy || !when}
            className="text-xs px-3 py-1 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20 disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      )}
      {win.status === 'scheduled' && (
        <div className="mt-2">
          <button
            onClick={() => run(onStart)}
            disabled={busy}
            className="text-xs px-3 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] disabled:opacity-50"
          >
            Start
          </button>
        </div>
      )}
      {win.status === 'in_progress' && (
        <div className="mt-2 flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-xs text-ace-muted mb-1 block">Hours used</label>
            <input
              type="number"
              min="0"
              step="0.25"
              className="input text-xs py-1"
              placeholder="e.g. 3"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <button
            onClick={() => run(() => onComplete(Number(hours) || 0))}
            disabled={busy || !hours.trim()}
            className="text-xs px-3 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 disabled:opacity-50"
          >
            Mark done
          </button>
        </div>
      )}
    </div>
  );
}

function DemoCreateForm({
  projectId,
  onCreate,
}: {
  projectId: string;
  onCreate: (input: {
    title: string;
    kind: 'CHOICE_BOARD' | 'PROTOTYPE' | 'PREVIEW_URL' | 'DECK';
    options: DemoOption[];
    previewUrl: string;
  }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'CHOICE_BOARD' | 'PROTOTYPE' | 'PREVIEW_URL' | 'DECK'>(
    'CHOICE_BOARD',
  );
  const [previewUrl, setPreviewUrl] = useState('');
  const [options, setOptions] = useState<DemoOption[]>([]);
  // Draft of the option being added before upload completes.
  const [optName, setOptName] = useState('');
  const [optPreview, setOptPreview] = useState('');
  const [optFile, setOptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setKind('CHOICE_BOARD');
    setPreviewUrl('');
    setOptions([]);
    setOptName('');
    setOptPreview('');
    setOptFile(null);
    setError(null);
  }

  // Upload the option image (downscaled client-side to <=2000px by
  // uploadDemoImage) and append {slug,name,imageKey,previewUrl}.
  async function addOption() {
    if (!optName.trim()) {
      setError('Give the option a name.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      let imageKey: string | undefined;
      if (optFile) {
        imageKey = await uploadDemoImage(projectId, optFile, optName.trim());
      }
      setOptions((prev) => [
        ...prev,
        {
          slug: slugify(optName),
          name: optName.trim(),
          imageKey,
          previewUrl: optPreview.trim() || undefined,
        },
      ]);
      setOptName('');
      setOptPreview('');
      setOptFile(null);
    } catch (err) {
      console.error(err);
      setError('Image upload failed. Please try a different file.');
    } finally {
      setUploading(false);
    }
  }

  function removeOption(slug: string) {
    setOptions((prev) => prev.filter((o) => o.slug !== slug));
  }

  async function submit() {
    if (!title.trim()) {
      setError('Give the demo a title.');
      return;
    }
    if (kind === 'CHOICE_BOARD' && options.length === 0) {
      setError('Add at least one choice-board option.');
      return;
    }
    if (kind !== 'CHOICE_BOARD' && !previewUrl.trim()) {
      setError('Enter a preview URL for this demo.');
      return;
    }
    setBusy(true);
    try {
      await onCreate({ title: title.trim(), kind, options, previewUrl: previewUrl.trim() });
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
        className="text-xs px-3 py-1.5 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20"
      >
        New demo
      </button>
    );
  }

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3 space-y-3 border border-[rgba(255,255,255,0.04)]">
      {error && (
        <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{error}</div>
      )}

      <div>
        <label className="text-xs text-ace-muted mb-1 block">Title</label>
        <input
          type="text"
          className="input text-sm"
          placeholder="e.g. Homepage hero concepts"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-ace-muted mb-1 block">Kind</label>
        <select
          className="input py-1.5 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          {DEMO_KINDS.map((k) => (
            <option key={k.v} value={k.v}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {kind === 'CHOICE_BOARD' ? (
        <div className="space-y-2">
          <label className="text-xs text-ace-muted block">Image options</label>
          {options.length > 0 && (
            <div className="space-y-1">
              {options.map((o) => (
                <div
                  key={o.slug}
                  className="flex items-center justify-between gap-2 text-xs bg-white/5 rounded-lg px-2 py-1"
                >
                  <span className="truncate">
                    {o.name}
                    {o.imageKey ? '' : ' (no image)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOption(o.slug)}
                    className="text-red-400 hover:text-red-300"
                    title="Remove option"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border border-[rgba(255,255,255,0.06)] rounded-lg p-2">
            <input
              type="text"
              className="input text-sm"
              placeholder="Option name"
              value={optName}
              onChange={(e) => setOptName(e.target.value)}
            />
            <input
              type="file"
              accept="image/*"
              className="input text-xs py-1.5"
              onChange={(e) => setOptFile(e.target.files?.[0] || null)}
            />
            <input
              type="text"
              className="input text-sm"
              placeholder="Preview URL (optional)"
              value={optPreview}
              onChange={(e) => setOptPreview(e.target.value)}
            />
            <button
              type="button"
              onClick={addOption}
              disabled={uploading || !optName.trim()}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] disabled:opacity-50"
            >
              <Plus size={12} /> {uploading ? 'Uploading…' : 'Add option'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs text-ace-muted mb-1 block">Preview URL</label>
          <input
            type="text"
            className="input text-sm"
            placeholder="https://…"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || uploading}
          className="text-xs px-3 py-1.5 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create demo'}
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

/** Resolve a signed GET URL for a stored contract PDF and render a link, with a
 *  graceful fallback when the URL cannot be resolved (see the {entity_id}
 *  caveat in contracts.ts). */
function ContractDocLink({ docKey, label }: { docKey: string; label: string }) {
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
    return <div className="text-xs text-ace-muted mt-1">{label} unavailable.</div>;
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

function ContractCreateForm({
  onCreate,
}: {
  onCreate: (input: {
    amount: number;
    terms: string;
    provider: 'manual_upload' | 'dropbox_sign';
  }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [terms, setTerms] = useState('');
  const [provider, setProvider] = useState<'manual_upload' | 'dropbox_sign'>('manual_upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAmount('');
    setTerms('');
    setProvider('manual_upload');
    setError(null);
  }

  async function submit() {
    const amt = Number(amount);
    if (!amount.trim() || Number.isNaN(amt) || amt < 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      await onCreate({ amount: amt, terms: terms.trim(), provider });
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
        className="text-xs px-3 py-1.5 rounded-lg bg-ace-magenta/15 text-ace-magenta border border-ace-magenta/20"
      >
        New contract
      </button>
    );
  }

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3 space-y-3 border border-[rgba(255,255,255,0.04)]">
      {error && (
        <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{error}</div>
      )}
      <div>
        <label className="text-xs text-ace-muted mb-1 block">Amount (USD)</label>
        <input
          type="number"
          min="0"
          className="input text-sm"
          placeholder="e.g. 5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-ace-muted mb-1 block">Terms</label>
        <textarea
          className="input min-h-[60px] resize-y text-sm"
          placeholder="Scope, payment schedule, milestones…"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-ace-muted mb-1 block">Signing method</label>
        <select
          className="input py-1.5 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value as typeof provider)}
        >
          <option value="manual_upload">Manual upload</option>
          <option value="dropbox_sign">Dropbox Sign</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-lg bg-ace-magenta/15 text-ace-magenta border border-ace-magenta/20 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create contract'}
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

function ContractCard({
  contract: c,
  onUpload,
  onSend,
  onCountersign,
}: {
  contract: any;
  onUpload: (file: File) => void | Promise<void>;
  onSend: () => void | Promise<void>;
  onCountersign: () => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const isDropbox = c.provider === 'dropbox_sign';
  const providerUnconfigured = isDropbox && !dropboxSign.configured();

  async function run(fn: () => void | Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function doUpload() {
    if (!file) return;
    await run(() => onUpload(file));
    setFile(null);
  }

  return (
    <div className="bg-[#0e0e0e] rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="badge bg-white/5 text-ace-muted">{c.status}</span>
        <span className="text-xs text-ace-muted">{c.provider || 'manual_upload'}</span>
      </div>
      {c.amount != null && (
        <div className="text-sm mt-1">${Number(c.amount).toLocaleString()}</div>
      )}

      {/* Document links */}
      {c.documentKey && <ContractDocLink docKey={c.documentKey} label="unsigned PDF" />}
      {c.signedDocumentKey && <ContractDocLink docKey={c.signedDocumentKey} label="signed PDF" />}

      {/* Upload unsigned PDF */}
      <div className="mt-2 space-y-2">
        <input
          type="file"
          accept="application/pdf"
          className="input text-xs py-1.5"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          onClick={doUpload}
          disabled={busy || !file}
          className="text-xs px-3 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] disabled:opacity-50"
        >
          {busy ? 'Working…' : c.documentKey ? 'Replace PDF' : 'Upload PDF'}
        </button>
      </div>

      {providerUnconfigured && (
        <div className="text-xs text-yellow-400 mt-2">
          Dropbox Sign provider not configured.
        </div>
      )}

      <div className="flex gap-2 mt-2 flex-wrap">
        {c.status === 'draft' && (
          <button
            onClick={() => run(onSend)}
            disabled={busy || providerUnconfigured}
            className="text-xs px-3 py-1 rounded-lg bg-ace-cyan/15 text-ace-cyan border border-ace-cyan/20 disabled:opacity-50"
          >
            Send to client
          </button>
        )}
        {c.status === 'signed' && (
          <button
            onClick={() => run(onCountersign)}
            disabled={busy}
            className="text-xs px-3 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 disabled:opacity-50"
          >
            Countersign
          </button>
        )}
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
