/**
 * ClientWorkspace — the tabbed Client workspace shell (FEAT-004).
 *
 * One record per client, surfaced as 8 left-to-right tabs that mirror the
 * prospect pipeline (Quote Requested -> ... -> Monthly Service). The shell:
 *   - loads the Client (getClient) + its linked Quote once, keyed ['client', id];
 *   - renders a tab bar with a per-tab done/current/upcoming chip driven by the
 *     client's coalesced stage;
 *   - resolves the active tab from the :tab route param, redirecting to the
 *     current-stage tab when :tab is omitted;
 *   - passes the shared { client, quote, refresh, advanceStage } contract to
 *     whichever panel is active.
 *
 * The 8 panels are placeholders in this feature; later features replace them.
 */
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Check, Circle, CircleDot } from 'lucide-react';
import { getClient, updateClient, listQuotes } from '../utils/api';
import { logProjectEvent } from '../projects/lifecycleEvents';
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_TO_SLUG,
  SLUG_TO_STAGE,
  TAB_SLUGS,
  coalesceStage,
  maxStage,
  stageIndex,
  type Stage,
  type TabSlug,
} from './clientTabs/stageOrder';
import type { PanelProps } from './clientTabs/panelContract';

import Tab1QuoteRequested from './clientTabs/Tab1QuoteRequested';
import Tab2DemoDetails from './clientTabs/Tab2DemoDetails';
import Tab3DemoBuild from './clientTabs/Tab3DemoBuild';
import Tab4Agreement from './clientTabs/Tab4Agreement';
import Tab5PaymentSetup from './clientTabs/Tab5PaymentSetup';
import Tab6Project from './clientTabs/Tab6Project';
import Tab7PostSale from './clientTabs/Tab7PostSale';
import Tab8MonthlyService from './clientTabs/Tab8MonthlyService';

const PANELS: Record<Stage, (props: PanelProps) => JSX.Element> = {
  quote_requested: Tab1QuoteRequested,
  demo_details: Tab2DemoDetails,
  demo_build: Tab3DemoBuild,
  agreement: Tab4Agreement,
  payment_setup: Tab5PaymentSetup,
  project: Tab6Project,
  post_sale: Tab7PostSale,
  monthly_service: Tab8MonthlyService,
};

interface WorkspaceData {
  client: any;
  quote: any;
}

async function loadWorkspace(id: string): Promise<WorkspaceData> {
  const client = await getClient(id);
  let quote: any = null;
  if (client) {
    try {
      const quotes = await listQuotes();
      quote =
        (quotes || []).find((q: any) => q.clientId === client.id) ||
        (client.email
          ? (quotes || []).find(
              (q: any) =>
                (q.email || '').toLowerCase() === (client.email || '').toLowerCase(),
            )
          : null) ||
        null;
    } catch (err) {
      // Schema is deploy-gated; a failed/empty quote lookup degrades to null.
      console.error('ClientWorkspace quote lookup failed:', err);
    }
  }
  return { client, quote };
}

export default function ClientWorkspace() {
  const { id, tab } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['client', id],
    queryFn: () => loadWorkspace(id as string),
    enabled: !!id,
  });

  if (!id) return <Navigate to="/clients" replace />;
  if (isLoading) return <div className="text-ace-muted">Loading client...</div>;
  if (isError || !data?.client)
    return <div className="text-ace-muted">Client not found.</div>;

  const client = data.client;
  const quote = data.quote;
  const currentStage = coalesceStage(client.stage);
  const currentSlug = STAGE_TO_SLUG[currentStage];

  // Resolve active tab from the :tab param. When omitted or invalid, redirect
  // to the client's current-stage tab.
  const activeStage: Stage | null =
    tab && (tab as string) in SLUG_TO_STAGE ? SLUG_TO_STAGE[tab as TabSlug] : null;
  if (!activeStage) {
    return <Navigate to={`/clients/${id}/${currentSlug}`} replace />;
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['client', id] });
  };

  // Forward-only stage bump. Raises Client.stage via maxStage (never lowers),
  // drops a best-effort lifecycle marker, and re-fetches the workspace. On
  // failure, surface inline and leave the active tab unchanged.
  const advanceStage = async (next: Stage) => {
    setAdvanceError(null);
    const raised = maxStage(client.stage, next);
    try {
      await updateClient({ id: client.id, stage: raised });
      await logProjectEvent(
        client.id,
        'admin',
        `Client stage advanced to ${STAGE_LABELS[raised]}`,
      );
      refresh();
    } catch (err: any) {
      console.error('advanceStage failed:', err);
      setAdvanceError(
        'Could not advance the stage: ' + (err?.message || 'Unknown error'),
      );
    }
  };

  const ActivePanel = PANELS[activeStage];
  const currentIndex = stageIndex(currentStage);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/clients')}
          className="text-ace-muted hover:text-white"
          aria-label="Back to clients"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-ace-muted text-sm">
            {client.organization || client.email}
          </p>
        </div>
        <span className="badge border border-ace-cyan/30 bg-ace-cyan/10 text-ace-cyan">
          {STAGE_LABELS[currentStage]}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto mb-6 border-b border-[rgba(255,255,255,0.06)] pb-px">
        {STAGE_ORDER.map((stage, i) => {
          const slug = TAB_SLUGS[i];
          const isActive = stage === activeStage;
          const state: 'done' | 'current' | 'upcoming' =
            i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
          const Icon =
            state === 'done' ? Check : state === 'current' ? CircleDot : Circle;
          return (
            <button
              key={stage}
              onClick={() => navigate(`/clients/${id}/${slug}`)}
              className={[
                'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors',
                isActive
                  ? 'border-ace-purple text-white bg-ace-purple/10'
                  : 'border-transparent text-ace-muted hover:text-white',
              ].join(' ')}
            >
              <Icon
                size={14}
                className={
                  state === 'done'
                    ? 'text-green-400'
                    : state === 'current'
                      ? 'text-ace-cyan'
                      : 'text-ace-muted'
                }
              />
              <span>{STAGE_LABELS[stage]}</span>
            </button>
          );
        })}
      </div>

      {advanceError && (
        <div className="card mb-4 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          {advanceError}
        </div>
      )}

      {/* Active panel */}
      <ActivePanel
        client={client}
        quote={quote}
        refresh={refresh}
        advanceStage={advanceStage}
      />
    </div>
  );
}
