/**
 * Thin client for the notification endpoint (SES/SNS via the notification
 * handler). Follows the existing /send-quote fetch pattern in QuoteDetail.tsx:
 * same API Gateway base host, POST JSON, tolerate failure so the caller's
 * primary action (e.g. saving a note) still succeeds even if the email bounces.
 */

const API_ENDPOINT = 'https://zuq0ae5dqf.execute-api.us-east-1.amazonaws.com';

interface ProjectNoteNotification {
  projectName: string;
  /** 'VOICE' | 'TEXT' — the note kind, surfaced in the email body. */
  kind: string;
  /** A link or short reference to the note (id / audio path / excerpt). */
  noteRef: string;
}

/**
 * Notify the owner that a project note was created. POSTs
 * { type:'project_note', data:{ projectName, kind, noteRef }, channels:['email'] }
 * to the notification endpoint. Returns a success flag; never throws, so a
 * note still saves even if the email call fails.
 */
export async function sendProjectNoteNotification(
  payload: ProjectNoteNotification,
): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_ENDPOINT}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'project_note',
        data: {
          projectName: payload.projectName,
          kind: payload.kind,
          noteRef: payload.noteRef,
        },
        channels: ['email'],
      }),
    });
    return { success: response.ok };
  } catch (err) {
    console.error('sendProjectNoteNotification failed:', err);
    return { success: false };
  }
}
