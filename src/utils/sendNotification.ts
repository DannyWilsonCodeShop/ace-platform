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

interface MeetingRequestNotification {
  projectName: string;
  /** Proposed meeting time (ISO or display string). */
  proposedAt: string;
  /** 'ZOOM' | 'IN_PERSON' | 'PHONE'. */
  mode: string;
  agenda: string;
  purpose: string;
}

/**
 * Notify the owner that a customer requested a meeting. POSTs
 * { type:'meeting_requested', data:{...}, channels:['email'] }. The handler
 * routes this to the owner inbox (it overrides data.email with OWNER_EMAIL).
 * Never throws; returns a success flag.
 */
export async function sendMeetingRequestNotification(
  payload: MeetingRequestNotification,
): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_ENDPOINT}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'meeting_requested',
        data: {
          projectName: payload.projectName,
          proposedAt: payload.proposedAt,
          mode: payload.mode,
          agenda: payload.agenda,
          purpose: payload.purpose,
        },
        channels: ['email'],
      }),
    });
    return { success: response.ok };
  } catch (err) {
    console.error('sendMeetingRequestNotification failed:', err);
    return { success: false };
  }
}

interface MeetingResponseNotification {
  /**
   * Customer's email — set as data.email so the owner->customer email is
   * delivered to them. NOTE: if customerEmail is missing/empty, the handler
   * falls back to OWNER_EMAIL and the customer is NOT notified. An in-app
   * Notification-row fallback is a TODO: the Notification.type enum does not
   * yet include meeting/demo types, and we are NOT widening the schema here.
   */
  customerEmail: string;
  projectName: string;
  /** 'accepted' | 'declined' | 'reschedule'. */
  status: string;
  responseNote: string;
  /** Confirmed/new proposed time (ISO or display string), when applicable. */
  confirmedAt: string;
}

/**
 * Notify the customer that the owner responded to their meeting request.
 * POSTs { type:'meeting_response', data:{ email:customerEmail, ... },
 * channels:['email'] }. Never throws; returns a success flag.
 */
export async function sendMeetingResponseNotification(
  payload: MeetingResponseNotification,
): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_ENDPOINT}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'meeting_response',
        data: {
          email: payload.customerEmail,
          projectName: payload.projectName,
          status: payload.status,
          responseNote: payload.responseNote,
          confirmedAt: payload.confirmedAt,
        },
        channels: ['email'],
      }),
    });
    return { success: response.ok };
  } catch (err) {
    console.error('sendMeetingResponseNotification failed:', err);
    return { success: false };
  }
}

interface DemoFeedbackNotification {
  projectName: string;
  demoTitle: string;
  selectedOption: string;
  clientFeedback: string;
}

/**
 * Notify the owner that a customer left feedback on a demo. POSTs
 * { type:'demo_feedback', data:{...}, channels:['email'] }. The handler routes
 * this to the owner inbox (it overrides data.email with OWNER_EMAIL).
 * Never throws; returns a success flag.
 */
export async function sendDemoFeedbackNotification(
  payload: DemoFeedbackNotification,
): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_ENDPOINT}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'demo_feedback',
        data: {
          projectName: payload.projectName,
          demoTitle: payload.demoTitle,
          selectedOption: payload.selectedOption,
          clientFeedback: payload.clientFeedback,
        },
        channels: ['email'],
      }),
    });
    return { success: response.ok };
  } catch (err) {
    console.error('sendDemoFeedbackNotification failed:', err);
    return { success: false };
  }
}
