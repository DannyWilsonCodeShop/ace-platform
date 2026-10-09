/**
 * Tiny reusable wrapper around createProjectEvent for dropping a best-effort
 * activity-log entry. Mirrors the note helpers' posture: swallow errors so the
 * caller's primary action still succeeds if the log write fails. Shared by the
 * meeting and demo lifecycle flows so they don't duplicate the CRUD call.
 */
import { createProjectEvent } from '../utils/api';

export async function logProjectEvent(
  projectId: string,
  actor: string,
  message: string,
  pageKey?: string,
): Promise<void> {
  try {
    await createProjectEvent({ projectId, actor, message, pageKey });
  } catch (err) {
    console.error('logProjectEvent failed:', err);
  }
}
