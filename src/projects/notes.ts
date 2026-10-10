/**
 * ProjectNote data + voice-note S3 helpers (REQUIRED deliverable, decision 7).
 *
 * Ported from Green-Casting `src/dashboard/data.ts` (uploadVoice / voiceUrl /
 * remove) and generalized per-project. Voice notes are stored under
 * `project/{projectId}/notes/*` — the S3 path FEAT-001 added a storage rule for
 * (owner/manager read-write-delete, developer read, signed-in customer identity
 * read-write for their own uploads). Uses the aws-amplify v6 PATH-based Storage
 * API (the old key/accessLevel shape silently fails in v6).
 *
 * createTextNote / createVoiceNote resolve authorSub + authorRole from the
 * Cognito session and persist via createProjectNote (hand-written GraphQL in
 * src/utils/api.ts). Upload errors surface to the caller so the composer UI can
 * report failure.
 */

import { fetchAuthSession } from 'aws-amplify/auth';
import { createProjectNote } from '../utils/api';

/** Resolve the signed-in user's Cognito sub + primary role from the session. */
async function resolveAuthor(): Promise<{ authorSub: string; authorRole: string }> {
  const session = await fetchAuthSession();
  const payload = session.tokens?.accessToken?.payload || {};
  const authorSub = (payload['sub'] as string) || '';
  const groups = (payload['cognito:groups'] as string[]) || [];
  // Pick the most privileged known role for display/labeling.
  const order = ['owner', 'manager', 'developer', 'crew', 'performer', 'customer'];
  const authorRole = order.find((g) => groups.includes(g)) || groups[0] || 'customer';
  return { authorSub, authorRole };
}

/**
 * Upload a recorded voice note blob to S3; returns the stored path.
 * Path: project/{projectId}/notes/{pageKey|note}-{ts}.webm. Lets errors surface
 * to the caller (no silent catch) so the UI can report an upload failure.
 */
export async function uploadVoice(
  projectId: string,
  blob: Blob,
  pageKey?: string,
): Promise<string> {
  const { uploadData } = await import('aws-amplify/storage');
  const slug = pageKey || 'note';
  // Prefix is project-notes/<projectId>/... (not project/<id>/notes/...): the
  // storage rule must have its wildcard right after the top segment, so the
  // projectId lives under a single project-notes/* prefix. Access is group-based.
  const path = `project-notes/${projectId}/${slug}-${Date.now()}.webm`;
  await uploadData({
    path,
    data: blob,
    options: { contentType: blob.type || 'audio/webm' },
  }).result;
  return path;
}

/** Resolve a short-lived signed URL to play a stored voice note. */
export async function voiceUrl(audioKey: string): Promise<string | null> {
  try {
    const { getUrl } = await import('aws-amplify/storage');
    const { url } = await getUrl({ path: audioKey, options: { expiresIn: 3600 } });
    return url.toString();
  } catch {
    return null;
  }
}

/** Delete a stored voice-note object (best-effort). */
export async function removeVoice(audioKey: string): Promise<void> {
  const { remove } = await import('aws-amplify/storage');
  try {
    await remove({ path: audioKey });
  } catch {
    /* object may already be gone */
  }
}

/** Create a TEXT note on a project (optionally scoped to a pageKey). */
export async function createTextNote(
  projectId: string,
  pageKey: string | undefined,
  body: string,
) {
  const { authorSub, authorRole } = await resolveAuthor();
  const note = await createProjectNote({
    projectId,
    pageKey: pageKey || null,
    authorSub,
    authorRole,
    kind: 'TEXT',
    body,
    readBy: [authorSub],
  });
  return { note, audioKey: null as string | null };
}

/**
 * Create a VOICE note: upload the recorded blob to S3, then persist the note
 * with the stored audio path. Returns the created note + the audio path.
 */
export async function createVoiceNote(
  projectId: string,
  pageKey: string | undefined,
  blob: Blob,
) {
  const { authorSub, authorRole } = await resolveAuthor();
  const audioKey = await uploadVoice(projectId, blob, pageKey);
  const note = await createProjectNote({
    projectId,
    pageKey: pageKey || null,
    authorSub,
    authorRole,
    kind: 'VOICE',
    audioKey,
    readBy: [authorSub],
  });
  return { note, audioKey };
}
