import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sns = new SNSClient({ region: 'us-east-1' });
const ses = new SESClient({ region: 'us-east-1' });

const OWNER_PHONE = '+14048037330'; // Danny's phone
const OWNER_EMAIL = 'wilson.danny@me.com';
const FROM_EMAIL = 'info@atlantacreativeexchange.com';

interface NotificationEvent {
  type: 'new_quote' | 'quote_accepted' | 'payment_received' | 'gig_reminder' | 'message';
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
