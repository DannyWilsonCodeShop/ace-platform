/**
 * Shared placeholder scaffold for the 8 workspace tab panels (FEAT-004).
 *
 * Renders a titled stub plus — unless the tab is terminal — a bottom "advance"
 * action wired to the correct next stage. Later features (FEAT-005/006/007)
 * replace each panel's body with the real UI; this scaffold just proves the
 * { client, quote, refresh, advanceStage } contract and forward-only advance
 * are wired end to end.
 */
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS, type Stage } from './stageOrder';

interface PlaceholderPanelProps extends PanelProps {
  title: string;
  description: string;
  /** The stage this tab advances to; null for the terminal tab. */
  advanceTo: Stage | null;
}

export default function PlaceholderPanel({
  title,
  description,
  advanceTo,
  advanceStage,
}: PlaceholderPanelProps) {
  const [advancing, setAdvancing] = useState(false);

  const handleAdvance = async () => {
    if (!advanceTo) return;
    setAdvancing(true);
    try {
      await advanceStage(advanceTo);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-ace-muted text-sm">{description}</p>
      <p className="text-ace-muted text-xs mt-4 italic">
        Placeholder panel — the full experience lands in a later feature.
      </p>

      {advanceTo ? (
        <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.06)] flex justify-end">
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {advancing ? 'Advancing...' : `Continue to ${STAGE_LABELS[advanceTo]}`}
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.06)] text-right text-xs text-ace-muted">
          Final stage — no further advance.
        </div>
      )}
    </div>
  );
}
