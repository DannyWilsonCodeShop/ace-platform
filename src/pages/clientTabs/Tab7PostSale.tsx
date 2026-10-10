/**
 * Tab 7 — Post-Sale (FEAT-007).
 *
 * The post-sale log + notes system plus drip-campaign selection, all scoped to
 * the client's Project. Notes are written as ProjectNote rows and surfaced
 * alongside the ProjectEvent activity log (both newest-first). Drip: list the
 * available campaigns, pick one, and enroll the client (enrollClient +
 * sendCampaignStep's first step) — best-effort, wrapped so it NEVER blocks the
 * stage advance (mirrors closeProject in ProjectDetail ~672). Bottom action
 * advances to Monthly Service.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ArrowRight, Megaphone, Plus } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS } from './stageOrder';
import {
  listProjectsByClient,
  listProjectNotes,
  listProjectEvents,
  createProjectNote,
  listCampaigns,
  listCampaignStepsByCampaign,
} from '../../utils/api';
import { enrollClient, sendCampaignStep } from '../../campaigns/campaigns';
import { logProjectEvent } from '../../projects/lifecycleEvents';

export default function Tab7PostSale({ client, advanceStage }: PanelProps) {
  const clientName =
    `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || client?.email || 'Client';

  const projectQuery = useQuery({
    queryKey: ['tab7-project', client?.id],
    enabled: !!client?.id,
    queryFn: () => listProjectsByClient(client.id),
  });
  const project = (projectQuery.data || [])[0] || null;

  const logQuery = useQuery({
    queryKey: ['tab7-log', project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      const [notes, events] = await Promise.all([
        listProjectNotes(project.id),
        listProjectEvents(project.id),
      ]);
      return { notes: notes || [], events: events || [] };
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ['tab7-campaigns'],
    queryFn: () => listCampaigns(),
  });

  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [campaignId, setCampaignId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  const [advancing, setAdvancing] = useState(false);

  const timeline = useMemo(() => {
    const data = logQuery.data;
    if (!data) return [] as Array<{ id: string; when: string; who: string; text: string }>;
    const notes = data.notes.map((n: any) => ({
      id: `note-${n.id}`,
      when: n.createdAt || '',
      who: n.authorRole || 'note',
      text: n.body || '',
    }));
    const events = data.events.map((e: any) => ({
      id: `event-${e.id}`,
      when: e.createdAt || '',
      who: e.actor || 'system',
      text: e.message || '',
    }));
    return [...notes, ...events].sort((a, b) => String(b.when).localeCompare(String(a.when)));
  }, [logQuery.data]);

  const addNote = async () => {
    if (!noteBody.trim() || !project?.id) return;
    setNoteError(null);
    setSavingNote(true);
    try {
      let sub = '';
      try {
        const session = await fetchAuthSession();
        sub = (session.tokens?.accessToken?.payload?.['sub'] as string) || '';
      } catch {
        /* best-effort stamp */
      }
      await createProjectNote({
        projectId: project.id,
        authorSub: sub || null,
        authorRole: 'admin',
        kind: 'note',
        body: noteBody.trim(),
      });
      setNoteBody('');
      await logQuery.refetch();
    } catch (err: any) {
      console.error('Tab7 addNote failed:', err);
      setNoteError('Could not save the note: ' + (err?.message || 'Unknown error'));
    } finally {
      setSavingNote(false);
    }
  };

  const enroll = async () => {
    setEnrollMsg(null);
    const campaign = (campaignsQuery.data || []).find((c: any) => c.id === campaignId);
    if (!campaign) {
      setEnrollMsg('Pick a campaign first.');
      return;
    }
    if (!client?.email) {
      setEnrollMsg('This client has no email on file to enroll.');
      return;
    }
    setEnrolling(true);
    try {
      // Best-effort — mirrors closeProject: enrollment never blocks.
      await enrollClient({
        campaign,
        email: client.email,
        name: clientName,
        projectId: project?.id,
      });
      const steps = await listCampaignStepsByCampaign(campaign.id);
      const first = [...(steps || [])].sort(
        (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
      )[0];
      if (first) {
        await sendCampaignStep({
          step: first,
          recipientEmail: client.email,
          recipientName: clientName,
          projectName: project?.name,
        });
      }
      if (project?.id) {
        await logProjectEvent(project.id, 'admin', `enrolled ${clientName} in "${campaign.name || campaign.id}"`);
      }
      setEnrollMsg(`Enrolled in "${campaign.name || campaign.id}".`);
      await logQuery.refetch();
    } catch (err: any) {
      console.error('Tab7 enroll failed:', err);
      setEnrollMsg('Enrollment could not complete: ' + (err?.message || 'Unknown error'));
    } finally {
      setEnrolling(false);
    }
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await advanceStage('monthly_service');
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Post-Sale</h2>
        <p className="text-sm text-ace-muted">
          Log notes and attempts, and enroll the client into a drip campaign.
        </p>
      </div>

      {!project ? (
        <div className="card">
          <p className="text-sm text-ace-muted">
            No project found for this client yet — the post-sale log attaches to
            the project. Complete the earlier tabs first.
          </p>
        </div>
      ) : (
        <>
          {/* Add note */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-2">Add a note</h3>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              placeholder="Call summary, follow-up, customer-service note…"
              className="input w-full text-sm"
            />
            {noteError && <p className="text-xs text-red-300 mt-2">{noteError}</p>}
            <div className="flex justify-end mt-2">
              <button
                onClick={addNote}
                disabled={savingNote || !noteBody.trim()}
                className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={14} />
                {savingNote ? 'Saving…' : 'Add note'}
              </button>
            </div>
          </div>

          {/* Drip campaign */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Megaphone size={16} className="text-ace-magenta" /> Drip campaign
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="input text-sm py-1 flex-1 min-w-[180px]"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                disabled={campaignsQuery.isLoading}
              >
                <option value="">
                  {campaignsQuery.isLoading
                    ? 'Loading campaigns…'
                    : (campaignsQuery.data || []).length === 0
                      ? 'No campaigns available'
                      : 'Select a campaign…'}
                </option>
                {(campaignsQuery.data || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id} {c.status ? `(${c.status})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={enroll}
                disabled={enrolling || !campaignId}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {enrolling ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
            {enrollMsg && <p className="text-xs text-ace-muted mt-2">{enrollMsg}</p>}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-2">Activity log</h3>
            {logQuery.isLoading ? (
              <p className="text-sm text-ace-muted">Loading…</p>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-ace-muted">No notes or events yet.</p>
            ) : (
              <ul className="space-y-2">
                {timeline.map((t) => (
                  <li key={t.id} className="rounded-lg border border-[rgba(255,255,255,0.06)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ace-muted">{t.who}</span>
                      <span className="text-xs text-ace-muted">
                        {t.when ? new Date(t.when).toLocaleString() : '—'}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{t.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Bottom action */}
      <div className="flex justify-end">
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          Advance to {STAGE_LABELS.monthly_service}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
