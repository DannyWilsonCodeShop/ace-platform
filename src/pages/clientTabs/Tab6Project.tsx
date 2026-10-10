/**
 * Tab 6 — Project (FEAT-007).
 *
 * Embeds the existing reactive project dashboard (ProjectDetail) in-tab rather
 * than re-implementing it. It resolves the client's Project via
 * listProjectsByClient; if none exists yet it creates one with
 * createProjectForClient (the FEAT-003 spine step, idempotent / one per client)
 * and then renders <ProjectDetail projectId={project.id} />. The embedded
 * ProjectDetail guards its own back-navigation so it never ejects the client
 * workspace, and it shares the same ['project', id] react-query cache.
 *
 * Bottom action 'LAUNCHED' marks the Project launched (status 'closed' — the
 * dashboard's existing launch/complete marker), writes a ProjectEvent, and
 * advances the client to the Post-Sale stage.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS } from './stageOrder';
import { listProjectsByClient, updateProject } from '../../utils/api';
import { createProjectForClient } from '../../projects/promoteQuote';
import { logProjectEvent } from '../../projects/lifecycleEvents';
import ProjectDetail from '../ProjectDetail';

export default function Tab6Project({ client, quote, advanceStage }: PanelProps) {
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Resolve (or create) the client's Project. The query owns both: if no
  // Project exists yet we create one via the idempotent FEAT-003 helper so the
  // dashboard always has something to embed.
  const projectQuery = useQuery({
    queryKey: ['tab6-project', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const existing = await listProjectsByClient(client.id);
      if (existing && existing.length > 0) return existing[0];
      if (!quote?.id) {
        // Can't provision a Project without a linked quote (createProjectForClient
        // needs it). Surface the empty state instead of throwing.
        return null;
      }
      const { projectId } = await createProjectForClient(client, quote);
      const refreshed = await listProjectsByClient(client.id);
      return (refreshed || []).find((p: any) => p.id === projectId) || { id: projectId };
    },
  });

  const project = projectQuery.data || null;

  const handleLaunched = async () => {
    if (!project?.id) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      await updateProject({ id: project.id, status: 'closed' });
      await logProjectEvent(project.id, 'admin', 'Project launched');
      await advanceStage('post_sale');
      await projectQuery.refetch();
    } catch (err: any) {
      console.error('Tab6 launch failed:', err);
      setLaunchError('Could not launch the project: ' + (err?.message || 'Unknown error'));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      {projectQuery.isLoading ? (
        <div className="card">
          <p className="text-sm text-ace-muted">Loading the project workspace…</p>
        </div>
      ) : !project ? (
        <div className="card">
          <h2 className="text-lg font-semibold mb-1">Project</h2>
          <p className="text-sm text-ace-muted">
            No project exists for this client yet, and there's no linked quote to
            create one from. Link a quote (Tab 1) or complete the Agreement tab
            first.
          </p>
        </div>
      ) : (
        <>
          {/* Embedded reactive project dashboard. It renders identically to
              /projects/:id and shares the ['project', id] cache. */}
          <ProjectDetail projectId={project.id} />

          {/* Bottom action: LAUNCHED -> post_sale */}
          <div className="card">
            {launchError && (
              <p className="text-xs text-red-300 mb-2">{launchError}</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ace-muted">
                Mark this build launched to move the client into post-sale.
              </p>
              <button
                onClick={handleLaunched}
                disabled={launching}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Rocket size={16} />
                {launching ? 'Launching…' : `LAUNCHED → ${STAGE_LABELS.post_sale}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
