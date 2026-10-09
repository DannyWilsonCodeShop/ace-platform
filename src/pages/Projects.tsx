/**
 * Admin Projects list. Each project renders as a card with name, client,
 * status, an overall progress bar + track-status badge computed from its
 * ProjectPage rows via the template math in src/projects/progress.ts.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Search } from 'lucide-react';
import { listProjects, listProjectPages, listClients } from '../utils/api';
import { getTemplate } from '../projects/templates';
import {
  overallDisplayed,
  trackStatus,
  type PageState,
} from '../projects/progress';
import { ProgressBar, TrackBadge } from '../projects/ui';

const STATUS_TONE: Record<string, string> = {
  planning: 'bg-white/5 text-ace-muted',
  contract_pending: 'bg-yellow-500/15 text-yellow-400',
  active: 'bg-ace-cyan/15 text-ace-cyan',
  in_review: 'bg-ace-purple/15 text-ace-purple',
  maintenance: 'bg-green-500/15 text-green-400',
  completed: 'bg-green-500/15 text-green-400',
  closed: 'bg-white/5 text-ace-muted',
  cancelled: 'bg-red-500/15 text-red-400',
};

interface Row {
  project: any;
  overall: number;
  track: { label: string; tone: string };
  clientName: string;
}

export default function Projects() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [projects, clients] = await Promise.all([listProjects(), listClients()]);
        const clientById = new Map<string, any>(
          (clients || []).map((c: any) => [c.id, c]),
        );
        const built = await Promise.all(
          (projects || []).map(async (project: any): Promise<Row> => {
            const template = getTemplate(project.templateKey);
            // overlay the launch window stored on the project (if any)
            if (project.launchStart) template.launch.start = project.launchStart;
            if (project.launchTarget) template.launch.target = project.launchTarget;
            if (project.backendCeiling != null) template.backendCeiling = project.backendCeiling;
            let states = new Map<string, PageState>();
            try {
              const pages = await listProjectPages(project.id);
              states = toStates(pages);
            } catch (err) {
              console.error('Failed to load pages for project', project.id, err);
            }
            const client = clientById.get(project.clientId);
            return {
              project,
              overall: overallDisplayed(template, states),
              track: trackStatus(template, states),
              clientName: client
                ? `${client.firstName || ''} ${client.lastName || ''}`.trim() ||
                  client.organization ||
                  '—'
                : '—',
            };
          }),
        );
        setRows(built);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = rows.filter((r) =>
    `${r.project.name} ${r.clientName} ${r.project.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  if (loading) return <div className="text-ace-muted">Loading projects...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ace-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="input pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <FolderKanban size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">
            No projects yet. Accept a quote to promote it into a project.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.project.id}
              to={`/projects/${r.project.id}`}
              className="card block hover:border-ace-purple/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{r.project.name}</h3>
                  <p className="text-sm text-ace-muted">{r.clientName}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TrackBadge tone={r.track.tone} label={r.track.label} />
                  <span className={`badge ${STATUS_TONE[r.project.status] || STATUS_TONE.planning}`}>
                    {(r.project.status || 'planning').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <ProgressBar label="Overall progress" value={r.overall} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Build the pageKey -> PageState map the progress math expects. */
export function toStates(pages: any[]): Map<string, PageState> {
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
