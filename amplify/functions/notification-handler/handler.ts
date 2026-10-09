import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sns = new SNSClient({ region: 'us-east-1' });
const ses = new SESClient({ region: 'us-east-1' });

const OWNER_PHONE = '+14048037330'; // Danny's phone
const OWNER_EMAIL = 'wilson.danny@me.com';
const FROM_EMAIL = 'info@atlantacreativeexchange.com';

interface NotificationEvent {
  type:
    | 'new_quote'
    | 'quote_accepted'
    | 'payment_received'
    | 'gig_reminder'
    | 'message'
    | 'project_note'
    | 'meeting_requested'
    | 'meeting_response'
    | 'demo_feedback'
    | 'contract_sent'
    | 'contract_signed'
    | 'maintenance_requested'
    | 'campaign_step';
  data: Record<string, any>;
  channels: ('sms' | 'email' | 'in_app')[];
}

export const handler = async (event: NotificationEvent) => {
  const { type, data, channels } = event;

  let smsMessage = '';
  let emailSubject = '';
  let emailBody = '';

  switch (type) {
    case 'new_quote':
      smsMessage = `🎵 New ACE quote from ${data.firstName} ${data.lastName} — ${data.eventType || 'Digital Project'}. Check admin portal.`;
      emailSubject = `[ACE] New quote: ${data.firstName} ${data.lastName}`;
      emailBody = `New quote request from ${data.firstName} ${data.lastName} for ${data.eventType || 'Digital Project'}. Open the admin portal to review.`;
      break;
    case 'payment_received':
      smsMessage = `💰 Payment received: $${data.amount} from ${data.clientName}. Balance: $${data.remainingBalance}.`;
      emailSubject = `[ACE] Payment: $${data.amount} from ${data.clientName}`;
      emailBody = `Payment of $${data.amount} received from ${data.clientName}. Remaining balance: $${data.remainingBalance}.`;
      break;
    case 'gig_reminder':
      smsMessage = `📅 Gig tomorrow: ${data.eventType} at ${data.venueName}. Load-in: ${data.loadInTime || 'TBD'}`;
      emailSubject = `[ACE] Tomorrow: ${data.eventType} at ${data.venueName}`;
      emailBody = `Reminder: ${data.eventType} tomorrow at ${data.venueName}. Load-in: ${data.loadInTime || 'TBD'}. Check the gig checklist in the admin portal.`;
      break;
    case 'message':
      smsMessage = `💬 New message from ${data.senderName}: "${data.content?.substring(0, 80)}..."`;
      emailSubject = `[ACE] Message from ${data.senderName}`;
      emailBody = `${data.senderName} sent a message: "${data.content}"`;
      break;
    case 'project_note': {
      const noteKind = (data.kind || '').toUpperCase() === 'VOICE' ? 'VOICE' : 'TEXT';
      smsMessage = `📝 New ${noteKind} note on ${data.projectName}. Check the admin portal.`;
      emailSubject = `[ACE] New ${noteKind} note on ${data.projectName}`;
      emailBody = `A new ${noteKind} note was added to project "${data.projectName}". Reference: ${data.noteRef || 'n/a'}. Open the admin portal to review.`;
      // project-note alerts go to the owner inbox regardless of data.email
      data.email = OWNER_EMAIL;
      break;
    }
    case 'meeting_requested': {
      smsMessage = `📅 Meeting requested on ${data.projectName} — ${data.mode || 'TBD'} at ${data.proposedAt || 'TBD'}.`;
      emailSubject = `[ACE] Meeting requested on ${data.projectName}`;
      emailBody = `A meeting was requested on project "${data.projectName}".<br/>`
        + `Proposed time: ${data.proposedAt || 'TBD'}<br/>`
        + `Mode: ${data.mode || 'TBD'}<br/>`
        + `Purpose: ${data.purpose || 'n/a'}<br/>`
        + `Agenda: ${data.agenda || 'n/a'}<br/>`
        + `Open the admin portal to respond.`;
      // meeting requests go to the owner inbox regardless of data.email
      data.email = OWNER_EMAIL;
      break;
    }
    case 'meeting_response': {
      smsMessage = `📅 Meeting ${data.status || 'update'} on ${data.projectName}.`;
      emailSubject = `[ACE] Meeting ${data.status || 'update'}: ${data.projectName}`;
      emailBody = `Your meeting on project "${data.projectName}" was ${data.status || 'updated'}.<br/>`
        + `${data.confirmedAt ? `Confirmed time: ${data.confirmedAt}<br/>` : ''}`
        + `${data.responseNote ? `Note: ${data.responseNote}<br/>` : ''}`;
      // customer-facing: the caller supplies data.email (do NOT override)
      break;
    }
    case 'demo_feedback': {
      smsMessage = `🎬 Demo feedback on ${data.projectName} — "${data.demoTitle || 'demo'}".`;
      emailSubject = `[ACE] Demo feedback on ${data.projectName}`;
      emailBody = `New feedback on demo "${data.demoTitle || 'demo'}" for project "${data.projectName}".<br/>`
        + `Selected option: ${data.selectedOption || 'n/a'}<br/>`
        + `Feedback: ${data.clientFeedback || 'n/a'}<br/>`
        + `Open the admin portal to review.`;
      // demo-feedback alerts go to the owner inbox regardless of data.email
      data.email = OWNER_EMAIL;
      break;
    }
    case 'contract_sent': {
      const amountLabel = data.amount != null ? `$${data.amount}` : 'the agreed amount';
      smsMessage = `📄 Contract sent for ${data.projectName} — ${amountLabel}.`;
      emailSubject = `[ACE] Your contract for ${data.projectName}`;
      emailBody = `A contract for project "${data.projectName}" is ready for your review and signature.<br/>`
        + `Amount: ${amountLabel}<br/>`
        + `Sign in to your ACE portal to review and sign.`;
      // customer-facing: the caller supplies data.email (do NOT override)
      break;
    }
    case 'contract_signed': {
      smsMessage = `✍️ Contract signed on ${data.projectName} by ${data.signerName || 'the customer'}.`;
      emailSubject = `[ACE] Contract signed: ${data.projectName}`;
      emailBody = `The contract on project "${data.projectName}" was signed by ${data.signerName || 'the customer'}.<br/>`
        + `Open the admin portal to review.`;
      // contract-signed alerts go to the owner inbox regardless of data.email
      data.email = OWNER_EMAIL;
      break;
    }
    case 'maintenance_requested': {
      smsMessage = `🛠️ Maintenance window requested on ${data.projectName} — ${data.scheduledFor || 'TBD'}.`;
      emailSubject = `[ACE] Maintenance window requested on ${data.projectName}`;
      emailBody = `A maintenance window was requested on project "${data.projectName}".<br/>`
        + `Requested time: ${data.scheduledFor || 'TBD'}<br/>`
        + `Duration: ${data.durationMins != null ? `${data.durationMins} min` : 'TBD'}<br/>`
        + `Description: ${data.description || 'n/a'}<br/>`
        + `Open the admin portal to schedule it.`;
      // maintenance requests go to the owner inbox regardless of data.email
      data.email = OWNER_EMAIL;
      break;
    }
    case 'campaign_step': {
      // Customer-facing drip-campaign step. The caller (sendCampaignStep) has
      // already rendered the {{name}}/{{projectName}} tokens, so use the
      // provided subject/body directly. Do NOT override data.email.
      smsMessage = data.subject || 'A note from Atlanta Creative Exchange';
      emailSubject = data.subject || 'A note from Atlanta Creative Exchange';
      emailBody = data.body || '';
      break;
    }
    default:
      smsMessage = `ACE notification: ${type}`;
      emailSubject = `[ACE] Notification`;
      emailBody = JSON.stringify(data);
  }

  const results: Record<string, boolean> = {};

  // SMS
  if (channels.includes('sms')) {
    try {
      await sns.send(new PublishCommand({
        PhoneNumber: data.phone || OWNER_PHONE,
        Message: smsMessage,
      }));
      results.sms = true;
    } catch (err) {
      console.error('SMS failed:', err);
      results.sms = false;
    }
  }

  // Email
  if (channels.includes('email')) {
    try {
      await ses.send(new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [data.email || OWNER_EMAIL] },
        Message: {
          Subject: { Data: emailSubject },
          Body: { Html: { Data: `<p>${emailBody}</p>` } },
        },
      }));
      results.email = true;
    } catch (err) {
      console.error('Email failed:', err);
      results.email = false;
    }
  }

  return { success: true, results };
};
