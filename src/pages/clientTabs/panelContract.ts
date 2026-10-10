/**
 * The shared contract every workspace tab panel honors (FEAT-004).
 *
 * The ClientWorkspace shell loads the Client (and its linked Quote) once and
 * passes the same four props to whichever panel is active:
 *   - client:       the loaded Client record (null while loading / not found).
 *   - quote:        the linked Quote (by Quote.clientId or email), or null.
 *   - refresh:      re-fetch the workspace query (['client', id]).
 *   - advanceStage: forward-only stage bump; see ClientWorkspace.advanceStage.
 *
 * These panels are placeholders in FEAT-004; FEAT-005/006/007 replace them
 * with the real Tab UIs but keep this prop shape.
 */
import type { Stage } from './stageOrder';

export interface PanelProps {
  client: any;
  quote: any;
  refresh: () => void;
  advanceStage: (next: Stage) => Promise<void> | void;
}
