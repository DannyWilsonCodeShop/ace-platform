/**
 * Drip-campaign enrollment + send logic (lifecycle stage 9), kept out of the
 * React components so the admin page and the lifecycle hooks (project-closed,
 * quote-declined) share one implementation.
 *
 * Design notes / accepted scope:
 * - There is NO CampaignEnrollment model and we are deliberately NOT adding one.
 *   An "enrollment" is recorded as a best-effort activity-log entry via
 *   logProjectEvent when a projectId exists, otherwise it falls back to a
 *   console log. The campaign audience reuses the existing Subscriber records
 *   (see Subscribers.tsx) — the admin manual-send control picks a Subscriber or
 *   a typed email as the recipient.
 * - TODO(drip-scheduler): CampaignStep.delayDays scheduling has no runtime in
 *   this build (no EventBridge schedule is wired). Sending is manual and
 *   one-step-at-a-time: the admin "Send next step" control and the lifecycle
 *   hooks each send a single step. Advancing by delayDays is deferred.
 * - TODO(sms-transport): channel==='sms' is a no-op here. The repo's
 *   notification-handler only does SNS-to-owner; there is no customer SMS
 *   transport (the external quoteHandler uses Pinpoint, not available here).
 */
import { logProjectEvent } from '../projects/lifecycleEvents';
import { sendCampaignStepNotification } from '../utils/sendNotification';

export interface EnrollClientInput {
  /** The active Campaign the client is being enrolled into. */
  campaign: { id: string; name?: string; trigger?: string };
  /** Recipient email (from a Client, Quote, or Subscriber). */
  email: string;
  /** Recipient display name, when known. */
  name?: string;
  /** Project the enrollment relates to, when there is one (enables event log). */
  projectId?: string;
}

/**
 * Record a best-effort "enrolled" marker for a client/lead against a campaign.
 * There is no enrollment model, so this logs a ProjectEvent when a projectId is
 * available and otherwise falls back to console. Never throws — enrollment must
 * never block the status change that triggered it.
 */
export async function enrollClient(input: EnrollClientInput): Promise<void> {
  const { campaign, email, name, projectId } = input;
  const who = name ? `${name} <${email}>` : email;
  try {
    if (projectId) {
      await logProjectEvent(
        projectId,
        'admin',
        `enrolled ${who} in campaign "${campaign.name || campaign.id}"`,
      );
    } else {
      // No project context (e.g. a declined quote with no project): best-effort log only.
      console.info(`[campaigns] enrolled ${who} in campaign "${campaign.name || campaign.id}"`);
    }
  } catch (err) {
    console.error('enrollClient failed:', err);
  }
}

export interface SendCampaignStepInput {
  /** The CampaignStep to send (channel, subject, bodyTemplate). */
  step: {
    id?: string;
    channel?: string;
    subject?: string | null;
    bodyTemplate?: string | null;
  };
  recipientEmail: string;
  recipientName?: string;
  projectName?: string;
}

export interface SendCampaignStepResult {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
}

/** Replace the supported {{name}} / {{projectName}} tokens in a template. */
function renderTemplate(template: string, name: string, projectName: string): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/g, name)
    .replace(/\{\{\s*projectName\s*\}\}/g, projectName);
}

/**
 * Send a single campaign step to one recipient. For channel==='email' it
 * renders the subject/body tokens and POSTs via sendCampaignStepNotification
 * (the /notify path). For channel==='sms' it is a no-op — see TODO(sms-transport).
 * Never throws; returns a result flag the caller can ignore.
 */
export async function sendCampaignStep(
  input: SendCampaignStepInput,
): Promise<SendCampaignStepResult> {
  const { step, recipientEmail, recipientName, projectName } = input;

  // TODO(sms-transport): no customer SMS transport in this build; SMS steps no-op.
  if (step.channel === 'sms') {
    return { skipped: true, reason: 'no SMS transport' };
  }

  const name = recipientName || 'there';
  const proj = projectName || '';
  const subject = renderTemplate(step.subject || '', name, proj) || 'A note from Atlanta Creative Exchange';
  const body = renderTemplate(step.bodyTemplate || '', name, proj);

  const { success } = await sendCampaignStepNotification({
    recipientEmail,
    subject,
    body,
  });
  return { success };
}
